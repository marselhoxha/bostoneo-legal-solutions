package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.WorkflowRecommendation;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.enumeration.WorkflowTemplateType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for generating intelligent workflow recommendations based on case state.
 * Analyzes deadlines, case phases, and completed workflows to suggest next steps.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WorkflowRecommendationService {

    private final LegalCaseRepository legalCaseRepository;
    private final CaseTaskRepository caseTaskRepository;
    private final CaseTimelineProgressRepository timelineProgressRepository;
    private final CaseWorkflowExecutionRepository workflowExecutionRepository;
    private final CaseWorkflowTemplateRepository templateRepository;
    private final AIDocumentAnalysisRepository documentAnalysisRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

    /**
     * Get workflow recommendations for a specific case
     */
    @Transactional(readOnly = true)
    public List<WorkflowRecommendation> getRecommendationsForCase(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting workflow recommendations for caseId: {}, orgId: {}", caseId, orgId);

        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ApiException("Case not found: " + caseId));

        return generateRecommendations(legalCase, orgId);
    }

    /**
     * Get workflow recommendations for all active cases for the current user's organization
     */
    @Transactional(readOnly = true)
    public List<WorkflowRecommendation> getRecommendationsForAllCases() {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting workflow recommendations for all active cases, orgId: {}", orgId);

        // Get all active cases (OPEN status)
        List<LegalCase> activeCases = legalCaseRepository.findByOrganizationIdAndStatus(orgId, CaseStatus.OPEN);

        List<WorkflowRecommendation> allRecommendations = new ArrayList<>();
        for (LegalCase legalCase : activeCases) {
            List<WorkflowRecommendation> caseRecs = generateRecommendations(legalCase, orgId);
            allRecommendations.addAll(caseRecs);
        }

        // Sort by urgency and deadline
        allRecommendations.sort((a, b) -> {
            int urgencyCompare = compareUrgency(a.getUrgency(), b.getUrgency());
            if (urgencyCompare != 0) return urgencyCompare;

            // If same urgency, sort by days until deadline
            Integer daysA = a.getDaysUntilDeadline();
            Integer daysB = b.getDaysUntilDeadline();
            if (daysA != null && daysB != null) {
                return daysA.compareTo(daysB);
            }
            return 0;
        });

        log.info("Generated {} recommendations for {} active cases", allRecommendations.size(), activeCases.size());
        return allRecommendations;
    }

    private int compareUrgency(WorkflowRecommendation.Urgency a, WorkflowRecommendation.Urgency b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return a.ordinal() - b.ordinal();  // CRITICAL < HIGH < MEDIUM < LOW
    }

    /**
     * Generate recommendations for a single case
     */
    private List<WorkflowRecommendation> generateRecommendations(LegalCase legalCase, Long orgId) {
        List<WorkflowRecommendation> recommendations = new ArrayList<>();

        Long caseId = legalCase.getId();
        String caseNumber = legalCase.getCaseNumber();
        String caseTitle = legalCase.getTitle();

        // Get completed workflows for this case to avoid duplicate suggestions
        Set<String> completedTemplateTypes = getCompletedWorkflowTypes(caseId, orgId);

        // Get tasks to analyze deadlines
        List<CaseTask> tasks = caseTaskRepository.findByOrganizationIdAndCaseId(orgId, caseId);

        // Get current timeline phase
        String currentPhase = getCurrentPhase(caseId, orgId);

        // Load templates for recommendations
        Map<WorkflowTemplateType, CaseWorkflowTemplate> templates = loadTemplates(orgId);

        // Get document count for this case
        int documentCount = countCaseDocuments(caseId, orgId);

        // Rule 1: Complaint Response - if in response period or has answer deadline
        if (!completedTemplateTypes.contains("COMPLAINT_RESPONSE")) {
            checkComplaintResponseRecommendation(recommendations, legalCase, tasks, currentPhase, templates, caseNumber, caseTitle);
        }

        // Rule 2: Discovery Response - if has pending discovery tasks
        if (!completedTemplateTypes.contains("DISCOVERY_RESPONSE")) {
            checkDiscoveryResponseRecommendation(recommendations, legalCase, tasks, templates, caseNumber, caseTitle);
        }

        // Rule 3: Motion Opposition - if has motion-related tasks
        if (!completedTemplateTypes.contains("MOTION_OPPOSITION")) {
            checkMotionOppositionRecommendation(recommendations, legalCase, tasks, templates, caseNumber, caseTitle);
        }

        // Rule 4: Contract Review - if case type is contract-related
        if (!completedTemplateTypes.contains("CONTRACT_REVIEW")) {
            checkContractReviewRecommendation(recommendations, legalCase, templates, caseNumber, caseTitle);
        }

        // Rule 5: Due Diligence - if case type is transactional
        if (!completedTemplateTypes.contains("DUE_DILIGENCE")) {
            checkDueDiligenceRecommendation(recommendations, legalCase, templates, caseNumber, caseTitle);
        }

        // Enrich recommendations with document availability info
        enrichWithDocumentInfo(recommendations, templates, documentCount);

        log.debug("Generated {} recommendations for case {}", recommendations.size(), caseNumber);
        return recommendations;
    }

    /**
     * Count analyzed documents for a case
     */
    private int countCaseDocuments(Long caseId, Long orgId) {
        try {
            List<AIDocumentAnalysis> analyses = documentAnalysisRepository
                    .findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(orgId, caseId);
            return (int) analyses.stream()
                    .filter(a -> "completed".equals(a.getStatus()))
                    .count();
        } catch (Exception e) {
            log.warn("Could not count documents for case {}: {}", caseId, e.getMessage());
            return 0;
        }
    }

    /**
     * Enrich recommendations with document availability information
     */
    private void enrichWithDocumentInfo(
            List<WorkflowRecommendation> recommendations,
            Map<WorkflowTemplateType, CaseWorkflowTemplate> templates,
            int documentCount
    ) {
        for (WorkflowRecommendation rec : recommendations) {
            try {
                WorkflowTemplateType type = WorkflowTemplateType.valueOf(rec.getTemplateType());
                CaseWorkflowTemplate template = templates.get(type);

                if (template != null) {
                    boolean requiresDocs = template.requiresDocuments();
                    rec.setDocumentsRequired(requiresDocs);
                    rec.setAvailableDocuments(documentCount);
                    rec.setHasDocuments(documentCount > 0);
                } else {
                    // Default: assume documents are required
                    rec.setDocumentsRequired(true);
                    rec.setAvailableDocuments(documentCount);
                    rec.setHasDocuments(documentCount > 0);
                }
            } catch (Exception e) {
                log.warn("Could not enrich recommendation with doc info: {}", e.getMessage());
                rec.setDocumentsRequired(true);
                rec.setAvailableDocuments(0);
                rec.setHasDocuments(false);
            }
        }
    }

    private Set<String> getCompletedWorkflowTypes(Long caseId, Long orgId) {
        List<CaseWorkflowExecution> executions = workflowExecutionRepository
                .findByOrganizationIdAndLegalCaseId(orgId, caseId);

        return executions.stream()
                .filter(e -> e.getStatus() == WorkflowExecutionStatus.COMPLETED)
                .filter(e -> e.getTemplate() != null && e.getTemplate().getTemplateType() != null)
                .map(e -> e.getTemplate().getTemplateType().name())
                .collect(Collectors.toSet());
    }

    private String getCurrentPhase(Long caseId, Long orgId) {
        try {
            List<CaseTimelineProgress> phases = timelineProgressRepository
                    .findByOrganizationIdAndCaseIdOrderByPhaseOrderAsc(orgId, caseId);

            return phases.stream()
                    .filter(p -> p.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.IN_PROGRESS)
                    .map(CaseTimelineProgress::getPhaseName)
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not get current phase for case {}: {}", caseId, e.getMessage());
            return null;
        }
    }

    private Map<WorkflowTemplateType, CaseWorkflowTemplate> loadTemplates(Long orgId) {
        List<CaseWorkflowTemplate> templates = templateRepository.findByIsSystemTrueOrOrganizationId(orgId);

        Map<WorkflowTemplateType, CaseWorkflowTemplate> templateMap = new HashMap<>();
        for (CaseWorkflowTemplate template : templates) {
            if (template.getTemplateType() != null) {
                templateMap.put(template.getTemplateType(), template);
            }
        }
        return templateMap;
    }

    private void checkComplaintResponseRecommendation(
            List<WorkflowRecommendation> recommendations,
            LegalCase legalCase,
            List<CaseTask> tasks,
            String currentPhase,
            Map<WorkflowTemplateType, CaseWorkflowTemplate> templates,
            String caseNumber,
            String caseTitle
    ) {
        // Check if in response period phase
        boolean isResponsePhase = currentPhase != null &&
                (currentPhase.toLowerCase().contains("response") ||
                        currentPhase.toLowerCase().contains("answer") ||
                        currentPhase.toLowerCase().contains("pleading"));

        // Check for answer deadline tasks
        Optional<CaseTask> answerTask = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
                .filter(t -> t.getDueDate() != null)
                .filter(t -> {
                    String title = t.getTitle() != null ? t.getTitle().toLowerCase() : "";
                    return title.contains("answer") || title.contains("response") || title.contains("reply");
                })
                .min(Comparator.comparing(CaseTask::getDueDate));

        if (answerTask.isPresent() || isResponsePhase) {
            CaseWorkflowTemplate template = templates.get(WorkflowTemplateType.COMPLAINT_RESPONSE);
            if (template == null) return;

            LocalDate deadline = null;
            int daysUntil = 14;  // Default if no specific deadline

            if (answerTask.isPresent()) {
                deadline = answerTask.get().getDueDate().toLocalDate();
                daysUntil = (int) ChronoUnit.DAYS.between(LocalDate.now(), deadline);
            }

            String reason = answerTask.isPresent() ?
                    "Answer/Response due in " + daysUntil + " days" :
                    "Case is in " + currentPhase + " phase";

            recommendations.add(WorkflowRecommendation.fromDeadline(
                    WorkflowTemplateType.COMPLAINT_RESPONSE.name(),
                    template.getName(),
                    template.getId(),
                    legalCase.getId(),
                    caseNumber,
                    caseTitle,
                    reason,
                    deadline,
                    daysUntil
            ));
        }
    }

    private void checkDiscoveryResponseRecommendation(
            List<WorkflowRecommendation> recommendations,
            LegalCase legalCase,
            List<CaseTask> tasks,
            Map<WorkflowTemplateType, CaseWorkflowTemplate> templates,
            String caseNumber,
            String caseTitle
    ) {
        // Check for discovery-related tasks
        Optional<CaseTask> discoveryTask = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
                .filter(t -> t.getDueDate() != null)
                .filter(t -> {
                    String title = t.getTitle() != null ? t.getTitle().toLowerCase() : "";
                    return title.contains("discovery") || title.contains("interrogator") ||
                            title.contains("production") || title.contains("deposition");
                })
                .min(Comparator.comparing(CaseTask::getDueDate));

        if (discoveryTask.isPresent()) {
            CaseWorkflowTemplate template = templates.get(WorkflowTemplateType.DISCOVERY_RESPONSE);
            if (template == null) return;

            LocalDate deadline = discoveryTask.get().getDueDate().toLocalDate();
            int daysUntil = (int) ChronoUnit.DAYS.between(LocalDate.now(), deadline);

            recommendations.add(WorkflowRecommendation.fromDeadline(
                    WorkflowTemplateType.DISCOVERY_RESPONSE.name(),
                    template.getName(),
                    template.getId(),
                    legalCase.getId(),
                    caseNumber,
                    caseTitle,
                    "Discovery response due in " + daysUntil + " days",
                    deadline,
                    daysUntil
            ));
        }
    }

    private void checkMotionOppositionRecommendation(
            List<WorkflowRecommendation> recommendations,
            LegalCase legalCase,
            List<CaseTask> tasks,
            Map<WorkflowTemplateType, CaseWorkflowTemplate> templates,
            String caseNumber,
            String caseTitle
    ) {
        // Check for motion-related tasks
        Optional<CaseTask> motionTask = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
                .filter(t -> t.getDueDate() != null)
                .filter(t -> {
                    String title = t.getTitle() != null ? t.getTitle().toLowerCase() : "";
                    return title.contains("motion") || title.contains("opposition") ||
                            title.contains("summary judgment") || title.contains("dismiss");
                })
                .min(Comparator.comparing(CaseTask::getDueDate));

        if (motionTask.isPresent()) {
            CaseWorkflowTemplate template = templates.get(WorkflowTemplateType.MOTION_OPPOSITION);
            if (template == null) return;

            LocalDate deadline = motionTask.get().getDueDate().toLocalDate();
            int daysUntil = (int) ChronoUnit.DAYS.between(LocalDate.now(), deadline);

            recommendations.add(WorkflowRecommendation.fromDeadline(
                    WorkflowTemplateType.MOTION_OPPOSITION.name(),
                    template.getName(),
                    template.getId(),
                    legalCase.getId(),
                    caseNumber,
                    caseTitle,
                    "Motion response due in " + daysUntil + " days",
                    deadline,
                    daysUntil
            ));
        }
    }

    private void checkContractReviewRecommendation(
            List<WorkflowRecommendation> recommendations,
            LegalCase legalCase,
            Map<WorkflowTemplateType, CaseWorkflowTemplate> templates,
            String caseNumber,
            String caseTitle
    ) {
        String caseType = legalCase.getType() != null ? legalCase.getType().toLowerCase() : "";

        if (caseType.contains("contract") || caseType.contains("agreement") ||
                caseType.contains("negotiation") || caseType.contains("deal")) {

            CaseWorkflowTemplate template = templates.get(WorkflowTemplateType.CONTRACT_REVIEW);
            if (template == null) return;

            recommendations.add(WorkflowRecommendation.forPhase(
                    WorkflowTemplateType.CONTRACT_REVIEW.name(),
                    template.getName(),
                    template.getId(),
                    legalCase.getId(),
                    caseNumber,
                    caseTitle,
                    "Contract-related case may benefit from contract review workflow",
                    WorkflowRecommendation.Urgency.LOW
            ));
        }
    }

    private void checkDueDiligenceRecommendation(
            List<WorkflowRecommendation> recommendations,
            LegalCase legalCase,
            Map<WorkflowTemplateType, CaseWorkflowTemplate> templates,
            String caseNumber,
            String caseTitle
    ) {
        String caseType = legalCase.getType() != null ? legalCase.getType().toLowerCase() : "";

        if (caseType.contains("transaction") || caseType.contains("acquisition") ||
                caseType.contains("merger") || caseType.contains("due diligence") ||
                caseType.contains("corporate")) {

            CaseWorkflowTemplate template = templates.get(WorkflowTemplateType.DUE_DILIGENCE);
            if (template == null) return;

            recommendations.add(WorkflowRecommendation.forPhase(
                    WorkflowTemplateType.DUE_DILIGENCE.name(),
                    template.getName(),
                    template.getId(),
                    legalCase.getId(),
                    caseNumber,
                    caseTitle,
                    "Transactional case may benefit from due diligence workflow",
                    WorkflowRecommendation.Urgency.LOW
            ));
        }
    }
}
