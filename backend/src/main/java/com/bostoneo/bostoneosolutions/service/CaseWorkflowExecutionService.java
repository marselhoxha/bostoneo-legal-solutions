package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.enumeration.WorkflowStepType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class CaseWorkflowExecutionService {

    private final CaseWorkflowTemplateRepository templateRepository;
    private final CaseWorkflowExecutionRepository executionRepository;
    private final CaseWorkflowStepExecutionRepository stepExecutionRepository;
    private final AIDocumentAnalysisService documentAnalysisService;
    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final ClaudeSonnet4Service claudeService;

    // Integration repositories - for creating actual drafts and research sessions
    private final AiConversationSessionRepository conversationSessionRepository;
    private final AiConversationMessageRepository conversationMessageRepository;
    private final ResearchSessionRepository researchSessionRepository;

    // Team notification dependencies
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final TenantService tenantService;

    // Self-injection for @Async to work (Spring AOP doesn't intercept internal calls)
    private CaseWorkflowExecutionService self;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

    @Autowired
    public CaseWorkflowExecutionService(
            CaseWorkflowTemplateRepository templateRepository,
            CaseWorkflowExecutionRepository executionRepository,
            CaseWorkflowStepExecutionRepository stepExecutionRepository,
            AIDocumentAnalysisService documentAnalysisService,
            ActionItemRepository actionItemRepository,
            TimelineEventRepository timelineEventRepository,
            ClaudeSonnet4Service claudeService,
            AiConversationSessionRepository conversationSessionRepository,
            AiConversationMessageRepository conversationMessageRepository,
            ResearchSessionRepository researchSessionRepository,
            NotificationService notificationService,
            CaseAssignmentRepository caseAssignmentRepository,
            TenantService tenantService
    ) {
        this.templateRepository = templateRepository;
        this.executionRepository = executionRepository;
        this.stepExecutionRepository = stepExecutionRepository;
        this.documentAnalysisService = documentAnalysisService;
        this.actionItemRepository = actionItemRepository;
        this.timelineEventRepository = timelineEventRepository;
        this.claudeService = claudeService;
        this.conversationSessionRepository = conversationSessionRepository;
        this.conversationMessageRepository = conversationMessageRepository;
        this.researchSessionRepository = researchSessionRepository;
        this.notificationService = notificationService;
        this.caseAssignmentRepository = caseAssignmentRepository;
        this.tenantService = tenantService;
    }

    @Autowired
    @Lazy
    public void setSelf(CaseWorkflowExecutionService self) {
        this.self = self;
    }

    /**
     * Start a new workflow execution
     */
    @Transactional
    public CaseWorkflowExecution startWorkflow(
            Long templateId,
            Long collectionId,
            Long caseId,
            List<Long> documentIds,
            User user,
            String name
    ) {
        log.info("Starting workflow - templateId: {}, collectionId: {}, caseId: {}, docs: {}, name: {}",
                templateId, collectionId, caseId, documentIds.size(), name);

        // SECURITY: Use proper tenant-filtered query instead of post-filter pattern
        Long orgId = getRequiredOrganizationId();
        CaseWorkflowTemplate template = templateRepository.findByIdAndAccessibleByOrganization(templateId, orgId)
                .orElseThrow(() -> new ApiException("Workflow template not found or access denied: " + templateId));

        // Extract steps from template config
        Map<String, Object> stepsConfig = template.getStepsConfig();
        List<Map<String, Object>> steps = extractSteps(stepsConfig);

        // Create workflow execution
        CaseWorkflowExecution execution = CaseWorkflowExecution.builder()
                .name(name)
                .collectionId(collectionId)
                .organizationId(orgId)
                .template(template)
                .status(WorkflowExecutionStatus.PENDING)
                .currentStep(0)
                .totalSteps(steps.size())
                .progressPercentage(0)
                .createdBy(user)
                .build();

        // Set case if provided
        if (caseId != null) {
            LegalCase legalCase = new LegalCase();
            legalCase.setId(caseId);
            execution.setLegalCase(legalCase);
        }

        execution = executionRepository.save(execution);

        // Create step executions
        for (int i = 0; i < steps.size(); i++) {
            Map<String, Object> stepConfig = steps.get(i);
            CaseWorkflowStepExecution stepExecution = CaseWorkflowStepExecution.builder()
                    .workflowExecution(execution)
                    .stepNumber(i + 1)
                    .stepName((String) stepConfig.get("name"))
                    .stepType(parseStepType((String) stepConfig.get("type")))
                    .status(WorkflowExecutionStatus.PENDING)
                    .inputData(Map.of(
                            "documentIds", documentIds,
                            "stepConfig", stepConfig
                    ))
                    .build();
            stepExecutionRepository.save(stepExecution);
        }

        // Start async execution via self-reference to trigger @Async proxy
        // SECURITY: Pass organizationId explicitly to async method since ThreadLocal context is lost
        self.executeWorkflowAsync(execution.getId(), orgId);

        return execution;
    }

    /**
     * Execute workflow asynchronously
     * SECURITY: organizationId must be passed explicitly because ThreadLocal TenantContext
     * is lost when executing in async thread pool
     */
    @Async
    public void executeWorkflowAsync(Long executionId, Long organizationId) {
        try {
            // SECURITY: Restore tenant context in async thread
            TenantContext.setCurrentTenant(organizationId);
            log.debug("Set tenant context for async workflow execution: orgId={}", organizationId);

            Thread.sleep(500); // Small delay to ensure transaction commits
            executeWorkflow(executionId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Workflow execution interrupted: {}", executionId);
        } finally {
            // SECURITY: Always clear context after async execution
            TenantContext.clear();
        }
    }

    /**
     * Load execution with all lazy relationships initialized (transactional)
     */
    @Transactional(readOnly = true)
    public CaseWorkflowExecution loadExecutionWithRelationships(Long executionId) {
        Long orgId = getRequiredOrganizationId();
        CaseWorkflowExecution execution = executionRepository.findByIdAndOrganizationId(executionId, orgId)
                .orElseThrow(() -> new ApiException("Workflow execution not found or access denied: " + executionId));

        // Force initialize lazy-loaded relationships within transaction
        if (execution.getTemplate() != null) {
            execution.getTemplate().getName();
            execution.getTemplate().getTemplateType();
            execution.getTemplate().getStepsConfig(); // Load steps config too
        }
        if (execution.getLegalCase() != null) {
            execution.getLegalCase().getId();
            execution.getLegalCase().getTitle();
        }
        if (execution.getCreatedBy() != null) {
            execution.getCreatedBy().getId();
            execution.getCreatedBy().getEmail();
        }

        return execution;
    }

    /**
     * Execute all steps in a workflow
     * Note: NOT transactional so each step save commits immediately (enables real-time progress updates)
     */
    public void executeWorkflow(Long executionId) {
        log.info("Executing workflow: {}", executionId);

        // Load execution with relationships in a transaction
        CaseWorkflowExecution execution = self.loadExecutionWithRelationships(executionId);

        // Update status to running
        execution.setStatus(WorkflowExecutionStatus.RUNNING);
        execution.setStartedAt(LocalDateTime.now());
        executionRepository.save(execution);

        // Get all steps
        List<CaseWorkflowStepExecution> steps = stepExecutionRepository
                .findByWorkflowExecutionIdOrderByStepNumber(executionId);

        // Execute each step
        for (CaseWorkflowStepExecution step : steps) {
            // Skip already completed steps (important for resume after ACTION)
            if (step.getStatus() == WorkflowExecutionStatus.COMPLETED) {
                log.info("Skipping already completed step {}: {}", step.getStepNumber(), step.getStepName());
                continue;
            }

            try {
                executeStep(step, execution);

                // Update progress
                execution.setCurrentStep(step.getStepNumber());
                execution.setProgressPercentage((step.getStepNumber() * 100) / execution.getTotalSteps());
                executionRepository.save(execution);

                // Check if step requires user action
                if (step.getStatus() == WorkflowExecutionStatus.WAITING_USER) {
                    execution.setStatus(WorkflowExecutionStatus.WAITING_USER);
                    executionRepository.save(execution);
                    log.info("Workflow {} paused at step {} waiting for user", executionId, step.getStepNumber());
                    return;
                }

            } catch (Exception e) {
                log.error("Error executing step {} in workflow {}: {}", step.getStepNumber(), executionId, e.getMessage());
                step.setStatus(WorkflowExecutionStatus.FAILED);
                step.setErrorMessage(e.getMessage());
                stepExecutionRepository.save(step);

                execution.setStatus(WorkflowExecutionStatus.FAILED);
                executionRepository.save(execution);
                return;
            }
        }

        // Mark workflow as completed
        execution.setStatus(WorkflowExecutionStatus.COMPLETED);
        execution.setCompletedAt(LocalDateTime.now());
        execution.setProgressPercentage(100);
        executionRepository.save(execution);

        log.info("Workflow {} completed successfully", executionId);
    }

    /**
     * Execute a single step based on its type
     */
    private void executeStep(CaseWorkflowStepExecution step, CaseWorkflowExecution execution) {
        log.info("Executing step {} ({}) - type: {}", step.getStepNumber(), step.getStepName(), step.getStepType());

        step.setStatus(WorkflowExecutionStatus.RUNNING);
        step.setStartedAt(LocalDateTime.now());
        stepExecutionRepository.save(step);

        Map<String, Object> outputData = new HashMap<>();

        switch (step.getStepType()) {
            case DISPLAY:
                outputData = executeDisplayStep(step, execution);
                break;
            case SYNTHESIS:
                outputData = executeSynthesisStep(step, execution);
                break;
            case GENERATION:
                outputData = executeGenerationStep(step, execution);
                break;
            case INTEGRATION:
                outputData = executeIntegrationStep(step, execution);
                break;
            case ACTION:
                executeActionStep(step, execution);
                return; // Action steps wait for user
        }

        step.setOutputData(outputData);
        step.setStatus(WorkflowExecutionStatus.COMPLETED);
        step.setCompletedAt(LocalDateTime.now());
        stepExecutionRepository.save(step);
    }

    /**
     * DISPLAY step - Query and display stored analysis data (no AI call)
     * Enhanced to include action items and timeline events
     */
    private Map<String, Object> executeDisplayStep(CaseWorkflowStepExecution step, CaseWorkflowExecution execution) {
        log.info("Executing DISPLAY step: {}", step.getStepName());

        Map<String, Object> inputData = step.getInputData();
        List<Long> documentIds = getDocumentIds(inputData);
        Map<String, Object> stepConfig = getStepConfig(inputData);
        String displayType = (String) stepConfig.getOrDefault("displayType", "analysis");

        // Gather analysis IDs for related data queries
        List<Long> analysisIds = new ArrayList<>();
        List<Map<String, Object>> analysisResults = new ArrayList<>();

        for (Long docId : documentIds) {
            try {
                var analysisOpt = documentAnalysisService.getAnalysisByDatabaseId(docId);
                if (analysisOpt.isPresent()) {
                    var analysis = analysisOpt.get();
                    analysisIds.add(analysis.getId());

                    Map<String, Object> analysisData = new HashMap<>();
                    analysisData.put("documentId", docId);
                    analysisData.put("analysisId", analysis.getId());
                    analysisData.put("fileName", analysis.getFileName() != null ? analysis.getFileName() : "Unknown");
                    analysisData.put("documentType", analysis.getDetectedType() != null ? analysis.getDetectedType() : "Unknown");
                    analysisData.put("summary", analysis.getSummary() != null ? analysis.getSummary() : "");
                    analysisData.put("keyFindings", analysis.getKeyFindings() != null ? analysis.getKeyFindings() : "");
                    analysisData.put("riskLevel", analysis.getRiskLevel() != null ? analysis.getRiskLevel() : "");
                    analysisResults.add(analysisData);
                }
            } catch (Exception e) {
                log.warn("Could not load analysis for document {}: {}", docId, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("stepType", "display");
        result.put("displayType", displayType);
        result.put("analysisCount", analysisResults.size());
        result.put("analyses", analysisResults);

        // Add action items if requested or for relevant step types
        if ("action_items".equals(displayType) || "timeline".equals(displayType) || "full".equals(displayType)) {
            try {
                // SECURITY: Use org-filtered query
                Long orgId = getRequiredOrganizationId();
                List<ActionItem> actionItems = actionItemRepository.findByOrganizationIdAndAnalysisIdInOrderByDeadlineAsc(orgId, analysisIds);
                List<Map<String, Object>> actionItemsList = actionItems.stream()
                        .map(item -> {
                            Map<String, Object> itemMap = new HashMap<>();
                            itemMap.put("id", item.getId());
                            itemMap.put("title", item.getDescription()); // ActionItem uses description as title
                            itemMap.put("description", item.getDescription());
                            itemMap.put("priority", item.getPriority());
                            itemMap.put("status", item.getStatus());
                            itemMap.put("deadline", item.getDeadline() != null ? item.getDeadline().toString() : null);
                            itemMap.put("category", item.getRelatedSection());
                            return itemMap;
                        })
                        .collect(Collectors.toList());
                result.put("actionItems", actionItemsList);
                result.put("actionItemCount", actionItemsList.size());
            } catch (Exception e) {
                log.warn("Could not load action items: {}", e.getMessage());
                result.put("actionItems", List.of());
                result.put("actionItemCount", 0);
            }
        }

        // Add timeline events if requested
        if ("timeline".equals(displayType) || "full".equals(displayType)) {
            try {
                List<TimelineEvent> timelineEvents = timelineEventRepository.findByAnalysisIdInOrderByEventDateAsc(analysisIds);
                List<Map<String, Object>> timelineList = timelineEvents.stream()
                        .map(event -> {
                            Map<String, Object> eventMap = new HashMap<>();
                            eventMap.put("id", event.getId());
                            eventMap.put("title", event.getTitle());
                            eventMap.put("description", event.getDescription());
                            eventMap.put("eventType", event.getEventType());
                            eventMap.put("eventDate", event.getEventDate() != null ? event.getEventDate().toString() : null);
                            eventMap.put("isDeadline", "DEADLINE".equals(event.getEventType()));
                            return eventMap;
                        })
                        .collect(Collectors.toList());
                result.put("timelineEvents", timelineList);
                result.put("timelineEventCount", timelineList.size());

                // Calculate upcoming deadlines
                List<Map<String, Object>> upcomingDeadlines = timelineList.stream()
                        .filter(e -> Boolean.TRUE.equals(e.get("isDeadline")))
                        .limit(5)
                        .collect(Collectors.toList());
                result.put("upcomingDeadlines", upcomingDeadlines);
            } catch (Exception e) {
                log.warn("Could not load timeline events: {}", e.getMessage());
                result.put("timelineEvents", List.of());
                result.put("timelineEventCount", 0);
            }
        }

        return result;
    }

    /**
     * SYNTHESIS step - Light AI aggregation across documents
     * Used for creating checklists, risk matrices, aggregated summaries
     */
    private Map<String, Object> executeSynthesisStep(CaseWorkflowStepExecution step, CaseWorkflowExecution execution) {
        log.info("Executing SYNTHESIS step: {}", step.getStepName());

        Map<String, Object> inputData = step.getInputData();
        List<Long> documentIds = getDocumentIds(inputData);
        Map<String, Object> stepConfig = getStepConfig(inputData);
        String synthesisType = (String) stepConfig.getOrDefault("synthesisType", "summary");

        // Gather document analysis data
        StringBuilder documentContext = new StringBuilder();
        documentContext.append("Documents analyzed:\n\n");

        for (Long docId : documentIds) {
            try {
                var analysisOpt = documentAnalysisService.getAnalysisByDatabaseId(docId);
                if (analysisOpt.isPresent()) {
                    var analysis = analysisOpt.get();
                    documentContext.append("--- Document: ").append(analysis.getFileName()).append(" ---\n");
                    documentContext.append("Type: ").append(analysis.getDetectedType()).append("\n");
                    documentContext.append("Summary: ").append(analysis.getSummary()).append("\n");
                    documentContext.append("Key Findings: ").append(analysis.getKeyFindings()).append("\n");
                    documentContext.append("Risk Level: ").append(analysis.getRiskLevel()).append("\n\n");
                }
            } catch (Exception e) {
                log.warn("Could not load analysis for document {}: {}", docId, e.getMessage());
            }
        }

        // Build prompt based on synthesis type
        String prompt = buildSynthesisPrompt(synthesisType, documentContext.toString(), step.getStepName());

        try {
            String aiResponse = claudeService.generateCompletion(prompt, false).get();

            // Save synthesis result as a draft session (so it appears in Drafting taskcard)
            String sessionName = getSynthesisSessionName(synthesisType, execution.getName());
            AiConversationSession session = AiConversationSession.builder()
                    .userId(execution.getCreatedBy().getId())
                    .sessionName(sessionName)
                    .sessionType("DRAFTING")
                    .taskType("GENERATE_DRAFT")
                    .documentType(synthesisType) // e.g., "evidence_checklist", "risk_matrix"
                    .caseId(execution.getLegalCase() != null ? execution.getLegalCase().getId() : null)
                    .workflowExecutionId(execution.getId())
                    .isActive(true)
                    .isPinned(false)
                    .isArchived(false)
                    .messageCount(1)
                    .build();
            session = conversationSessionRepository.save(session);

            // Create message with synthesis content
            AiConversationMessage message = AiConversationMessage.builder()
                    .session(session)
                    .role("assistant")
                    .content(aiResponse)
                    .modelUsed("claude-sonnet-4")
                    .ragContextUsed(true)
                    .build();
            conversationMessageRepository.save(message);

            log.info("Created synthesis session {} ({}) for workflow {}", session.getId(), synthesisType, execution.getId());

            Map<String, Object> result = new HashMap<>();
            result.put("stepType", "synthesis");
            result.put("synthesisType", synthesisType);
            result.put("content", aiResponse);
            result.put("documentCount", documentIds.size());
            result.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            result.put("sessionId", session.getId());
            result.put("sessionName", sessionName);
            result.put("message", sessionName + " created and available in Drafting");
            return result;

        } catch (Exception e) {
            log.error("AI synthesis failed: {}", e.getMessage());
            return Map.of(
                    "stepType", "synthesis",
                    "status", "error",
                    "error", e.getMessage()
            );
        }
    }

    /**
     * Get synthesis session name based on type
     */
    private String getSynthesisSessionName(String synthesisType, String workflowName) {
        String prefix = switch (synthesisType) {
            case "evidence_checklist" -> "Evidence Checklist";
            case "risk_matrix" -> "Risk Matrix";
            case "issue_summary" -> "Issue Summary";
            case "contract_summary" -> "Contract Summary";
            default -> "Synthesis";
        };
        return prefix + " - " + (workflowName != null ? workflowName : "Workflow");
    }

    /**
     * Build synthesis prompt based on type
     */
    private String buildSynthesisPrompt(String synthesisType, String documentContext, String stepName) {
        String baseInstruction = """
            You are a legal document analyst. Based on the following document analyses, provide a structured synthesis.
            Be concise, professional, and actionable. Use bullet points where appropriate.

            """;

        String specificInstruction = switch (synthesisType) {
            case "evidence_checklist" -> """
                Create an EVIDENCE CHECKLIST for litigation preparation:
                1. List all pieces of evidence mentioned or implied
                2. Categorize by type (documentary, testimonial, physical)
                3. Note collection status (obtained, needed, pending)
                4. Highlight critical evidence items
                5. Identify potential gaps in evidence

                Format as a structured checklist.
                """;
            case "risk_matrix" -> """
                Create a RISK ASSESSMENT MATRIX:
                1. Identify all risks mentioned across documents
                2. Categorize by type (legal, financial, operational, reputational)
                3. Rate each risk: Likelihood (High/Medium/Low) x Impact (High/Medium/Low)
                4. Suggest mitigation strategies for high-priority risks
                5. Provide overall risk score

                Format as a structured matrix.
                """;
            case "negotiation_priorities" -> """
                Create NEGOTIATION PRIORITIES analysis:
                1. Identify key terms and conditions across documents
                2. Highlight favorable vs unfavorable terms
                3. Rank negotiation priorities (must-have, nice-to-have, acceptable trade-offs)
                4. Suggest negotiation strategies
                5. Identify potential deal-breakers

                Format as prioritized recommendations.
                """;
            case "deadline_summary" -> """
                Create a DEADLINE AND TIMELINE SUMMARY:
                1. Extract all dates, deadlines, and time-sensitive items
                2. Organize chronologically
                3. Highlight critical deadlines (court dates, filing deadlines, response requirements)
                4. Calculate days remaining for upcoming deadlines
                5. Flag any potential conflicts or overlaps

                Format as a timeline with urgency indicators.
                """;
            default -> """
                Provide a COMPREHENSIVE SUMMARY:
                1. Key points from each document
                2. Common themes and patterns
                3. Critical issues identified
                4. Recommended next steps
                5. Areas requiring immediate attention

                Format as an executive summary.
                """;
        };

        return baseInstruction + specificInstruction + "\n\nDOCUMENT ANALYSES:\n" + documentContext;
    }

    /**
     * GENERATION step - Heavy AI content creation
     * Used for creating drafts, reports, redlines
     */
    private Map<String, Object> executeGenerationStep(CaseWorkflowStepExecution step, CaseWorkflowExecution execution) {
        log.info("Executing GENERATION step: {}", step.getStepName());

        Map<String, Object> inputData = step.getInputData();
        List<Long> documentIds = getDocumentIds(inputData);
        Map<String, Object> stepConfig = getStepConfig(inputData);
        String generationType = (String) stepConfig.getOrDefault("generationType", "report");

        // Gather document analysis data
        StringBuilder documentContext = new StringBuilder();
        for (Long docId : documentIds) {
            try {
                var analysisOpt = documentAnalysisService.getAnalysisByDatabaseId(docId);
                if (analysisOpt.isPresent()) {
                    var analysis = analysisOpt.get();
                    documentContext.append("--- Document: ").append(analysis.getFileName()).append(" ---\n");
                    documentContext.append("Type: ").append(analysis.getDetectedType()).append("\n");
                    documentContext.append("Summary: ").append(analysis.getSummary()).append("\n");
                    documentContext.append("Key Findings: ").append(analysis.getKeyFindings()).append("\n");
                    documentContext.append("Full Analysis: ").append(analysis.getAnalysisResult()).append("\n\n");
                }
            } catch (Exception e) {
                log.warn("Could not load analysis for document {}: {}", docId, e.getMessage());
            }
        }

        // Build generation prompt
        String prompt = buildGenerationPrompt(generationType, documentContext.toString(), step.getStepName());

        try {
            String aiResponse = claudeService.generateCompletion(prompt, true).get(); // Use deep thinking for generation

            Map<String, Object> result = new HashMap<>();
            result.put("stepType", "generation");
            result.put("generationType", generationType);
            result.put("content", aiResponse);
            result.put("documentCount", documentIds.size());
            result.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            return result;

        } catch (Exception e) {
            log.error("AI generation failed: {}", e.getMessage());
            return Map.of(
                    "stepType", "generation",
                    "status", "error",
                    "error", e.getMessage()
            );
        }
    }

    /**
     * Build generation prompt based on type
     */
    private String buildGenerationPrompt(String generationType, String documentContext, String stepName) {
        String baseInstruction = """
            You are an expert legal document drafter. Based on the following document analyses,
            generate high-quality legal content. Be thorough, professional, and cite relevant details.

            """;

        String specificInstruction = switch (generationType) {
            case "answer_draft" -> """
                Draft an ANSWER to the complaint:
                1. Use proper legal formatting with numbered paragraphs
                2. Admit, deny, or state insufficient knowledge for each allegation
                3. Include all applicable affirmative defenses
                4. Add any counterclaims if appropriate
                5. Include proper signature block and certificate of service placeholders

                Generate a complete, filing-ready draft.
                """;
            case "opposition_brief" -> """
                Draft an OPPOSITION BRIEF:
                1. Include proper caption and procedural posture
                2. State the standard of review
                3. Present factual background
                4. Develop legal arguments with case citations
                5. Include conclusion and requested relief

                Generate a complete opposition brief.
                """;
            case "due_diligence_report" -> """
                Generate a DUE DILIGENCE REPORT:
                1. Executive Summary
                2. Scope of Review and Methodology
                3. Key Findings by Category (Corporate, Contracts, Litigation, IP, Employment, etc.)
                4. Risk Assessment with severity ratings
                5. Recommendations and Next Steps
                6. Appendix of documents reviewed

                Generate a comprehensive DD report.
                """;
            case "contract_redlines" -> """
                Generate CONTRACT REDLINES with suggested modifications:
                1. Identify problematic clauses
                2. Propose alternative language (in redline format)
                3. Explain rationale for each change
                4. Flag non-negotiable vs. negotiable changes
                5. Prioritize changes by importance

                Format with clear before/after comparisons.
                """;
            case "discovery_responses" -> """
                Draft DISCOVERY RESPONSES:
                1. Use proper formatting for interrogatories/document requests
                2. Include appropriate objections where warranted
                3. Provide substantive responses
                4. Include document production lists
                5. Add privilege log entries if needed

                Generate response drafts for each discovery item.
                """;
            default -> """
                Generate a comprehensive LEGAL REPORT:
                1. Executive summary
                2. Background and context
                3. Analysis and findings
                4. Risk assessment
                5. Recommendations
                6. Conclusion

                Be thorough and professional.
                """;
        };

        return baseInstruction + specificInstruction + "\n\nDOCUMENT ANALYSES:\n" + documentContext;
    }

    /**
     * Build legal research prompt based on document context
     */
    private String buildLegalResearchPrompt(String documentContext, String researchQuery, String stepName) {
        String baseInstruction = """
            You are an expert legal research assistant. Based on the provided document analyses,
            conduct comprehensive legal research to support the case. Provide actionable insights
            with specific legal references where applicable.

            """;

        String specificInstruction = """
            Perform the following research tasks:

            1. **Case Law Analysis**
               - Identify relevant precedents and controlling authority
               - Note distinguishing factors and potential weaknesses
               - Cite specific cases with proper citations

            2. **Statutory Framework**
               - Identify applicable statutes and regulations
               - Note relevant amendments or pending changes
               - Include regulatory guidance if applicable

            3. **Legal Issues Identified**
               - List primary legal issues from the documents
               - Analyze strengths and weaknesses of each position
               - Identify potential arguments and counter-arguments

            4. **Strategic Recommendations**
               - Provide specific actionable recommendations
               - Prioritize by importance and urgency
               - Note any time-sensitive considerations

            5. **Research Gaps**
               - Identify areas requiring additional research
               - Note missing information that would strengthen analysis
               - Suggest follow-up research tasks

            Format your response with clear headings and bullet points for easy reference.
            Be thorough but concise - focus on actionable intelligence for legal strategy.

            """;

        String querySection = "";
        if (researchQuery != null && !researchQuery.isEmpty()) {
            querySection = "\n\nSPECIFIC RESEARCH FOCUS: " + researchQuery + "\n";
        }

        return baseInstruction + specificInstruction + querySection + "\n\nDOCUMENT ANALYSES:\n" + documentContext;
    }

    /**
     * INTEGRATION step - Create drafts/research via other services
     * Creates actual AiConversationSession or ResearchSession records
     */
    private Map<String, Object> executeIntegrationStep(CaseWorkflowStepExecution step, CaseWorkflowExecution execution) {
        log.info("Executing INTEGRATION step: {}", step.getStepName());

        Map<String, Object> inputData = step.getInputData();
        Map<String, Object> stepConfig = getStepConfig(inputData);
        String integrationType = (String) stepConfig.getOrDefault("integrationType", "draft");
        String generationType = (String) stepConfig.getOrDefault("generationType", "draft");

        Map<String, Object> result = new HashMap<>();
        result.put("stepType", "integration");
        result.put("integrationType", integrationType);

        switch (integrationType) {
            case "create_draft" -> {
                // Generate draft content via AI
                Map<String, Object> generationResult = executeGenerationStep(step, execution);
                String draftContent = (String) generationResult.get("content");

                // Create actual AiConversationSession record
                String sessionName = getDraftSessionName(generationType, execution.getName());
                AiConversationSession session = AiConversationSession.builder()
                        .userId(execution.getCreatedBy().getId())
                        .sessionName(sessionName)
                        .sessionType("DRAFTING")
                        .taskType("GENERATE_DRAFT")
                        .caseId(execution.getLegalCase() != null ? execution.getLegalCase().getId() : null)
                        .workflowExecutionId(execution.getId())
                        .isActive(true)
                        .isPinned(false)
                        .isArchived(false)
                        .messageCount(1)
                        .build();
                session = conversationSessionRepository.save(session);

                // Create initial message with generated content
                AiConversationMessage message = AiConversationMessage.builder()
                        .session(session)
                        .role("assistant")
                        .content(draftContent)
                        .modelUsed("claude-sonnet-4")
                        .ragContextUsed(true)
                        .build();
                conversationMessageRepository.save(message);

                log.info("Created draft session {} for workflow {}", session.getId(), execution.getId());

                result.put("draftContent", draftContent);
                result.put("sessionId", session.getId());
                result.put("sessionName", sessionName);
                result.put("status", "draft_created");
                result.put("message", "Draft created and available in Drafting");
            }
            case "legal_research" -> {
                // Perform actual legal research based on document context
                List<Long> documentIds = getDocumentIds(inputData);
                String researchQuery = (String) stepConfig.getOrDefault("researchQuery", "");

                // Build research context from documents
                StringBuilder documentContext = new StringBuilder();
                documentContext.append("Based on the following documents, perform comprehensive legal research:\n\n");

                for (Long docId : documentIds) {
                    try {
                        var analysisOpt = documentAnalysisService.getAnalysisByDatabaseId(docId);
                        if (analysisOpt.isPresent()) {
                            var analysis = analysisOpt.get();
                            documentContext.append("--- Document: ").append(analysis.getFileName()).append(" ---\n");
                            documentContext.append("Type: ").append(analysis.getDetectedType()).append("\n");
                            documentContext.append("Summary: ").append(analysis.getSummary()).append("\n");
                            documentContext.append("Key Findings: ").append(analysis.getKeyFindings()).append("\n\n");
                        }
                    } catch (Exception e) {
                        log.warn("Could not load analysis for document {}: {}", docId, e.getMessage());
                    }
                }

                // Build legal research prompt
                String researchPrompt = buildLegalResearchPrompt(documentContext.toString(), researchQuery, step.getStepName());

                try {
                    // Perform legal research via Claude
                    String researchContent = claudeService.generateCompletion(researchPrompt, true).get();

                    // Create research session record
                    String sessionName = "Research - " + (execution.getName() != null ? execution.getName() : "Workflow");
                    ResearchSession researchSession = ResearchSession.builder()
                            .sessionId(UUID.randomUUID().toString())
                            .userId(execution.getCreatedBy().getId())
                            .sessionName(sessionName)
                            .description("Legal research from workflow: " + execution.getTemplate().getName())
                            .workflowExecutionId(execution.getId())
                            .isActive(true)
                            .totalSearches(1)
                            .totalDocumentsViewed(documentIds.size())
                            .build();
                    researchSession = researchSessionRepository.save(researchSession);

                    log.info("Created research session {} with content for workflow {}", researchSession.getId(), execution.getId());

                    result.put("content", researchContent);
                    result.put("researchSessionId", researchSession.getId());
                    result.put("researchSessionUuid", researchSession.getSessionId());
                    result.put("sessionName", sessionName);
                    result.put("documentCount", documentIds.size());
                    result.put("status", "research_completed");
                    result.put("message", "Legal research completed - " + sessionName);
                } catch (Exception e) {
                    log.error("Legal research failed: {}", e.getMessage());
                    result.put("status", "error");
                    result.put("error", e.getMessage());
                    result.put("message", "Legal research failed: " + e.getMessage());
                }
            }
            default -> {
                result.put("status", "completed");
                result.put("message", "Integration step completed");
            }
        }

        result.put("completedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return result;
    }

    /**
     * Get draft session name based on generation type
     */
    private String getDraftSessionName(String generationType, String workflowName) {
        String prefix = switch (generationType) {
            case "answer_draft" -> "Draft Answer";
            case "opposition_brief" -> "Opposition Brief";
            case "due_diligence_report" -> "DD Report";
            case "contract_redlines" -> "Contract Redlines";
            case "discovery_responses" -> "Discovery Responses";
            default -> "Draft";
        };
        return prefix + " - " + (workflowName != null ? workflowName : "Workflow");
    }

    /**
     * ACTION step - Handle different action types (notify_team, approval, etc.)
     */
    private void executeActionStep(CaseWorkflowStepExecution step, CaseWorkflowExecution execution) {
        Map<String, Object> stepConfig = getStepConfig(step.getInputData());
        String actionType = (String) stepConfig.getOrDefault("actionType", "default");

        log.info("Executing ACTION step: {} - actionType: {}", step.getStepName(), actionType);

        Map<String, Object> outputData = new HashMap<>();
        outputData.put("stepType", "action");
        outputData.put("actionType", actionType);

        switch (actionType) {
            case "notify_team" -> {
                // Send notifications to all team members assigned to the case
                int notificationCount = sendTeamNotifications(execution, step);
                outputData.put("notificationsSent", notificationCount);
                outputData.put("message", notificationCount > 0
                        ? "Team members have been notified (" + notificationCount + " notifications sent)"
                        : "No team members to notify");
            }
            case "approval" -> {
                outputData.put("message", "Waiting for client/partner approval");
            }
            case "document_collection" -> {
                outputData.put("message", "Waiting for document collection");
            }
            case "export" -> {
                outputData.put("message", "Ready for export - select your format");
            }
            default -> {
                outputData.put("message", "This step requires user action to continue");
            }
        }

        outputData.put("status", "waiting_user");
        step.setStatus(WorkflowExecutionStatus.WAITING_USER);
        step.setOutputData(outputData);
        stepExecutionRepository.save(step);
    }

    /**
     * Send notifications to all team members assigned to the case
     * Returns the number of notifications sent
     */
    private int sendTeamNotifications(CaseWorkflowExecution execution, CaseWorkflowStepExecution step) {
        Long caseId = execution.getLegalCase() != null ? execution.getLegalCase().getId() : null;

        if (caseId == null) {
            log.warn("No case ID for team notification - skipping");
            return 0;
        }

        // Get all team members assigned to this case
        Long orgId = getRequiredOrganizationId();
        List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(caseId, orgId);

        if (assignments.isEmpty()) {
            log.info("No team members assigned to case {} for notification", caseId);
            return 0;
        }

        String title = "Workflow Review Required: " + execution.getName();
        String body = String.format("The workflow '%s' requires your review. Current step: %s",
                execution.getName(), step.getStepName());

        int notificationCount = 0;

        for (CaseAssignment assignment : assignments) {
            Long userId = assignment.getAssignedTo().getId();

            // Don't notify the user who created the workflow
            if (userId.equals(execution.getCreatedBy().getId())) {
                log.info("Skipping notification to workflow creator (user {})", userId);
                continue;
            }

            try {
                Map<String, Object> notificationData = new HashMap<>();
                notificationData.put("workflowId", execution.getId());
                notificationData.put("caseId", caseId);
                notificationData.put("stepName", step.getStepName());
                notificationData.put("workflowName", execution.getName());

                notificationService.sendCrmNotification(
                        title,
                        body,
                        userId,
                        "WORKFLOW_REVIEW",
                        notificationData
                );
                notificationCount++;
                log.info("Sent workflow notification to user {} ({})", userId, assignment.getAssignedTo().getFirstName());
            } catch (Exception e) {
                log.error("Failed to send notification to user {}: {}", userId, e.getMessage());
            }
        }

        log.info("Sent {} team notifications for workflow {} on case {}", notificationCount, execution.getId(), caseId);
        return notificationCount;
    }

    /**
     * Resume workflow after user action
     */
    @Transactional
    public void resumeWorkflow(Long executionId, Long stepId, Map<String, Object> userInput) {
        log.info("Resuming workflow {} from step {}", executionId, stepId);

        // SECURITY: Verify execution belongs to current organization first
        Long orgId = getRequiredOrganizationId();
        executionRepository.findByIdAndOrganizationId(executionId, orgId)
                .orElseThrow(() -> new ApiException("Workflow execution not found or access denied: " + executionId));

        // SECURITY: Use tenant-filtered query for step
        CaseWorkflowStepExecution step = stepExecutionRepository.findByIdAndOrganizationId(stepId, orgId)
                .filter(s -> s.getWorkflowExecution().getId().equals(executionId))
                .orElseThrow(() -> new ApiException("Step not found or does not belong to workflow: " + stepId));

        // Complete the action step
        step.setStatus(WorkflowExecutionStatus.COMPLETED);
        step.setCompletedAt(LocalDateTime.now());
        step.setOutputData(Map.of(
                "stepType", "action",
                "status", "completed",
                "userInput", userInput
        ));
        stepExecutionRepository.save(step);

        // Continue workflow execution via self-reference to trigger @Async proxy
        self.executeWorkflowAsync(executionId, orgId);
    }

    /**
     * Get workflow execution with all steps
     */
    @Transactional(readOnly = true)
    public CaseWorkflowExecution getExecutionWithSteps(Long executionId) {
        Long orgId = getRequiredOrganizationId();
        CaseWorkflowExecution execution = executionRepository.findByIdAndOrganizationId(executionId, orgId)
                .orElseThrow(() -> new ApiException("Workflow execution not found or access denied: " + executionId));

        List<CaseWorkflowStepExecution> steps = stepExecutionRepository
                .findByWorkflowExecutionIdOrderByStepNumber(executionId);
        execution.setStepExecutions(steps);

        // Force initialization of lazy-loaded template
        if (execution.getTemplate() != null) {
            execution.getTemplate().getName();
        }

        log.info("Returning execution {} with {} steps", executionId, steps.size());
        return execution;
    }

    // Helper methods

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractSteps(Map<String, Object> stepsConfig) {
        if (stepsConfig == null) return List.of();
        Object steps = stepsConfig.get("steps");
        if (steps instanceof List) {
            return (List<Map<String, Object>>) steps;
        }
        return List.of();
    }

    private WorkflowStepType parseStepType(String type) {
        if (type == null) return WorkflowStepType.DISPLAY;
        try {
            return WorkflowStepType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return WorkflowStepType.DISPLAY;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Long> getDocumentIds(Map<String, Object> inputData) {
        if (inputData == null) return List.of();
        Object docIds = inputData.get("documentIds");
        if (docIds instanceof List) {
            return ((List<?>) docIds).stream()
                    .map(id -> {
                        if (id instanceof Number) return ((Number) id).longValue();
                        if (id instanceof String) return Long.parseLong((String) id);
                        return null;
                    })
                    .filter(Objects::nonNull)
                    .toList();
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getStepConfig(Map<String, Object> inputData) {
        if (inputData == null) return Map.of();
        Object stepConfig = inputData.get("stepConfig");
        if (stepConfig instanceof Map) {
            return (Map<String, Object>) stepConfig;
        }
        return Map.of();
    }
}
