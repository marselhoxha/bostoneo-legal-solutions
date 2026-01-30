package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.WorkflowRecommendation;
import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowTemplate;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowExecution;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.CaseWorkflowTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.CaseWorkflowExecutionRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.CaseWorkflowExecutionService;
import com.bostoneo.bostoneosolutions.service.WorkflowRecommendationService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/ai/case-workflow")
@RequiredArgsConstructor
@Slf4j
public class CaseWorkflowController {

    private final CaseWorkflowTemplateRepository templateRepository;
    private final CaseWorkflowExecutionRepository executionRepository;
    private final CaseWorkflowExecutionService executionService;
    private final WorkflowRecommendationService recommendationService;
    private final UserRepository<User> userRepository;
    private final TenantService tenantService;
    private final AIDocumentAnalysisRepository documentAnalysisRepository;
    private final LegalCaseRepository legalCaseRepository;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @GetMapping("/templates")
    public ResponseEntity<HttpResponse> getWorkflowTemplates(Authentication authentication) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching workflow templates for org {}", orgId);
        // SECURITY: Return system templates + org-specific templates
        List<CaseWorkflowTemplate> templates = templateRepository.findByIsSystemTrueOrOrganizationId(orgId);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .data(Map.of("templates", templates))
                .message("Workflow templates retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    @GetMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> getWorkflowTemplate(@PathVariable Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching workflow template: {} for org {}", id, orgId);

        // SECURITY: Use proper tenant-filtered query instead of post-filter pattern
        var templateOpt = templateRepository.findByIdAndAccessibleByOrganization(id, orgId);
        if (templateOpt.isPresent()) {
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of("template", templateOpt.get()))
                    .message("Workflow template retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .message("Workflow template not found")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    @GetMapping("/executions")
    public ResponseEntity<HttpResponse> getUserExecutions(Authentication authentication) {
        Long orgId = getRequiredOrganizationId();
        Long userId = extractUserId(authentication);
        log.info("Fetching workflow executions for user: {} in org {}", userId, orgId);

        // SECURITY: Use tenant-filtered query
        List<CaseWorkflowExecution> executions;
        if (userId != null) {
            executions = executionRepository.findByOrganizationIdAndUserIdWithTemplateAndCase(orgId, userId);
        } else {
            // If no user ID, return all executions for the org
            executions = executionRepository.findByOrganizationIdWithTemplateAndCase(orgId);
        }

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .data(Map.of("executions", executions))
                .message("Workflow executions retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    @GetMapping("/executions/{id}")
    public ResponseEntity<HttpResponse> getExecution(@PathVariable Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching workflow execution: {} for org {}", id, orgId);

        // SECURITY: Use tenant-filtered query
        var executionOpt = executionRepository.findByIdAndOrganizationId(id, orgId);
        if (executionOpt.isPresent()) {
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of("execution", executionOpt.get()))
                    .message("Workflow execution retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .message("Workflow execution not found")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    @GetMapping("/executions/{id}/details")
    public ResponseEntity<HttpResponse> getExecutionWithSteps(@PathVariable Long id) {
        log.info("Fetching workflow execution with steps: {}", id);

        try {
            CaseWorkflowExecution execution = executionService.getExecutionWithSteps(id);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of("execution", execution))
                    .message("Workflow execution retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .message("Workflow execution not found: " + e.getMessage())
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }

    @PostMapping("/start")
    public ResponseEntity<HttpResponse> startWorkflow(
            @RequestBody Map<String, Object> request,
            Authentication authentication
    ) {
        log.info("Starting workflow with request: {}", request);

        try {
            Long templateId = parseLong(request.get("templateId"));
            Long collectionId = request.get("collectionId") != null
                    ? parseLong(request.get("collectionId")) : null;
            Long caseId = request.get("caseId") != null
                    ? parseLong(request.get("caseId")) : null;
            String name = request.get("name") != null
                    ? request.get("name").toString() : null;

            @SuppressWarnings("unchecked")
            List<?> docIdList = (List<?>) request.get("documentIds");
            List<Long> documentIds = docIdList.stream()
                    .map(this::parseLong)
                    .toList();

            // Get current user from authentication principal (can be UserDTO or UserPrincipal)
            User user = null;
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                UserDTO userDTO = (UserDTO) principal;
                user = userRepository.get(userDTO.getId());
            } else if (principal instanceof UserPrincipal) {
                user = ((UserPrincipal) principal).getUser();
            }
            if (user == null) {
                throw new RuntimeException("User not found from authentication");
            }

            CaseWorkflowExecution execution = executionService.startWorkflow(
                    templateId, collectionId, caseId, documentIds, user, name
            );

            return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of("execution", execution))
                    .message("Workflow started successfully")
                    .status(CREATED)
                    .statusCode(CREATED.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Failed to start workflow: {}", e.getMessage(), e);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .message("Failed to start workflow: " + e.getMessage())
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }

    @PostMapping("/executions/{executionId}/steps/{stepId}/resume")
    public ResponseEntity<HttpResponse> resumeWorkflow(
            @PathVariable Long executionId,
            @PathVariable Long stepId,
            @RequestBody Map<String, Object> userInput
    ) {
        log.info("Resuming workflow {} from step {}", executionId, stepId);

        try {
            executionService.resumeWorkflow(executionId, stepId, userInput);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .message("Workflow resumed successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .message("Failed to resume workflow: " + e.getMessage())
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }

    // =====================================================
    // WORKFLOW RECOMMENDATIONS
    // =====================================================

    /**
     * Get workflow recommendations for a specific case
     * Analyzes case deadlines, phase, and completed workflows to suggest next steps
     */
    @GetMapping("/recommendations/case/{caseId}")
    public ResponseEntity<HttpResponse> getRecommendationsForCase(@PathVariable Long caseId) {
        log.info("Fetching workflow recommendations for case: {}", caseId);

        try {
            List<WorkflowRecommendation> recommendations = recommendationService.getRecommendationsForCase(caseId);

            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of(
                        "recommendations", recommendations,
                        "count", recommendations.size(),
                        "caseId", caseId
                    ))
                    .message("Workflow recommendations retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Failed to get recommendations for case {}: {}", caseId, e.getMessage());
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .message("Failed to get recommendations: " + e.getMessage())
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }

    /**
     * Get workflow recommendations for all active cases in the organization
     * Returns recommendations sorted by urgency (most urgent first)
     */
    @GetMapping("/recommendations/all")
    public ResponseEntity<HttpResponse> getRecommendationsForAllCases() {
        log.info("Fetching workflow recommendations for all active cases");

        try {
            List<WorkflowRecommendation> recommendations = recommendationService.getRecommendationsForAllCases();

            // Group by urgency for summary
            long critical = recommendations.stream()
                    .filter(r -> r.getUrgency() == WorkflowRecommendation.Urgency.CRITICAL).count();
            long high = recommendations.stream()
                    .filter(r -> r.getUrgency() == WorkflowRecommendation.Urgency.HIGH).count();
            long medium = recommendations.stream()
                    .filter(r -> r.getUrgency() == WorkflowRecommendation.Urgency.MEDIUM).count();
            long low = recommendations.stream()
                    .filter(r -> r.getUrgency() == WorkflowRecommendation.Urgency.LOW).count();

            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of(
                        "recommendations", recommendations,
                        "count", recommendations.size(),
                        "summary", Map.of(
                            "critical", critical,
                            "high", high,
                            "medium", medium,
                            "low", low
                        )
                    ))
                    .message("Workflow recommendations retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Failed to get recommendations for all cases: {}", e.getMessage());
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .message("Failed to get recommendations: " + e.getMessage())
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }

    /**
     * Helper to parse Long from either Number or String
     */
    private Long parseLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            return Long.parseLong((String) value);
        }
        throw new IllegalArgumentException("Cannot parse Long from: " + value.getClass());
    }

    /**
     * Extract user ID from authentication principal
     */
    private Long extractUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDTO) {
            return ((UserDTO) principal).getId();
        } else if (principal instanceof UserPrincipal) {
            return ((UserPrincipal) principal).getUser().getId();
        }

        log.warn("Unknown principal type: {}", principal.getClass().getName());
        return null;
    }

    // =====================================================
    // CASE DOCUMENTS FOR WORKFLOW
    // =====================================================

    /**
     * Get analyzed documents for a case to use in workflow
     * Returns documents that have been analyzed and can be used as workflow input
     */
    @GetMapping("/case/{caseId}/documents")
    public ResponseEntity<HttpResponse> getCaseDocumentsForWorkflow(@PathVariable Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching analyzed documents for case {} in org {}", caseId, orgId);

        try {
            // Verify case exists and belongs to org
            LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                    .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));

            // Get analyzed documents for this case
            List<AIDocumentAnalysis> analyses = documentAnalysisRepository
                    .findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(orgId, caseId);

            // Filter to only completed analyses and map to simple DTOs
            List<Map<String, Object>> documents = analyses.stream()
                    .filter(a -> "completed".equals(a.getStatus()))
                    .map(a -> {
                        Map<String, Object> doc = new java.util.HashMap<>();
                        doc.put("id", a.getId());
                        doc.put("fileName", a.getFileName());
                        doc.put("detectedType", a.getDetectedType());
                        doc.put("analyzedAt", a.getCreatedAt() != null ?
                                a.getCreatedAt().toString() : null);
                        doc.put("riskLevel", a.getRiskLevel());
                        return doc;
                    })
                    .toList();

            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of(
                        "caseId", caseId,
                        "caseNumber", legalCase.getCaseNumber(),
                        "caseTitle", legalCase.getTitle(),
                        "documents", documents,
                        "hasDocuments", !documents.isEmpty()
                    ))
                    .message("Case documents retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Failed to get documents for case {}: {}", caseId, e.getMessage());
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .data(Map.of(
                        "caseId", caseId,
                        "documents", List.of(),
                        "hasDocuments", false
                    ))
                    .message("Failed to get case documents: " + e.getMessage())
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }
}
