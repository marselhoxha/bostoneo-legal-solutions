package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.SignatureTemplate;
import com.bostoneo.bostoneosolutions.repository.SignatureTemplateRepository;
import com.bostoneo.bostoneosolutions.service.BoldSignService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/signatures")
@RequiredArgsConstructor
@Slf4j
public class SignatureController {

    private final BoldSignService boldSignService;
    private final SignatureTemplateRepository signatureTemplateRepository;

    // ==================== Signature Requests ====================

    /**
     * Create and send a new signature request
     */
    @PostMapping("/requests")
    public ResponseEntity<HttpResponse> createSignatureRequest(
            @Valid @RequestBody CreateSignatureRequestDTO request,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Creating signature request for organization {}", request.getOrganizationId());

        SignatureRequestDTO result;
        if (Boolean.TRUE.equals(request.getSendImmediately())) {
            result = boldSignService.createSignatureRequest(request, user.getId());
        } else {
            result = boldSignService.createDraftSignatureRequest(request, user.getId());
        }

        return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signatureRequest", result))
                        .message("Signature request created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build()
        );
    }

    /**
     * Send a draft signature request
     */
    @PostMapping("/requests/{id}/send")
    public ResponseEntity<HttpResponse> sendSignatureRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Sending signature request {}", id);
        SignatureRequestDTO result = boldSignService.sendSignatureRequest(id, user.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signatureRequest", result))
                        .message("Signature request sent successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get signature request by ID
     */
    @GetMapping("/requests/{id}")
    public ResponseEntity<HttpResponse> getSignatureRequest(@PathVariable Long id) {
        SignatureRequestDTO result = boldSignService.getSignatureRequest(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signatureRequest", result))
                        .message("Signature request retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get all signature requests for an organization
     */
    @GetMapping("/requests/organization/{organizationId}")
    public ResponseEntity<HttpResponse> getSignatureRequestsByOrganization(
            @PathVariable Long organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Page<SignatureRequestDTO> result = boldSignService.getSignatureRequestsByOrganization(
                organizationId, PageRequest.of(page, size, sort));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "signatureRequests", result.getContent(),
                                "page", result.getNumber(),
                                "totalPages", result.getTotalPages(),
                                "totalElements", result.getTotalElements()
                        ))
                        .message("Signature requests retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get signature requests for a case
     */
    @GetMapping("/requests/case/{caseId}")
    public ResponseEntity<HttpResponse> getSignatureRequestsByCase(
            @PathVariable Long caseId,
            @RequestParam Long organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<SignatureRequestDTO> result = boldSignService.getSignatureRequestsByCase(
                caseId, organizationId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "signatureRequests", result.getContent(),
                                "page", result.getNumber(),
                                "totalPages", result.getTotalPages(),
                                "totalElements", result.getTotalElements()
                        ))
                        .message("Signature requests for case retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get signature requests for a client
     */
    @GetMapping("/requests/client/{clientId}")
    public ResponseEntity<HttpResponse> getSignatureRequestsByClient(
            @PathVariable Long clientId,
            @RequestParam Long organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<SignatureRequestDTO> result = boldSignService.getSignatureRequestsByClient(
                clientId, organizationId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "signatureRequests", result.getContent(),
                                "page", result.getNumber(),
                                "totalPages", result.getTotalPages(),
                                "totalElements", result.getTotalElements()
                        ))
                        .message("Signature requests for client retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Search signature requests
     */
    @GetMapping("/requests/search")
    public ResponseEntity<HttpResponse> searchSignatureRequests(
            @RequestParam Long organizationId,
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<SignatureRequestDTO> result = boldSignService.searchSignatureRequests(
                organizationId, query, PageRequest.of(page, size, Sort.by("createdAt").descending()));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "signatureRequests", result.getContent(),
                                "page", result.getNumber(),
                                "totalPages", result.getTotalPages(),
                                "totalElements", result.getTotalElements()
                        ))
                        .message("Search results")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Void/cancel a signature request
     */
    @PostMapping("/requests/{id}/void")
    public ResponseEntity<HttpResponse> voidSignatureRequest(
            @PathVariable Long id,
            @RequestParam String reason,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Voiding signature request {}", id);
        SignatureRequestDTO result = boldSignService.voidSignatureRequest(id, reason, user.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signatureRequest", result))
                        .message("Signature request voided")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Send reminder for a signature request
     */
    @PostMapping("/requests/{id}/remind")
    public ResponseEntity<HttpResponse> sendReminder(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Sending reminder for signature request {}", id);
        SignatureRequestDTO result = boldSignService.sendReminder(id, user.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signatureRequest", result))
                        .message("Reminder sent successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get embedded signing URL
     */
    @GetMapping("/requests/{id}/signing-url")
    public ResponseEntity<HttpResponse> getEmbeddedSigningUrl(
            @PathVariable Long id,
            @RequestParam String signerEmail) {

        String url = boldSignService.getEmbeddedSigningUrl(id, signerEmail);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signingUrl", url))
                        .message("Signing URL retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Download signed document
     */
    @GetMapping("/requests/{id}/download")
    public ResponseEntity<byte[]> downloadSignedDocument(@PathVariable Long id) {
        byte[] document = boldSignService.downloadSignedDocument(id);
        SignatureRequestDTO request = boldSignService.getSignatureRequest(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment",
                request.getFileName() != null ? request.getFileName() : "signed-document.pdf");

        return new ResponseEntity<>(document, headers, OK);
    }

    /**
     * Refresh status from BoldSign
     */
    @PostMapping("/requests/{id}/refresh")
    public ResponseEntity<HttpResponse> refreshStatus(@PathVariable Long id) {
        SignatureRequestDTO result = boldSignService.refreshStatus(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("signatureRequest", result))
                        .message("Status refreshed")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== Templates ====================

    /**
     * Get all templates for an organization
     */
    @GetMapping("/templates/organization/{organizationId}")
    public ResponseEntity<HttpResponse> getTemplates(@PathVariable Long organizationId) {
        List<SignatureTemplateDTO> templates = boldSignService.getTemplatesForOrganization(organizationId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("templates", templates))
                        .message("Templates retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get templates by category
     */
    @GetMapping("/templates/organization/{organizationId}/category/{category}")
    public ResponseEntity<HttpResponse> getTemplatesByCategory(
            @PathVariable Long organizationId,
            @PathVariable String category) {

        List<SignatureTemplateDTO> templates = boldSignService.getTemplatesByCategory(organizationId, category);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("templates", templates))
                        .message("Templates retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get template by ID
     */
    @GetMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> getTemplate(@PathVariable Long id) {
        SignatureTemplateDTO template = boldSignService.getTemplate(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("template", template))
                        .message("Template retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Create a new template
     */
    @PostMapping("/templates")
    public ResponseEntity<HttpResponse> createTemplate(
            @Valid @RequestBody SignatureTemplateDTO template,
            @AuthenticationPrincipal UserDTO user) {

        SignatureTemplateDTO result = boldSignService.createTemplate(template, user.getId());

        return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("template", result))
                        .message("Template created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build()
        );
    }

    /**
     * Update a template
     */
    @PutMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> updateTemplate(
            @PathVariable Long id,
            @RequestBody SignatureTemplateDTO template) {

        SignatureTemplateDTO result = boldSignService.updateTemplate(id, template);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("template", result))
                        .message("Template updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Delete a template
     */
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> deleteTemplate(@PathVariable Long id) {
        boldSignService.deleteTemplate(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .message("Template deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get template categories
     */
    @GetMapping("/templates/categories/{organizationId}")
    public ResponseEntity<HttpResponse> getTemplateCategories(@PathVariable Long organizationId) {
        List<String> categories = boldSignService.getTemplateCategories(organizationId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("categories", categories))
                        .message("Categories retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== Audit Logs ====================

    /**
     * Get audit logs for a signature request
     */
    @GetMapping("/requests/{id}/audit")
    public ResponseEntity<HttpResponse> getAuditLogs(@PathVariable Long id) {
        List<SignatureAuditLogDTO> logs = boldSignService.getAuditLogs(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("auditLogs", logs))
                        .message("Audit logs retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get audit logs for an organization
     */
    @GetMapping("/audit/organization/{organizationId}")
    public ResponseEntity<HttpResponse> getAuditLogsByOrganization(
            @PathVariable Long organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Page<SignatureAuditLogDTO> result = boldSignService.getAuditLogsByOrganization(
                organizationId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "auditLogs", result.getContent(),
                                "page", result.getNumber(),
                                "totalPages", result.getTotalPages(),
                                "totalElements", result.getTotalElements()
                        ))
                        .message("Audit logs retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== Embedded URLs ====================

    /**
     * Get embedded URL for document preparation (full BoldSign UI)
     * This also creates a SignatureRequest record in SENT status
     */
    @PostMapping("/embedded/send-document")
    public ResponseEntity<HttpResponse> getEmbeddedSendDocumentUrl(
            @AuthenticationPrincipal UserDTO user,
            @RequestBody EmbeddedSendRequestDTO request) {

        log.info("Creating embedded send document URL for organization {} by user {}", request.getOrganizationId(), user.getId());

        // Parse caseId from String to Long if provided
        Long caseId = null;
        if (request.getCaseId() != null && !request.getCaseId().isEmpty()) {
            try {
                caseId = Long.parseLong(request.getCaseId());
            } catch (NumberFormatException e) {
                log.warn("Invalid caseId format: {}", request.getCaseId());
            }
        }

        var options = new BoldSignService.EmbeddedRequestOptions(
                request.getOrganizationId(),
                request.getTitle(),
                request.getSignerName(),
                request.getSignerEmail(),
                request.getMessage(),
                request.getFileName(),
                request.getFileBase64(),
                request.getRedirectUrl(),
                request.getShowToolbar() != null ? request.getShowToolbar() : true,
                request.getShowSendButton() != null ? request.getShowSendButton() : true,
                request.getShowSaveButton() != null ? request.getShowSaveButton() : true,
                request.getShowPreviewButton() != null ? request.getShowPreviewButton() : true,
                request.getShowNavigationButtons() != null ? request.getShowNavigationButtons() : true,
                request.getSendViewOption() != null ? request.getSendViewOption() : "PreparePage",
                request.getLocale() != null ? request.getLocale() : "EN",
                7,    // linkValidForDays
                user.getId(),  // createdBy
                request.getClientId(),  // clientId
                caseId  // caseId
        );

        BoldSignService.EmbeddedUrlDTO result = boldSignService.getEmbeddedSendDocumentUrl(options);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("embedded", result))
                        .message("Embedded send document URL generated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get embedded URL for template creation (GET - uses placeholder PDF)
     */
    @GetMapping("/embedded/create-template")
    public ResponseEntity<HttpResponse> getEmbeddedCreateTemplateUrl(
            @RequestParam Long organizationId,
            @RequestParam(required = false, defaultValue = "New Template") String title,
            @RequestParam(required = false, defaultValue = "") String description,
            @RequestParam(required = false) String redirectUrl,
            @RequestParam(defaultValue = "true") boolean showToolbar,
            @RequestParam(defaultValue = "PreparePage") String viewOption,
            @RequestParam(defaultValue = "EN") String locale) {

        var options = new BoldSignService.EmbeddedTemplateOptions(
                organizationId,
                title,
                description,
                null, // fileBase64 - will use placeholder
                null, // fileName
                redirectUrl,
                showToolbar,
                true, // showSaveButton
                true, // showCreateButton
                true, // showPreviewButton
                viewOption,
                locale,
                7     // linkValidForDays
        );

        BoldSignService.EmbeddedUrlDTO result = boldSignService.getEmbeddedCreateTemplateUrl(options);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("embedded", result))
                        .message("Embedded create template URL generated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get embedded URL for template creation (POST - with user's file)
     * Creates a local template record and links it to BoldSign
     */
    @PostMapping("/embedded/create-template")
    public ResponseEntity<HttpResponse> createEmbeddedTemplateUrl(
            @RequestBody EmbeddedTemplateRequestDTO request,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Creating embedded template URL with user file for organization {}", request.getOrganizationId());

        var options = new BoldSignService.EmbeddedTemplateOptions(
                request.getOrganizationId(),
                request.getTitle() != null ? request.getTitle() : "New Template",
                request.getDescription() != null ? request.getDescription() : "",
                request.getFileBase64(),
                request.getFileName(),
                request.getRedirectUrl(),
                request.getShowToolbar() != null ? request.getShowToolbar() : true,
                true, // showSaveButton
                true, // showCreateButton
                request.getShowPreviewButton() != null ? request.getShowPreviewButton() : true,
                request.getViewOption() != null ? request.getViewOption() : "PreparePage",
                request.getLocale() != null ? request.getLocale() : "EN",
                7     // linkValidForDays
        );

        BoldSignService.EmbeddedUrlDTO result = boldSignService.getEmbeddedCreateTemplateUrl(options);

        // Save the template to our database with the BoldSign template ID
        SignatureTemplate template = SignatureTemplate.builder()
                .organizationId(request.getOrganizationId())
                .boldsignTemplateId(result.templateId())
                .name(request.getTitle() != null ? request.getTitle() : "New Template")
                .description(request.getDescription())
                .category(request.getCategory() != null ? request.getCategory() : "General")
                .fileName(request.getFileName())
                .isActive(true)
                .isGlobal(false)
                .createdBy(user.getId())
                .build();

        template = signatureTemplateRepository.save(template);
        log.info("Created template {} with BoldSign ID {}", template.getId(), result.templateId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "embedded", result,
                                "template", SignatureTemplateDTO.builder()
                                        .id(template.getId())
                                        .organizationId(template.getOrganizationId())
                                        .boldsignTemplateId(template.getBoldsignTemplateId())
                                        .name(template.getName())
                                        .description(template.getDescription())
                                        .category(template.getCategory())
                                        .fileName(template.getFileName())
                                        .isActive(template.getIsActive())
                                        .createdAt(template.getCreatedAt())
                                        .build()
                        ))
                        .message("Embedded create template URL generated and template saved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get embedded URL for editing a template
     */
    @GetMapping("/embedded/edit-template/{boldsignTemplateId}")
    public ResponseEntity<HttpResponse> getEmbeddedEditTemplateUrl(
            @PathVariable String boldsignTemplateId) {

        BoldSignService.EmbeddedUrlDTO result = boldSignService.getEmbeddedEditTemplateUrl(boldsignTemplateId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("embedded", result))
                        .message("Embedded edit template URL generated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get embedded URL for sending document from a template
     */
    @PostMapping("/embedded/send-from-template/{boldsignTemplateId}")
    public ResponseEntity<HttpResponse> getEmbeddedSendFromTemplateUrl(
            @PathVariable String boldsignTemplateId,
            @RequestParam Long organizationId,
            @RequestParam(required = false) String signerName,
            @RequestParam(required = false) String signerEmail,
            @RequestParam(required = false) String redirectUrl,
            @RequestParam(defaultValue = "true") boolean showToolbar,
            @RequestParam(defaultValue = "EN") String locale) {

        var options = new BoldSignService.EmbeddedRequestFromTemplateOptions(
                organizationId,
                signerName,
                signerEmail,
                redirectUrl,
                showToolbar,
                true, // showSendButton
                true, // showPreviewButton
                locale
        );

        BoldSignService.EmbeddedUrlDTO result = boldSignService.getEmbeddedSendFromTemplateUrl(boldsignTemplateId, options);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("embedded", result))
                        .message("Embedded send from template URL generated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== Webhooks ====================

    /**
     * BoldSign webhook endpoint
     */
    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestHeader(value = "X-BoldSign-Signature", required = false) String signature,
            @RequestParam(value = "event", required = false) String eventType,
            @RequestBody String payload) {

        log.info("Received BoldSign webhook: {}", eventType);
        boldSignService.processWebhookEvent(eventType, payload, signature);

        return ResponseEntity.ok("OK");
    }

    // ==================== Statistics ====================

    /**
     * Get signature statistics for an organization
     */
    @GetMapping("/stats/organization/{organizationId}")
    public ResponseEntity<HttpResponse> getStatistics(@PathVariable Long organizationId) {
        BoldSignService.SignatureStatsDTO stats = boldSignService.getStatistics(organizationId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("statistics", stats))
                        .message("Statistics retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== Sync ====================

    /**
     * Sync documents from BoldSign to local database
     */
    @PostMapping("/sync/documents/{organizationId}")
    public ResponseEntity<HttpResponse> syncDocuments(
            @PathVariable Long organizationId,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Starting document sync from BoldSign for organization {}", organizationId);
        BoldSignService.SyncResultDTO result = boldSignService.syncDocumentsFromBoldSign(organizationId, user.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("syncResult", result))
                        .message(result.message())
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Sync templates from BoldSign to local database
     */
    @PostMapping("/sync/templates/{organizationId}")
    public ResponseEntity<HttpResponse> syncTemplates(
            @PathVariable Long organizationId,
            @AuthenticationPrincipal UserDTO user) {

        log.info("Starting template sync from BoldSign for organization {}", organizationId);
        BoldSignService.SyncResultDTO result = boldSignService.syncTemplatesFromBoldSign(organizationId, user.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("syncResult", result))
                        .message(result.message())
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }
}
