package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.*;

import java.util.List;
import java.util.Map;

/**
 * Service interface for PI Document Request operations.
 * Handles smart recipient resolution, actual communication sending,
 * template management, and request history tracking.
 */
public interface PIDocumentRequestService {

    // ========================
    // Recipient Resolution
    // ========================

    /**
     * Resolve the recipient for a document request based on document type.
     * Looks up contact info from medical records, case data, or provider directory.
     *
     * @param caseId The case ID
     * @param checklistItemId The checklist item ID
     * @return Resolved recipient with available contact methods
     */
    DocumentRecipientDTO resolveRecipient(Long caseId, Long checklistItemId);

    // ========================
    // Request Sending
    // ========================

    /**
     * Send a document request through the specified channel.
     * Sends actual email/SMS and logs the request.
     *
     * @param caseId The case ID
     * @param checklistItemId The checklist item ID
     * @param request The request details including recipient, channel, and message
     * @return The created request log entry
     */
    PIDocumentRequestLogDTO sendRequest(Long caseId, Long checklistItemId, SendDocumentRequestDTO request);

    /**
     * Send bulk document requests for multiple checklist items.
     *
     * @param caseId The case ID
     * @param bulkRequest The bulk request containing item IDs and options
     * @return Results for each item
     */
    BulkDocumentRequestDTO sendBulkRequests(Long caseId, BulkDocumentRequestDTO bulkRequest);

    /**
     * Preview bulk requests before sending.
     * Analyzes selected items, resolves recipients, groups by recipient.
     *
     * @param caseId The case ID
     * @param checklistItemIds The checklist item IDs to preview
     * @return Preview with grouped recipients and unresolved items
     */
    BulkRequestPreviewDTO previewBulkRequests(Long caseId, List<Long> checklistItemIds);

    /**
     * Send confirmed bulk requests with user overrides.
     * Groups items by recipient and sends consolidated communications.
     *
     * @param caseId The case ID
     * @param submitRequest The confirmed request with overrides
     * @return Results of the bulk send operation
     */
    BulkRequestSubmitDTO.BulkSendResult sendConfirmedBulkRequests(Long caseId, BulkRequestSubmitDTO submitRequest);

    // ========================
    // Request History
    // ========================

    /**
     * Get request history for a specific checklist item.
     *
     * @param caseId The case ID
     * @param checklistItemId The checklist item ID
     * @return List of request log entries
     */
    List<PIDocumentRequestLogDTO> getRequestHistory(Long caseId, Long checklistItemId);

    /**
     * Get all request history for a case.
     *
     * @param caseId The case ID
     * @return List of request log entries
     */
    List<PIDocumentRequestLogDTO> getCaseRequestHistory(Long caseId);

    /**
     * Get request statistics for a case.
     *
     * @param caseId The case ID
     * @return Map containing statistics like total requests, fees, etc.
     */
    Map<String, Object> getCaseRequestStats(Long caseId);

    // ========================
    // Templates
    // ========================

    /**
     * Get all available templates for an organization.
     *
     * @return List of templates
     */
    List<PIDocumentRequestTemplateDTO> getTemplates();

    /**
     * Get templates filtered by document type.
     *
     * @param documentType The document type (e.g., MEDICAL_RECORDS)
     * @return List of matching templates
     */
    List<PIDocumentRequestTemplateDTO> getTemplatesByDocumentType(String documentType);

    /**
     * Get a template by ID.
     *
     * @param templateId The template ID
     * @return The template DTO
     */
    PIDocumentRequestTemplateDTO getTemplateById(Long templateId);

    /**
     * Get a template by code.
     *
     * @param templateCode The template code
     * @return The template DTO
     */
    PIDocumentRequestTemplateDTO getTemplateByCode(String templateCode);

    /**
     * Preview a template with variables replaced.
     *
     * @param templateId The template ID
     * @param caseId The case ID (for variable values)
     * @param checklistItemId The checklist item ID (for variable values)
     * @return Template with preview content
     */
    PIDocumentRequestTemplateDTO previewTemplate(Long templateId, Long caseId, Long checklistItemId);

    // ========================
    // Fee Tracking
    // ========================

    /**
     * Update the fee status for a request.
     *
     * @param requestLogId The request log ID
     * @param feeStatus The new fee status (PENDING, PAID, WAIVED)
     * @return Updated request log
     */
    PIDocumentRequestLogDTO updateFeeStatus(Long requestLogId, String feeStatus);
}
