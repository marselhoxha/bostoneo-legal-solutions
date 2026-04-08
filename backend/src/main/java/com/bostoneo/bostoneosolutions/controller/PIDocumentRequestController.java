package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.model.PIDocumentRequestTemplate;
import com.bostoneo.bostoneosolutions.repository.PIDocumentRequestTemplateRepository;
import com.bostoneo.bostoneosolutions.service.PIDocumentRequestService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST Controller for PI Document Request operations.
 * Handles recipient resolution, request sending, history, and templates.
 */
@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY', 'ROLE_PARALEGAL')")
@RestController
@RequestMapping("/api/pi")
@RequiredArgsConstructor
@Slf4j
public class PIDocumentRequestController {

    private final PIDocumentRequestService documentRequestService;
    private final PIDocumentRequestTemplateRepository templateRepository;
    private final ObjectMapper objectMapper;

    // ========================
    // Recipient Resolution
    // ========================

    /**
     * Resolve recipient for a document request based on document type.
     * Returns contact info resolved from medical records, case data, or provider directory.
     */
    @GetMapping("/cases/{caseId}/document-requests/{checklistItemId}/resolve-recipient")
    public ResponseEntity<Map<String, Object>> resolveRecipient(
            @PathVariable Long caseId,
            @PathVariable Long checklistItemId) {
        log.info("Resolving recipient for case: {}, checklist item: {}", caseId, checklistItemId);

        DocumentRecipientDTO recipient = documentRequestService.resolveRecipient(caseId, checklistItemId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "recipient", recipient
        ));
    }

    // ========================
    // Send Requests
    // ========================

    /**
     * Send a document request through the specified channel (Email/SMS).
     */
    @PostMapping("/cases/{caseId}/document-requests/{checklistItemId}/send")
    public ResponseEntity<Map<String, Object>> sendRequest(
            @PathVariable Long caseId,
            @PathVariable Long checklistItemId,
            @Valid @RequestBody SendDocumentRequestDTO request) {
        log.info("Sending document request for case: {}, checklist item: {}", caseId, checklistItemId);

        PIDocumentRequestLogDTO result = documentRequestService.sendRequest(caseId, checklistItemId, request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Request sent successfully",
                "requestLog", result
        ));
    }

    /**
     * Send bulk document requests for multiple checklist items.
     */
    @PostMapping("/cases/{caseId}/document-requests/bulk-send")
    public ResponseEntity<Map<String, Object>> sendBulkRequests(
            @PathVariable Long caseId,
            @Valid @RequestBody BulkDocumentRequestDTO bulkRequest) {
        log.info("Sending bulk document requests for case: {}", caseId);

        BulkDocumentRequestDTO result = documentRequestService.sendBulkRequests(caseId, bulkRequest);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", String.format("Bulk request complete. Success: %d, Failed: %d",
                        result.getSuccessCount(), result.getFailedCount()),
                "bulkResult", result
        ));
    }

    /**
     * Preview bulk document requests before sending.
     * Analyzes selected items, resolves recipients, and groups by recipient.
     */
    @PostMapping("/cases/{caseId}/document-requests/bulk-preview")
    public ResponseEntity<Map<String, Object>> previewBulkRequests(
            @PathVariable Long caseId,
            @RequestBody Map<String, Object> body) {
        log.info("Previewing bulk document requests for case: {}", caseId);

        @SuppressWarnings("unchecked")
        List<Integer> itemIds = (List<Integer>) body.get("checklistItemIds");
        List<Long> checklistItemIds = itemIds.stream()
                .map(Integer::longValue)
                .collect(java.util.stream.Collectors.toList());

        BulkRequestPreviewDTO preview = documentRequestService.previewBulkRequests(caseId, checklistItemIds);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "preview", preview
        ));
    }

    /**
     * Send confirmed bulk document requests with user overrides.
     * Groups items by recipient and sends consolidated communications.
     */
    @PostMapping("/cases/{caseId}/document-requests/bulk-send-confirmed")
    public ResponseEntity<Map<String, Object>> sendConfirmedBulkRequests(
            @PathVariable Long caseId,
            @Valid @RequestBody BulkRequestSubmitDTO submitRequest) {
        log.info("Sending confirmed bulk requests for case: {}", caseId);

        BulkRequestSubmitDTO.BulkSendResult result =
                documentRequestService.sendConfirmedBulkRequests(caseId, submitRequest);

        String message = String.format("Sent %d items (%d emails, %d SMS). Skipped: %d, Failed: %d",
                result.getSentCount(), result.getEmailsSent(), result.getSmsSent(),
                result.getSkippedCount(), result.getFailedCount());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", message,
                "result", result
        ));
    }

    // ========================
    // Request History
    // ========================

    /**
     * Get request history for a specific checklist item.
     */
    @GetMapping("/cases/{caseId}/document-requests/{checklistItemId}/history")
    public ResponseEntity<Map<String, Object>> getRequestHistory(
            @PathVariable Long caseId,
            @PathVariable Long checklistItemId) {
        log.info("Getting request history for case: {}, checklist item: {}", caseId, checklistItemId);

        List<PIDocumentRequestLogDTO> history = documentRequestService.getRequestHistory(caseId, checklistItemId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "history", history,
                "count", history.size()
        ));
    }

    /**
     * Get all request history for a case.
     */
    @GetMapping("/cases/{caseId}/document-requests/history")
    public ResponseEntity<Map<String, Object>> getCaseRequestHistory(@PathVariable Long caseId) {
        log.info("Getting all request history for case: {}", caseId);

        List<PIDocumentRequestLogDTO> history = documentRequestService.getCaseRequestHistory(caseId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "history", history,
                "count", history.size()
        ));
    }

    /**
     * Get request statistics for a case.
     */
    @GetMapping("/cases/{caseId}/document-requests/stats")
    public ResponseEntity<Map<String, Object>> getCaseRequestStats(@PathVariable Long caseId) {
        log.info("Getting request stats for case: {}", caseId);

        Map<String, Object> stats = documentRequestService.getCaseRequestStats(caseId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "stats", stats
        ));
    }

    // ========================
    // Templates
    // ========================

    /**
     * Get all available document request templates.
     */
    @GetMapping("/document-request-templates")
    public ResponseEntity<Map<String, Object>> getTemplates(
            @RequestParam(required = false) String documentType) {
        log.info("Getting document request templates. DocumentType: {}", documentType);

        List<PIDocumentRequestTemplateDTO> templates;
        if (documentType != null && !documentType.isEmpty()) {
            templates = documentRequestService.getTemplatesByDocumentType(documentType);
        } else {
            templates = documentRequestService.getTemplates();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "templates", templates,
                "count", templates.size()
        ));
    }

    /**
     * Get a specific template by ID.
     */
    @GetMapping("/document-request-templates/{templateId}")
    public ResponseEntity<Map<String, Object>> getTemplateById(@PathVariable Long templateId) {
        log.info("Getting template by ID: {}", templateId);

        PIDocumentRequestTemplateDTO template = documentRequestService.getTemplateById(templateId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "template", template
        ));
    }

    /**
     * Preview a template with variables replaced.
     */
    @GetMapping("/cases/{caseId}/document-requests/{checklistItemId}/preview-template/{templateId}")
    public ResponseEntity<Map<String, Object>> previewTemplate(
            @PathVariable Long caseId,
            @PathVariable Long checklistItemId,
            @PathVariable Long templateId) {
        log.info("Previewing template {} for case: {}, item: {}", templateId, caseId, checklistItemId);

        PIDocumentRequestTemplateDTO preview = documentRequestService.previewTemplate(templateId, caseId, checklistItemId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "template", preview
        ));
    }

    // ========================
    // Fee Tracking
    // ========================

    /**
     * Update fee status for a request log entry.
     */
    @PatchMapping("/document-request-logs/{requestLogId}/fee-status")
    public ResponseEntity<Map<String, Object>> updateFeeStatus(
            @PathVariable Long requestLogId,
            @RequestBody Map<String, String> body) {
        String feeStatus = body.get("feeStatus");
        log.info("Updating fee status for request log: {} to: {}", requestLogId, feeStatus);

        PIDocumentRequestLogDTO updated = documentRequestService.updateFeeStatus(requestLogId, feeStatus);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Fee status updated",
                "requestLog", updated
        ));
    }

    // ========================
    // Admin: Seed Templates
    // ========================

    @PreAuthorize("hasAnyRole('ROLE_SYSADMIN', 'ROLE_ADMIN', 'ROLE_MANAGING_PARTNER')")
    @PostMapping("/admin/seed-document-templates")
    public ResponseEntity<Map<String, Object>> seedDocumentTemplates() {
        log.info("Seeding document request templates from classpath resource");
        try {
            InputStream is = new ClassPathResource("data/document-request-templates.json").getInputStream();
            List<Map<String, Object>> templateDataList = objectMapper.readValue(is, new TypeReference<>() {});

            List<String> created = new ArrayList<>();
            List<String> skipped = new ArrayList<>();

            for (Map<String, Object> data : templateDataList) {
                String code = (String) data.get("template_code");
                boolean exists = templateRepository.existsByOrganizationIdAndTemplateCode(null, code);
                if (exists) {
                    skipped.add(code);
                    continue;
                }

                PIDocumentRequestTemplate template = PIDocumentRequestTemplate.builder()
                        .organizationId(null)
                        .templateCode(code)
                        .templateName((String) data.get("template_name"))
                        .documentType((String) data.get("document_type"))
                        .recipientType((String) data.get("recipient_type"))
                        .emailSubject((String) data.get("email_subject"))
                        .emailBody((String) data.get("email_body"))
                        .smsBody((String) data.get("sms_body"))
                        .isActive(true)
                        .isSystem(true)
                        .build();
                templateRepository.save(template);
                created.add(code);
            }

            log.info("Template seeding complete. Created: {}, Skipped: {}", created.size(), skipped.size());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", String.format("Seeded %d templates, skipped %d existing", created.size(), skipped.size()),
                    "created", created,
                    "skipped", skipped
            ));
        } catch (Exception e) {
            log.error("Failed to seed templates", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to seed templates: " + e.getMessage()
            ));
        }
    }
}
