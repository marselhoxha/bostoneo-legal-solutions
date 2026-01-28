package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.SignatureRequest;
import com.bostoneo.bostoneosolutions.model.SignatureTemplate;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.SignatureRequestRepository;
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
    private final SignatureRequestRepository signatureRequestRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // ==================== Signature Requests ====================

    /**
     * Create and send a new signature request
     */
    @PostMapping("/requests")
    public ResponseEntity<HttpResponse> createSignatureRequest(
            @Valid @RequestBody CreateSignatureRequestDTO request,
            @AuthenticationPrincipal UserDTO user) {

        Long orgId = getRequiredOrganizationId();
        log.info("Creating signature request for organization {}", orgId);

        // Override client-provided organizationId with authenticated org
        request.setOrganizationId(orgId);

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
     * Send a draft signature request - TENANT FILTERED
     */
    @PostMapping("/requests/{id}/send")
    public ResponseEntity<HttpResponse> sendSignatureRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDTO user) {

        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        log.info("Sending signature request {} for organization {}", id, orgId);
        SignatureRequestDTO result = boldSignService.sendSignatureRequest(id, orgId, user.getId());

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
     * Get signature request by ID - TENANT FILTERED
     */
    @GetMapping("/requests/{id}")
    public ResponseEntity<HttpResponse> getSignatureRequest(@PathVariable Long id) {
        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        SignatureRequestDTO result = boldSignService.getSignatureRequestByIdAndOrganization(id, orgId);

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
     * Get all signature requests for an organization - TENANT FILTERED
     */
    @GetMapping("/requests/organization")
    public ResponseEntity<HttpResponse> getSignatureRequestsByOrganization(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Long orgId = getRequiredOrganizationId();
        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Page<SignatureRequestDTO> result = boldSignService.getSignatureRequestsByOrganization(
                orgId, PageRequest.of(page, size, sort));

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
     * Get signature requests for a case - TENANT FILTERED
     */
    @GetMapping("/requests/case/{caseId}")
    public ResponseEntity<HttpResponse> getSignatureRequestsByCase(
            @PathVariable Long caseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long orgId = getRequiredOrganizationId();
        Page<SignatureRequestDTO> result = boldSignService.getSignatureRequestsByCase(
                caseId, orgId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

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
     * Get signature requests for a client - TENANT FILTERED
     */
    @GetMapping("/requests/client/{clientId}")
    public ResponseEntity<HttpResponse> getSignatureRequestsByClient(
            @PathVariable Long clientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long orgId = getRequiredOrganizationId();
        Page<SignatureRequestDTO> result = boldSignService.getSignatureRequestsByClient(
                clientId, orgId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

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
     * Search signature requests - TENANT FILTERED
     */
    @GetMapping("/requests/search")
    public ResponseEntity<HttpResponse> searchSignatureRequests(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long orgId = getRequiredOrganizationId();
        Page<SignatureRequestDTO> result = boldSignService.searchSignatureRequests(
                orgId, query, PageRequest.of(page, size, Sort.by("createdAt").descending()));

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
     * Void/cancel a signature request - TENANT FILTERED
     */
    @PostMapping("/requests/{id}/void")
    public ResponseEntity<HttpResponse> voidSignatureRequest(
            @PathVariable Long id,
            @RequestParam String reason,
            @AuthenticationPrincipal UserDTO user) {

        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        log.info("Voiding signature request {} for organization {}", id, orgId);
        SignatureRequestDTO result = boldSignService.voidSignatureRequest(id, orgId, reason, user.getId());

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
     * Send reminder for a signature request - TENANT FILTERED
     */
    @PostMapping("/requests/{id}/remind")
    public ResponseEntity<HttpResponse> sendReminder(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDTO user) {

        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        log.info("Sending reminder for signature request {} for organization {}", id, orgId);
        SignatureRequestDTO result = boldSignService.sendReminder(id, orgId, user.getId());

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
     * Get embedded signing URL - TENANT FILTERED
     */
    @GetMapping("/requests/{id}/signing-url")
    public ResponseEntity<HttpResponse> getEmbeddedSigningUrl(
            @PathVariable Long id,
            @RequestParam String signerEmail) {

        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        String url = boldSignService.getEmbeddedSigningUrl(id, orgId, signerEmail);

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
     * Download signed document - TENANT FILTERED
     */
    @GetMapping("/requests/{id}/download")
    public ResponseEntity<byte[]> downloadSignedDocument(@PathVariable Long id) {
        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        byte[] document = boldSignService.downloadSignedDocument(id, orgId);
        SignatureRequestDTO request = boldSignService.getSignatureRequestByIdAndOrganization(id, orgId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment",
                request.getFileName() != null ? request.getFileName() : "signed-document.pdf");

        return new ResponseEntity<>(document, headers, OK);
    }

    /**
     * Download audit trail PDF for a document
     * SECURITY: Verifies document belongs to current organization
     */
    @GetMapping("/document/{boldsignDocumentId}/audit-trail")
    public ResponseEntity<byte[]> downloadAuditTrail(@PathVariable String boldsignDocumentId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify document belongs to current organization
        SignatureRequest request = signatureRequestRepository
                .findByBoldsignDocumentIdAndOrganizationId(boldsignDocumentId, orgId)
                .orElseThrow(() -> new ApiException("Document not found or access denied"));

        log.info("Downloading audit trail for document {} in org {}", boldsignDocumentId, orgId);
        byte[] auditTrail = boldSignService.downloadAuditTrail(boldsignDocumentId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "audit-trail-" + boldsignDocumentId + ".pdf");

        return new ResponseEntity<>(auditTrail, headers, OK);
    }

    /**
     * Download signed document by BoldSign document ID
     * SECURITY: Verifies document belongs to current organization
     */
    @GetMapping("/document/{boldsignDocumentId}/download")
    public ResponseEntity<byte[]> downloadDocumentByBoldsignId(@PathVariable String boldsignDocumentId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify document belongs to current organization
        SignatureRequest request = signatureRequestRepository
                .findByBoldsignDocumentIdAndOrganizationId(boldsignDocumentId, orgId)
                .orElseThrow(() -> new ApiException("Document not found or access denied"));

        log.info("Downloading document {} in org {}", boldsignDocumentId, orgId);
        byte[] document = boldSignService.downloadDocumentFromBoldSign(boldsignDocumentId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment",
                request.getFileName() != null ? request.getFileName() : "document-" + boldsignDocumentId + ".pdf");

        return new ResponseEntity<>(document, headers, OK);
    }

    /**
     * Refresh status from BoldSign - TENANT FILTERED
     */
    @PostMapping("/requests/{id}/refresh")
    public ResponseEntity<HttpResponse> refreshStatus(@PathVariable Long id) {
        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        SignatureRequestDTO result = boldSignService.refreshStatus(id, orgId);

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
     * Get all templates for an organization - TENANT FILTERED
     */
    @GetMapping("/templates/organization")
    public ResponseEntity<HttpResponse> getTemplates() {
        Long orgId = getRequiredOrganizationId();
        List<SignatureTemplateDTO> templates = boldSignService.getTemplatesForOrganization(orgId);

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
     * Get templates by category - TENANT FILTERED
     */
    @GetMapping("/templates/category/{category}")
    public ResponseEntity<HttpResponse> getTemplatesByCategory(
            @PathVariable String category) {

        Long orgId = getRequiredOrganizationId();
        List<SignatureTemplateDTO> templates = boldSignService.getTemplatesByCategory(orgId, category);

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
     * Get template by ID - TENANT FILTERED
     */
    @GetMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> getTemplate(@PathVariable Long id) {
        // SECURITY: Verify template belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        SignatureTemplateDTO template = boldSignService.getTemplateByIdAndOrganization(id, orgId);

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
     * Create a new template - TENANT FILTERED
     */
    @PostMapping("/templates")
    public ResponseEntity<HttpResponse> createTemplate(
            @Valid @RequestBody SignatureTemplateDTO template,
            @AuthenticationPrincipal UserDTO user) {

        // SECURITY: Override with current tenant's org ID
        Long orgId = getRequiredOrganizationId();
        template.setOrganizationId(orgId);
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
     * Update a template - TENANT FILTERED
     */
    @PutMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> updateTemplate(
            @PathVariable Long id,
            @RequestBody SignatureTemplateDTO template) {

        // SECURITY: Verify template belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        SignatureTemplateDTO result = boldSignService.updateTemplate(id, orgId, template);

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
     * Delete a template - TENANT FILTERED
     */
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<HttpResponse> deleteTemplate(@PathVariable Long id) {
        // SECURITY: Verify template belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        boldSignService.deleteTemplate(id, orgId);

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
     * Get template categories - TENANT FILTERED
     */
    @GetMapping("/templates/categories")
    public ResponseEntity<HttpResponse> getTemplateCategories() {
        Long orgId = getRequiredOrganizationId();
        List<String> categories = boldSignService.getTemplateCategories(orgId);

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
     * Get audit logs for a signature request - TENANT FILTERED
     */
    @GetMapping("/requests/{id}/audit")
    public ResponseEntity<HttpResponse> getAuditLogs(@PathVariable Long id) {
        // SECURITY: Verify request belongs to current tenant
        Long orgId = getRequiredOrganizationId();
        List<SignatureAuditLogDTO> logs = boldSignService.getAuditLogs(id, orgId);

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
     * Get audit logs for an organization - TENANT FILTERED
     */
    @GetMapping("/audit/organization")
    public ResponseEntity<HttpResponse> getAuditLogsByOrganization(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Long orgId = getRequiredOrganizationId();
        Page<SignatureAuditLogDTO> result = boldSignService.getAuditLogsByOrganization(
                orgId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

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
     * This also creates a SignatureRequest record in SENT status - TENANT FILTERED
     */
    @PostMapping("/embedded/send-document")
    public ResponseEntity<HttpResponse> getEmbeddedSendDocumentUrl(
            @AuthenticationPrincipal UserDTO user,
            @RequestBody EmbeddedSendRequestDTO request) {

        Long orgId = getRequiredOrganizationId();
        log.info("Creating embedded send document URL for organization {} by user {}", orgId, user.getId());

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
                orgId, // Use authenticated org, not client-provided
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
     * Get embedded URL for template creation (GET - uses placeholder PDF) - TENANT FILTERED
     */
    @GetMapping("/embedded/create-template")
    public ResponseEntity<HttpResponse> getEmbeddedCreateTemplateUrl(
            @RequestParam(required = false, defaultValue = "New Template") String title,
            @RequestParam(required = false, defaultValue = "") String description,
            @RequestParam(required = false) String redirectUrl,
            @RequestParam(defaultValue = "true") boolean showToolbar,
            @RequestParam(defaultValue = "PreparePage") String viewOption,
            @RequestParam(defaultValue = "EN") String locale) {

        Long orgId = getRequiredOrganizationId();
        var options = new BoldSignService.EmbeddedTemplateOptions(
                orgId, // Use authenticated org
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
     * Creates a local template record and links it to BoldSign - TENANT FILTERED
     */
    @PostMapping("/embedded/create-template")
    public ResponseEntity<HttpResponse> createEmbeddedTemplateUrl(
            @RequestBody EmbeddedTemplateRequestDTO request,
            @AuthenticationPrincipal UserDTO user) {

        Long orgId = getRequiredOrganizationId();
        log.info("Creating embedded template URL with user file for organization {}", orgId);

        var options = new BoldSignService.EmbeddedTemplateOptions(
                orgId, // Use authenticated org
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

        // Save the template to our database with the BoldSign template ID - use authenticated org
        SignatureTemplate template = SignatureTemplate.builder()
                .organizationId(orgId)
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
     * Get embedded URL for sending document from a template - TENANT FILTERED
     */
    @PostMapping("/embedded/send-from-template/{boldsignTemplateId}")
    public ResponseEntity<HttpResponse> getEmbeddedSendFromTemplateUrl(
            @PathVariable String boldsignTemplateId,
            @RequestParam(required = false) String signerName,
            @RequestParam(required = false) String signerEmail,
            @RequestParam(required = false) String redirectUrl,
            @RequestParam(defaultValue = "true") boolean showToolbar,
            @RequestParam(defaultValue = "EN") String locale) {

        Long orgId = getRequiredOrganizationId();
        var options = new BoldSignService.EmbeddedRequestFromTemplateOptions(
                orgId, // Use authenticated org
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
     * Get signature statistics for an organization - TENANT FILTERED
     */
    @GetMapping("/stats/organization")
    public ResponseEntity<HttpResponse> getStatistics() {
        Long orgId = getRequiredOrganizationId();
        BoldSignService.SignatureStatsDTO stats = boldSignService.getStatistics(orgId);

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

    /**
     * Get dashboard data from BoldSign API - TENANT FILTERED
     */
    @GetMapping("/dashboard")
    public ResponseEntity<HttpResponse> getDashboard() {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching dashboard for organization {}", orgId);
        BoldSignDashboardDTO dashboard = boldSignService.getDashboard(orgId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("dashboard", dashboard))
                        .message("Dashboard retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get document properties from BoldSign API
     */
    @GetMapping("/document/{boldsignDocumentId}/properties")
    public ResponseEntity<HttpResponse> getDocumentProperties(@PathVariable String boldsignDocumentId) {
        log.info("Fetching document properties for {}", boldsignDocumentId);
        BoldSignService.DocumentPropertiesDTO properties = boldSignService.getDocumentProperties(boldsignDocumentId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("document", properties))
                        .message("Document properties retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * List documents directly from BoldSign API
     * Provides real-time data from BoldSign with optional status filtering
     */
    @GetMapping("/documents/boldsign")
    public ResponseEntity<HttpResponse> listDocumentsFromBoldSign(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {

        log.info("Listing documents from BoldSign - status: {}, page: {}, pageSize: {}", status, page, pageSize);
        BoldSignService.BoldSignDocumentListDTO result = boldSignService.listDocumentsFromBoldSign(status, page, pageSize);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of(
                                "documents", result.documents(),
                                "totalCount", result.totalCount(),
                                "page", result.page(),
                                "pageSize", result.pageSize()
                        ))
                        .message("Documents retrieved from BoldSign")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== Sync ====================

    /**
     * Sync documents from BoldSign to local database - TENANT FILTERED
     */
    @PostMapping("/sync/documents")
    public ResponseEntity<HttpResponse> syncDocuments(
            @AuthenticationPrincipal UserDTO user) {

        Long orgId = getRequiredOrganizationId();
        log.info("Starting document sync from BoldSign for organization {}", orgId);
        BoldSignService.SyncResultDTO result = boldSignService.syncDocumentsFromBoldSign(orgId, user.getId());

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
     * Sync templates from BoldSign to local database - TENANT FILTERED
     */
    @PostMapping("/sync/templates")
    public ResponseEntity<HttpResponse> syncTemplates(
            @AuthenticationPrincipal UserDTO user) {

        Long orgId = getRequiredOrganizationId();
        log.info("Starting template sync from BoldSign for organization {}", orgId);
        BoldSignService.SyncResultDTO result = boldSignService.syncTemplatesFromBoldSign(orgId, user.getId());

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

    // ==================== Branding (Multi-Tenant) ====================

    /**
     * Get brand settings for an organization - TENANT FILTERED
     */
    @GetMapping("/brand")
    public ResponseEntity<HttpResponse> getBrand() {
        Long orgId = getRequiredOrganizationId();
        BoldSignService.BrandDTO brand = boldSignService.getBrand(orgId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("brand", brand != null ? brand : Map.of()))
                        .message(brand != null ? "Brand retrieved" : "No brand configured")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Create or update brand for an organization - TENANT FILTERED
     */
    @PostMapping("/brand")
    public ResponseEntity<HttpResponse> createOrUpdateBrand(
            @RequestBody Map<String, String> brandData) {

        Long orgId = getRequiredOrganizationId();
        log.info("Creating/updating brand for organization {}", orgId);

        BoldSignService.BrandDTO brandDTO = new BoldSignService.BrandDTO(
                brandData.get("brandId"),
                brandData.get("brandName"),
                brandData.get("brandLogoUrl"),
                brandData.get("brandLogoBase64"),
                brandData.get("brandLogoFileName"),
                brandData.get("primaryColor"),
                brandData.get("backgroundColor"),
                brandData.get("buttonColor"),
                brandData.get("buttonTextColor"),
                brandData.get("emailDisplayName"),
                brandData.get("disclaimerTitle"),
                brandData.get("disclaimerDescription")
        );

        BoldSignService.BrandDTO result;
        // If brandId exists, update; otherwise create
        if (brandData.get("brandId") != null && !brandData.get("brandId").isEmpty()) {
            result = boldSignService.updateBrand(orgId, brandDTO);
        } else {
            result = boldSignService.createBrand(orgId, brandDTO);
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .data(Map.of("brand", result))
                        .message("Brand saved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Delete brand for an organization - TENANT FILTERED
     */
    @DeleteMapping("/brand")
    public ResponseEntity<HttpResponse> deleteBrand() {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting brand for organization {}", orgId);
        boldSignService.deleteBrand(orgId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .message("Brand deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }
}
