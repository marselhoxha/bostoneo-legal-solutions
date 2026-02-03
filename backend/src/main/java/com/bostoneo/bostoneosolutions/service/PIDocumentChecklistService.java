package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PIDocumentChecklistDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * Service interface for PI Document Checklist operations
 */
public interface PIDocumentChecklistService {

    /**
     * Get all checklist items for a case
     */
    List<PIDocumentChecklistDTO> getChecklistByCaseId(Long caseId);

    /**
     * Get paginated checklist items for a case
     */
    Page<PIDocumentChecklistDTO> getChecklistByCaseId(Long caseId, Pageable pageable);

    /**
     * Get a specific checklist item by ID
     */
    PIDocumentChecklistDTO getChecklistItemById(Long id);

    /**
     * Create a new checklist item
     */
    PIDocumentChecklistDTO createChecklistItem(Long caseId, PIDocumentChecklistDTO itemDTO);

    /**
     * Update an existing checklist item
     */
    PIDocumentChecklistDTO updateChecklistItem(Long id, PIDocumentChecklistDTO itemDTO);

    /**
     * Delete a checklist item
     */
    void deleteChecklistItem(Long id);

    /**
     * Get missing documents for a case
     */
    List<PIDocumentChecklistDTO> getMissingDocuments(Long caseId);

    /**
     * Get overdue follow-ups for a case
     */
    List<PIDocumentChecklistDTO> getOverdueFollowUps(Long caseId);

    /**
     * Get checklist items by status
     */
    List<PIDocumentChecklistDTO> getChecklistByStatus(Long caseId, String status);

    /**
     * Initialize default checklist for a PI case
     */
    List<PIDocumentChecklistDTO> initializeDefaultChecklist(Long caseId);

    /**
     * Reset checklist - delete all existing items and reinitialize with defaults
     */
    List<PIDocumentChecklistDTO> resetChecklist(Long caseId);

    /**
     * Get completeness score for a case
     */
    Map<String, Object> getCompletenessScore(Long caseId);

    /**
     * Mark document as received
     */
    PIDocumentChecklistDTO markAsReceived(Long id, Long documentId);

    /**
     * Request a document
     */
    PIDocumentChecklistDTO requestDocument(Long id, String requestSentTo);

    /**
     * Log a follow-up
     */
    PIDocumentChecklistDTO logFollowUp(Long id);

    /**
     * Sync checklist with case documents.
     * Matches uploaded files to checklist items and marks them as received.
     *
     * @param caseId The case ID
     * @return Map with sync results (matched, unmatched, updated)
     */
    Map<String, Object> syncWithCaseDocuments(Long caseId);
}
