package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIDocumentChecklist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PI Document Checklist
 */
@Repository
public interface PIDocumentChecklistRepository extends JpaRepository<PIDocumentChecklist, Long> {

    /**
     * Find all checklist items for a case ordered by document type
     */
    List<PIDocumentChecklist> findByCaseIdAndOrganizationIdOrderByDocumentType(Long caseId, Long organizationId);

    /**
     * Find all checklist items for a case with pagination
     */
    Page<PIDocumentChecklist> findByCaseIdAndOrganizationId(Long caseId, Long organizationId, Pageable pageable);

    /**
     * Find a specific checklist item by ID with organization filtering
     */
    Optional<PIDocumentChecklist> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find checklist items by status
     */
    List<PIDocumentChecklist> findByCaseIdAndOrganizationIdAndStatus(Long caseId, Long organizationId, String status);

    /**
     * Find checklist items by document type
     */
    List<PIDocumentChecklist> findByCaseIdAndOrganizationIdAndDocumentType(
            Long caseId, Long organizationId, String documentType);

    /**
     * Find required but not received items
     */
    @Query("SELECT c FROM PIDocumentChecklist c " +
           "WHERE c.caseId = :caseId AND c.organizationId = :orgId " +
           "AND c.required = true AND (c.received = false OR c.received IS NULL) " +
           "ORDER BY c.documentType")
    List<PIDocumentChecklist> findMissingDocuments(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Find items needing follow-up
     */
    @Query("SELECT c FROM PIDocumentChecklist c " +
           "WHERE c.caseId = :caseId AND c.organizationId = :orgId " +
           "AND c.status = 'REQUESTED' AND c.followUpDate <= CURRENT_DATE " +
           "ORDER BY c.followUpDate")
    List<PIDocumentChecklist> findOverdueFollowUps(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Count documents by status
     */
    long countByCaseIdAndOrganizationIdAndStatus(Long caseId, Long organizationId, String status);

    /**
     * Count received documents
     */
    long countByCaseIdAndOrganizationIdAndReceivedTrue(Long caseId, Long organizationId);

    /**
     * Count required documents
     */
    long countByCaseIdAndOrganizationIdAndRequiredTrue(Long caseId, Long organizationId);

    /**
     * Calculate completeness percentage (only counts received items that are also required)
     */
    @Query("SELECT CAST(COUNT(CASE WHEN c.received = true AND c.required = true THEN 1 END) AS double) / " +
           "NULLIF(COUNT(CASE WHEN c.required = true THEN 1 END), 0) * 100 " +
           "FROM PIDocumentChecklist c " +
           "WHERE c.caseId = :caseId AND c.organizationId = :orgId")
    Double calculateCompletenessPercent(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Count required documents that have been received
     */
    long countByCaseIdAndOrganizationIdAndRequiredTrueAndReceivedTrue(Long caseId, Long organizationId);

    /**
     * Get document type summary
     */
    @Query("SELECT c.documentType, c.status, COUNT(c) FROM PIDocumentChecklist c " +
           "WHERE c.caseId = :caseId AND c.organizationId = :orgId " +
           "GROUP BY c.documentType, c.status ORDER BY c.documentType")
    List<Object[]> getDocumentTypeSummary(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Delete all checklist items for a case
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);
}
