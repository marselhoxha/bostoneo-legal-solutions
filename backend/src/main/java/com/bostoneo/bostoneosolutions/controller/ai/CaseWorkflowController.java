package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowTemplate;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowExecution;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.repository.CaseWorkflowTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.CaseWorkflowExecutionRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.CaseWorkflowExecutionService;
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
    private final UserRepository<User> userRepository;

    @GetMapping("/templates")
    public ResponseEntity<HttpResponse> getWorkflowTemplates(Authentication authentication) {
        log.info("Fetching workflow templates");
        List<CaseWorkflowTemplate> templates = templateRepository.findByIsSystemTrue();

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
        log.info("Fetching workflow template: {}", id);

        var templateOpt = templateRepository.findById(id);
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
        // TODO: Get user ID from authentication and filter by user
        log.info("Fetching user workflow executions");
        List<CaseWorkflowExecution> executions = executionRepository.findAllWithTemplateAndCase();

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
        log.info("Fetching workflow execution: {}", id);

        var executionOpt = executionRepository.findById(id);
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
}
