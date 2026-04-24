package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIScannedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
     * Bulk DELETE tracking records for a case — allows fresh re-scan after "Clear All" or
     * after the user clicks Scan on a case with zero medical records.
     *
     * Uses @Modifying + JPQL so the DELETE executes synchronously against the DB. The default
     * derived-method pattern (SELECT + entityManager.remove) defers the DELETE until flush,
     * which causes unique-constraint violations when the subsequent save() loop re-inserts
     * rows with the same (document_id, organization_id).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PIScannedDocument s WHERE s.caseId = :caseId AND s.organizationId = :organizationId")
    void deleteByCaseIdAndOrganizationId(@Param("caseId") Long caseId, @Param("organizationId") Long organizationId);

    /**
     * Bulk DELETE tracking records linked to a specific medical record —
     * allows source files to be re-processed when a record is deleted.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PIScannedDocument s WHERE s.medicalRecordId = :medicalRecordId")
    void deleteByMedicalRecordId(@Param("medicalRecordId") Long medicalRecordId);
}
