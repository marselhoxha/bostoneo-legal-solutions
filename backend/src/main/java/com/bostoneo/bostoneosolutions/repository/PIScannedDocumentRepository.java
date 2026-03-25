package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIScannedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for tracking which files have been processed during medical document scans.
 */
@Repository
public interface PIScannedDocumentRepository extends JpaRepository<PIScannedDocument, Long> {

    /**
     * Check if a document has already been processed (any outcome) for a given organization.
     */
    boolean existsByDocumentIdAndOrganizationId(Long documentId, Long organizationId);

    /**
     * Find the tracking record for a specific document.
     */
    Optional<PIScannedDocument> findByDocumentIdAndOrganizationId(Long documentId, Long organizationId);

    /**
     * Delete all tracking records for a case — allows fresh re-scan after "Clear All".
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Delete tracking records linked to a specific medical record —
     * allows source files to be re-processed when a record is deleted.
     */
    void deleteByMedicalRecordId(Long medicalRecordId);
}
