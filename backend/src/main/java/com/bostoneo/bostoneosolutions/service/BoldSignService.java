package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.BoldSignDashboardDTO;
import com.bostoneo.bostoneosolutions.dto.CreateSignatureRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SignatureAuditLogDTO;
import com.bostoneo.bostoneosolutions.dto.SignatureRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SignatureTemplateDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Service for managing e-signature requests via BoldSign.
 * Supports multi-tenant organizations with organization-specific API keys.
 */
public interface BoldSignService {

    // ==================== Signature Requests ====================

    /**
     * Create and send a new signature request
     */
    SignatureRequestDTO createSignatureRequest(CreateSignatureRequestDTO request, Long userId);

    /**
     * Create a draft signature request (not sent)
     */
    SignatureRequestDTO createDraftSignatureRequest(CreateSignatureRequestDTO request, Long userId);

    /**
     * Send a draft signature request
     */
    SignatureRequestDTO sendSignatureRequest(Long requestId, Long userId);

    /**
     * Send a draft signature request - TENANT FILTERED
     */
    SignatureRequestDTO sendSignatureRequest(Long requestId, Long organizationId, Long userId);

    /**
     * Get signature request by ID
     * @deprecated Use getSignatureRequestByIdAndOrganization for tenant isolation
     */
    @Deprecated
    SignatureRequestDTO getSignatureRequest(Long id);

    /**
     * SECURITY: Get signature request by ID with tenant isolation
     */
    SignatureRequestDTO getSignatureRequestByIdAndOrganization(Long id, Long organizationId);

    /**
     * Get signature request by BoldSign document ID
     */
    SignatureRequestDTO getSignatureRequestByBoldsignId(String boldsignDocumentId);

    /**
     * Get all signature requests for an organization
     */
    Page<SignatureRequestDTO> getSignatureRequestsByOrganization(Long organizationId, Pageable pageable);

    /**
     * Get signature requests for a case
     */
    Page<SignatureRequestDTO> getSignatureRequestsByCase(Long caseId, Long organizationId, Pageable pageable);

    /**
     * Get signature requests for a client
     */
    Page<SignatureRequestDTO> getSignatureRequestsByClient(Long clientId, Long organizationId, Pageable pageable);

    /**
     * Search signature requests
     */
    Page<SignatureRequestDTO> searchSignatureRequests(Long organizationId, String search, Pageable pageable);

    /**
     * Void/cancel a signature request
     * @deprecated Use voidSignatureRequest with organizationId for tenant isolation
     */
    @Deprecated
    SignatureRequestDTO voidSignatureRequest(Long requestId, String reason, Long userId);

    /**
     * SECURITY: Void/cancel a signature request with tenant isolation
     */
    SignatureRequestDTO voidSignatureRequest(Long requestId, Long organizationId, String reason, Long userId);

    /**
     * Send a reminder for a pending signature request
     * @deprecated Use sendReminder with organizationId for tenant isolation
     */
    @Deprecated
    SignatureRequestDTO sendReminder(Long requestId, Long userId);

    /**
     * SECURITY: Send a reminder with tenant isolation
     */
    SignatureRequestDTO sendReminder(Long requestId, Long organizationId, Long userId);

    /**
     * Get embedded signing URL for a signer
     * @deprecated Use getEmbeddedSigningUrl with organizationId for tenant isolation
     */
    @Deprecated
    String getEmbeddedSigningUrl(Long requestId, String signerEmail);

    /**
     * SECURITY: Get embedded signing URL with tenant isolation
     */
    String getEmbeddedSigningUrl(Long requestId, Long organizationId, String signerEmail);

    /**
     * Download the signed document
     * @deprecated Use downloadSignedDocument with organizationId for tenant isolation
     */
    @Deprecated
    byte[] downloadSignedDocument(Long requestId);

    /**
     * SECURITY: Download signed document with tenant isolation
     */
    byte[] downloadSignedDocument(Long requestId, Long organizationId);

    /**
     * Download the audit trail PDF for a document
     */
    byte[] downloadAuditTrail(String boldsignDocumentId);

    /**
     * Download document directly from BoldSign by document ID
     */
    byte[] downloadDocumentFromBoldSign(String boldsignDocumentId);

    /**
     * Refresh status from BoldSign
     * @deprecated Use refreshStatus with organizationId for tenant isolation
     */
    @Deprecated
    SignatureRequestDTO refreshStatus(Long requestId);

    /**
     * SECURITY: Refresh status with tenant isolation
     */
    SignatureRequestDTO refreshStatus(Long requestId, Long organizationId);

    // ==================== Embedded URLs ====================

    /**
     * Get embedded document preparation URL (full BoldSign UI for creating/sending documents)
     * This embeds BoldSign's document preparation interface with drag-and-drop fields
     */
    EmbeddedUrlDTO getEmbeddedSendDocumentUrl(EmbeddedRequestOptions options);

    /**
     * Get embedded template creation URL
     * This embeds BoldSign's template designer interface
     */
    EmbeddedUrlDTO getEmbeddedCreateTemplateUrl(EmbeddedTemplateOptions options);

    /**
     * Get embedded template edit URL
     */
    EmbeddedUrlDTO getEmbeddedEditTemplateUrl(String boldsignTemplateId);

    /**
     * Get embedded request URL from a template
     * Pre-fills template and allows user to review/send
     */
    EmbeddedUrlDTO getEmbeddedSendFromTemplateUrl(String boldsignTemplateId, EmbeddedRequestFromTemplateOptions options);

    /**
     * Options for embedded document request
     */
    record EmbeddedRequestOptions(
            Long organizationId,
            String title,
            String signerName,
            String signerEmail,
            String message,
            String fileName,
            String fileBase64,
            String redirectUrl,
            boolean showToolbar,
            boolean showSendButton,
            boolean showSaveButton,
            boolean showPreviewButton,
            boolean showNavigationButtons,
            String sendViewOption,  // "PreparePage" or "FillingPage"
            String locale,
            Integer linkValidForDays,
            Long createdBy,  // User ID who initiated the request
            Long clientId,   // Link to client
            Long caseId      // Link to case
    ) {
        public EmbeddedRequestOptions(Long organizationId) {
            this(organizationId, null, null, null, null, null, null, null, true, true, true, true, true, "PreparePage", "EN", 7, null, null, null);
        }
    }

    /**
     * Options for embedded template creation
     */
    record EmbeddedTemplateOptions(
            Long organizationId,
            String title,        // Required by BoldSign API
            String description,
            String fileBase64,   // User's file (base64) - if null, placeholder is used
            String fileName,     // User's file name
            String redirectUrl,
            boolean showToolbar,
            boolean showSaveButton,
            boolean showCreateButton,
            boolean showPreviewButton,
            String viewOption,  // "PreparePage" or "FillingPage"
            String locale,
            Integer linkValidForDays
    ) {
        public EmbeddedTemplateOptions(Long organizationId) {
            this(organizationId, "New Template", "", null, null, null, true, true, true, true, "PreparePage", "EN", 7);
        }

        public EmbeddedTemplateOptions(Long organizationId, String title, String description) {
            this(organizationId, title, description, null, null, null, true, true, true, true, "PreparePage", "EN", 7);
        }
    }

    /**
     * Options for embedded request from template
     */
    record EmbeddedRequestFromTemplateOptions(
            Long organizationId,
            String signerName,
            String signerEmail,
            String redirectUrl,
            boolean showToolbar,
            boolean showSendButton,
            boolean showPreviewButton,
            String locale
    ) {
        public EmbeddedRequestFromTemplateOptions(Long organizationId, String signerName, String signerEmail) {
            this(organizationId, signerName, signerEmail, null, true, true, true, "EN");
        }
    }

    /**
     * Response containing embedded URL
     */
    record EmbeddedUrlDTO(
            String url,
            String documentId,
            String templateId,
            Long expiresAt
    ) {}

    // ==================== Templates ====================

    /**
     * Get all available templates for an organization
     */
    List<SignatureTemplateDTO> getTemplatesForOrganization(Long organizationId);

    /**
     * Get templates by category
     */
    List<SignatureTemplateDTO> getTemplatesByCategory(Long organizationId, String category);

    /**
     * Get template by ID
     * @deprecated Use getTemplateByIdAndOrganization for tenant isolation
     */
    @Deprecated
    SignatureTemplateDTO getTemplate(Long id);

    /**
     * SECURITY: Get template by ID with tenant isolation
     */
    SignatureTemplateDTO getTemplateByIdAndOrganization(Long id, Long organizationId);

    /**
     * Create a new template
     */
    SignatureTemplateDTO createTemplate(SignatureTemplateDTO template, Long userId);

    /**
     * Update a template
     * @deprecated Use updateTemplate with organizationId for tenant isolation
     */
    @Deprecated
    SignatureTemplateDTO updateTemplate(Long id, SignatureTemplateDTO template);

    /**
     * SECURITY: Update a template with tenant isolation
     */
    SignatureTemplateDTO updateTemplate(Long id, Long organizationId, SignatureTemplateDTO template);

    /**
     * Delete (deactivate) a template
     * @deprecated Use deleteTemplate with organizationId for tenant isolation
     */
    @Deprecated
    void deleteTemplate(Long id);

    /**
     * SECURITY: Delete template with tenant isolation
     */
    void deleteTemplate(Long id, Long organizationId);

    /**
     * Get template categories
     */
    List<String> getTemplateCategories(Long organizationId);

    // ==================== Audit Logs ====================

    /**
     * Get audit logs for a signature request
     * @deprecated Use getAuditLogs with organizationId for tenant isolation
     */
    @Deprecated
    List<SignatureAuditLogDTO> getAuditLogs(Long signatureRequestId);

    /**
     * SECURITY: Get audit logs with tenant isolation
     */
    List<SignatureAuditLogDTO> getAuditLogs(Long signatureRequestId, Long organizationId);

    /**
     * Get audit logs for an organization
     */
    Page<SignatureAuditLogDTO> getAuditLogsByOrganization(Long organizationId, Pageable pageable);

    // ==================== Webhooks ====================

    /**
     * Process BoldSign webhook event
     */
    void processWebhookEvent(String eventType, String payload, String signature);

    // ==================== Dashboard ====================

    /**
     * Get dashboard data from BoldSign API
     * Returns counts and recent documents for each status category
     */
    BoldSignDashboardDTO getDashboard(Long organizationId);

    /**
     * List documents directly from BoldSign API
     * @param status Optional status filter (e.g., "WaitingForOthers", "Completed", "Revoked")
     * @param page Page number (1-based)
     * @param pageSize Number of documents per page
     * @return List of documents with pagination info
     */
    BoldSignDocumentListDTO listDocumentsFromBoldSign(String status, int page, int pageSize);

    /**
     * Document list response from BoldSign
     */
    record BoldSignDocumentListDTO(
            java.util.List<BoldSignDocumentDTO> documents,
            int totalCount,
            int page,
            int pageSize
    ) {}

    /**
     * Document DTO matching BoldSign's document structure
     */
    record BoldSignDocumentDTO(
            String documentId,
            String messageTitle,
            String status,
            String createdDate,
            String expiryDate,
            String senderName,
            String senderEmail,
            String signerName,
            String signerEmail,
            String signerStatus,
            String lastActivityDate,
            String lastActivityBy,
            String lastActivityAction
    ) {}

    /**
     * Get document properties from BoldSign API
     */
    DocumentPropertiesDTO getDocumentProperties(String boldsignDocumentId);

    /**
     * Document properties DTO - matches BoldSign document details view
     */
    record DocumentPropertiesDTO(
            String documentId,
            String messageTitle,
            String documentDescription,
            String status,
            String statusDescription,      // e.g., "Needs to be signed by Jane Smith"
            String createdDate,
            String sentOn,                  // Formatted sent date
            String lastActivityDate,
            String lastActivityDescription, // e.g., "Marsel Hoxha has viewed the document"
            String expiryDate,
            int expiryDays,
            boolean enableSigningOrder,
            java.util.List<String> files,   // List of file names
            String brandName,
            SenderDetailDTO senderDetail,
            java.util.List<SignerDetailDTO> signerDetails,
            java.util.List<ActivityDTO> documentHistory
    ) {}

    record SenderDetailDTO(
            String name,
            String emailAddress
    ) {}

    record SignerDetailDTO(
            String signerName,
            String signerEmail,
            String signerType,
            String status,
            String signedDate,
            int signerOrder,
            String deliveryMode,        // Email, SMS, etc.
            String lastActivity,        // Last activity date for this signer
            String authenticationType   // None, OTP, etc.
    ) {}

    record ActivityDTO(
            String activityBy,
            String activityDate,
            String activityAction,
            String ipAddress,
            String action           // Short action type: "Sent", "Viewed", "Reminder", etc.
    ) {}

    // ==================== Statistics ====================

    /**
     * Get signature request statistics for an organization
     */
    SignatureStatsDTO getStatistics(Long organizationId);

    /**
     * Statistics DTO
     */
    record SignatureStatsDTO(
            long totalRequests,
            long pendingRequests,
            long completedRequests,
            long declinedRequests,
            long expiredRequests,
            long completedThisMonth,
            long sentThisMonth,
            double completionRate
    ) {}

    // ==================== Sync ====================

    /**
     * Sync documents from BoldSign to local database
     */
    SyncResultDTO syncDocumentsFromBoldSign(Long organizationId, Long userId);

    /**
     * Sync templates from BoldSign to local database
     */
    SyncResultDTO syncTemplatesFromBoldSign(Long organizationId, Long userId);

    /**
     * Sync result DTO
     */
    record SyncResultDTO(
            int imported,
            int skipped,
            int failed,
            String message
    ) {}

    // ==================== Branding (Multi-Tenant) ====================

    /**
     * Create a brand for an organization
     */
    BrandDTO createBrand(Long organizationId, BrandDTO brand);

    /**
     * Get brand for an organization
     */
    BrandDTO getBrand(Long organizationId);

    /**
     * Update brand for an organization
     */
    BrandDTO updateBrand(Long organizationId, BrandDTO brand);

    /**
     * Delete brand for an organization
     */
    void deleteBrand(Long organizationId);

    /**
     * Brand settings DTO
     */
    record BrandDTO(
            String brandId,
            String brandName,
            String brandLogoUrl,
            String brandLogoBase64,  // Base64 encoded logo file for upload
            String brandLogoFileName, // Logo file name (e.g., "logo.png")
            String primaryColor,
            String backgroundColor,
            String buttonColor,
            String buttonTextColor,
            String emailDisplayName,
            String disclaimerTitle,
            String disclaimerDescription
    ) {}
}
