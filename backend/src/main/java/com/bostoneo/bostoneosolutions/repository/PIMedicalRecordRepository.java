package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIMedicalRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository for PI Medical Records
 */
@Repository
public interface PIMedicalRecordRepository extends JpaRepository<PIMedicalRecord, Long> {

    /**
     * Find all medical records for a case ordered by treatment date
     */
    List<PIMedicalRecord> findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(Long caseId, Long organizationId);

    /**
     * Find all medical records for a case with pagination
     */
    Page<PIMedicalRecord> findByCaseIdAndOrganizationIdOrderByTreatmentDateDesc(
            Long caseId, Long organizationId, Pageable pageable);

    /**
     * Find a specific medical record by ID with organization filtering
     */
    Optional<PIMedicalRecord> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find medical records by provider name
     */
    List<PIMedicalRecord> findByCaseIdAndOrganizationIdAndProviderNameContainingIgnoreCase(
            Long caseId, Long organizationId, String providerName);

    /**
     * Find medical records by record type
     */
    List<PIMedicalRecord> findByCaseIdAndOrganizationIdAndRecordType(
            Long caseId, Long organizationId, String recordType);

    /**
     * Find medical records within a date range
     */
    List<PIMedicalRecord> findByCaseIdAndOrganizationIdAndTreatmentDateBetweenOrderByTreatmentDateAsc(
            Long caseId, Long organizationId, LocalDate startDate, LocalDate endDate);

    /**
     * Count medical records for a case
     */
    long countByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Get distinct provider names for a case
     */
    @Query("SELECT DISTINCT m.providerName FROM PIMedicalRecord m " +
           "WHERE m.caseId = :caseId AND m.organizationId = :orgId ORDER BY m.providerName")
    List<String> findDistinctProviderNames(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Sum total billed amount for a case
     */
    @Query("SELECT COALESCE(SUM(m.billedAmount), 0) FROM PIMedicalRecord m " +
           "WHERE m.caseId = :caseId AND m.organizationId = :orgId")
    BigDecimal sumBilledAmountByCaseId(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Get earliest treatment date for a case
     */
    @Query("SELECT MIN(m.treatmentDate) FROM PIMedicalRecord m " +
           "WHERE m.caseId = :caseId AND m.organizationId = :orgId")
    LocalDate findEarliestTreatmentDate(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Get latest treatment date for a case
     */
    @Query("SELECT MAX(COALESCE(m.treatmentEndDate, m.treatmentDate)) FROM PIMedicalRecord m " +
           "WHERE m.caseId = :caseId AND m.organizationId = :orgId")
    LocalDate findLatestTreatmentDate(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Count visits by provider for summary
     */
    @Query("SELECT m.providerName, m.providerType, COUNT(m), COALESCE(SUM(m.billedAmount), 0), " +
           "MIN(m.treatmentDate), MAX(COALESCE(m.treatmentEndDate, m.treatmentDate)) " +
           "FROM PIMedicalRecord m " +
           "WHERE m.caseId = :caseId AND m.organizationId = :orgId " +
           "GROUP BY m.providerName, m.providerType ORDER BY MIN(m.treatmentDate)")
    List<Object[]> getProviderSummary(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Delete all medical records for a case
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Check if a medical record already exists for a specific document
     */
    boolean existsByDocumentIdAndOrganizationId(Long documentId, Long organizationId);

    /**
     * Find medical record by document ID
     */
    Optional<PIMedicalRecord> findByDocumentIdAndOrganizationId(Long documentId, Long organizationId);

    /**
     * Find record IDs that have a linked document but no citation metadata.
     * Used for batch re-scanning existing records.
     */
    @Query("SELECT m.id FROM PIMedicalRecord m " +
           "WHERE m.organizationId = :orgId " +
           "AND m.documentId IS NOT NULL " +
           "AND m.citationMetadata IS NULL")
    List<Long> findRecordIdsWithoutCitationMetadata(@Param("orgId") Long organizationId);

    /**
     * Count records that need citation metadata re-scan
     */
    @Query("SELECT COUNT(m) FROM PIMedicalRecord m " +
           "WHERE m.organizationId = :orgId " +
           "AND m.documentId IS NOT NULL " +
           "AND m.citationMetadata IS NULL")
    long countRecordsWithoutCitationMetadata(@Param("orgId") Long organizationId);
}
