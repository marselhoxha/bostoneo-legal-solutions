package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.AITemplateVariableRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/ai/documents")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class AIDocumentController {

    private final ClaudeSonnet4Service claudeService;
    private final AILegalTemplateRepository templateRepository;
    private final AITemplateVariableRepository variableRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID
     */
    private Long getOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    @PostMapping("/generate")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateDocument(@RequestBody Map<String, Object> request) {
        log.info("Generating document with Claude AI: {}", request);

        // Set timeout to 60 seconds (Claude can take time)
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);

        // Extract template ID and variables
        Long templateId = null;
        try {
            Object templateIdObj = request.get("templateId");
            if (templateIdObj instanceof Number) {
                templateId = ((Number) templateIdObj).longValue();
            } else if (templateIdObj instanceof String) {
                templateId = Long.parseLong(templateIdObj.toString());
            }
        } catch (Exception e) {
            log.error("Invalid template ID: {}", request.get("templateId"));
        }

        Map<String, Object> variables = (Map<String, Object>) request.get("variables");

        // SECURITY: Get template and its variables from database with tenant filtering
        AILegalTemplate template = null;
        List<AITemplateVariable> templateVariables = null;
        if (templateId != null) {
            Long orgId = getOrganizationId();
            // SECURITY: Require organization context - no fallback to unfiltered query
            if (orgId == null) {
                log.warn("SECURITY: Template access attempted without organization context");
                // Continue without template - will use generic prompt
            } else {
                // Use tenant-filtered query - allows access to own org templates OR public approved templates
                template = templateRepository.findByIdAndAccessibleByOrganization(templateId, orgId).orElse(null);
                if (template != null) {
                    templateVariables = variableRepository.findByTemplateIdOrderByDisplayOrder(templateId);
                }
            }
        }

        String prompt = buildPromptWithTemplate(template, templateVariables, variables);

        claudeService.generateCompletion(prompt, false)
                .thenApply(response -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("id", System.currentTimeMillis());
                    result.put("documentUrl", "/documents/generated-" + System.currentTimeMillis() + ".pdf");
                    result.put("status", "COMPLETED");
                    result.put("generatedAt", System.currentTimeMillis());
                    result.put("processingTimeMs", 2000);
                    result.put("tokensUsed", 1500);
                    result.put("costEstimate", 0.05);
                    result.put("content", response);
                    return ResponseEntity.ok(result);
                })
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Error generating document: {}", ex.getMessage(), ex);
                        Map<String, Object> error = new HashMap<>();
                        error.put("status", "FAILED");
                        error.put("error", ex.getMessage());
                        deferredResult.setResult(ResponseEntity.status(500).body(error));
                    } else {
                        deferredResult.setResult(result);
                    }
                });
        
        // Set timeout fallback
        deferredResult.onTimeout(() -> {
            log.warn("Document generation request timed out");
            Map<String, Object> error = new HashMap<>();
            error.put("status", "FAILED");
            error.put("error", "Request timed out");
            deferredResult.setResult(ResponseEntity.status(408).body(error));
        });
        
        return deferredResult;
    }

    private String buildPromptWithTemplate(AILegalTemplate template,
                                           List<AITemplateVariable> templateVariables,
                                           Map<String, Object> userVariables) {

        if (template == null) {
            // Fallback to generic prompt if no template found
            return buildGenericPrompt(userVariables);
        }

        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("Generate a professional legal document based on the following template:\n\n");

        // Template Information
        promptBuilder.append("TEMPLATE: ").append(template.getName()).append("\n");
        promptBuilder.append("CATEGORY: ").append(template.getCategory()).append("\n");
        if (template.getPracticeArea() != null) {
            promptBuilder.append("PRACTICE AREA: ").append(template.getPracticeArea()).append("\n");
        }
        promptBuilder.append("JURISDICTION: ").append(template.getJurisdiction()).append("\n\n");

        // Template Content Structure if available
        if (template.getTemplateContent() != null && !template.getTemplateContent().isEmpty()) {
            promptBuilder.append("TEMPLATE STRUCTURE:\n");
            promptBuilder.append(template.getTemplateContent()).append("\n\n");
        }

        // Fill in template variables with user provided values
        promptBuilder.append("VARIABLE VALUES:\n");
        if (templateVariables != null && !templateVariables.isEmpty()) {
            for (AITemplateVariable var : templateVariables) {
                String varName = var.getVariableName();
                Object value = userVariables.get(varName);
                if (value != null && !value.toString().trim().isEmpty()) {
                    String displayName = var.getDisplayName() != null ? var.getDisplayName() : varName;
                    promptBuilder.append("- ").append(displayName).append(": ").append(value).append("\n");
                }
            }
        } else {
            // Fallback to all provided variables
            for (Map.Entry<String, Object> entry : userVariables.entrySet()) {
                if (entry.getValue() != null && !entry.getValue().toString().trim().isEmpty()) {
                    promptBuilder.append("- ").append(entry.getKey().replace("_", " "))
                                 .append(": ").append(entry.getValue()).append("\n");
                }
            }
        }

        // AI Prompt Structure if available
        if (template.getAiPromptStructure() != null) {
            promptBuilder.append("\n").append(template.getAiPromptStructure()).append("\n");
        }

        // Massachusetts-specific instructions
        if (Boolean.TRUE.equals(template.getMaJurisdictionSpecific())) {
            promptBuilder.append("\nMASSACHUSETTS-SPECIFIC REQUIREMENTS:\n");
            promptBuilder.append("1. Follow Massachusetts Rules of Civil Procedure\n");
            promptBuilder.append("2. Use proper Massachusetts statutory citations (M.G.L. format)\n");
            promptBuilder.append("3. Include appropriate Massachusetts court formatting\n");
            promptBuilder.append("4. Reference relevant Massachusetts case law where applicable\n");
        }

        // General instructions
        promptBuilder.append("\nGENERAL INSTRUCTIONS:\n");
        promptBuilder.append("1. Replace ALL placeholder fields with the actual values provided above\n");
        promptBuilder.append("2. Generate a properly formatted legal document with standard legal formatting\n");
        promptBuilder.append("3. Use plain text formatting with proper spacing and alignment\n");
        promptBuilder.append("4. Include proper headers, numbered paragraphs, and signature lines\n");
        promptBuilder.append("5. Follow standard legal document structure and conventions\n");
        promptBuilder.append("6. Use Times New Roman 12pt equivalent spacing and formatting\n");
        promptBuilder.append("7. Ensure document is court-ready and professionally formatted\n");
        promptBuilder.append("8. Do NOT use HTML tags or markup - use plain text with proper spacing\n");
        promptBuilder.append("9. Maintain consistency in party names and case information throughout\n");

        return promptBuilder.toString();
    }

    private String buildGenericPrompt(Map<String, Object> variables) {
        // Extract case information from variables
        String clientName = (String) variables.getOrDefault("client_name", "Client Name");
        String caseNumber = (String) variables.getOrDefault("case_number", "CASE-NUMBER");
        String caseType = (String) variables.getOrDefault("case_type", "General Legal");
        String caseBackground = (String) variables.getOrDefault("case_background", "");
        String legalStandard = (String) variables.getOrDefault("legal_standard", "");
        String legalAnalysis = (String) variables.getOrDefault("legal_analysis", "");
        String courtName = (String) variables.getOrDefault("court_name", "");
        String judgeName = (String) variables.getOrDefault("judge_name", "");
        String filingDate = (String) variables.getOrDefault("filing_date", "");
        String attorneyName = (String) variables.getOrDefault("attorney_name", "Attorney Name");
        String attorneyTitle = (String) variables.getOrDefault("attorney_title", "Attorney for Client");

        return String.format("""
            Generate a professional Massachusetts legal document using PLAIN TEXT formatting only:

            DOCUMENT TYPE: Legal Document

            CLIENT INFORMATION:
            - Client Name: %s
            - Case Number: %s
            - Case Type: %s
            - Court: %s
            - Judge: %s
            - Filing Date: %s

            CASE DETAILS:
            Case Background: %s

            Legal Standard: %s

            Legal Analysis: %s

            ATTORNEY INFORMATION:
            - Attorney Name: %s
            - Attorney Title: %s

            INSTRUCTIONS:
            1. Use the EXACT client name "%s" throughout the document
            2. Use the EXACT case number "%s" in all case references
            3. Replace placeholder fields like [CLIENT_NAME], [CASE_NUMBER], [COURT_NAME] with actual values
            4. Ensure professional legal formatting appropriate for Massachusetts courts
            5. Include proper citations and references for Massachusetts law
            6. Make the document court-ready and professionally formatted
            7. Use case-specific information provided above instead of generic placeholders
            8. Adapt the content to the specific case type: %s
            9. Use PLAIN TEXT with proper spacing and line breaks - NO HTML tags
            10. Format like a traditional legal document with proper headers and paragraph numbering

            Generate a complete, properly formatted legal document with all placeholder fields filled with the actual case information provided.
            """,
            clientName, caseNumber, caseType, courtName, judgeName, filingDate,
            caseBackground,
            legalStandard,
            legalAnalysis,
            attorneyName, attorneyTitle,
            clientName, caseNumber, caseType
        );
    }
}