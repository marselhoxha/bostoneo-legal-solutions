package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIMedicalSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for PI Medical Summaries
 */
@Repository
public interface PIMedicalSummaryRepository extends JpaRepository<PIMedicalSummary, Long> {

    /**
     * Find the medical summary for a case (there should only be one per case)
     */
    Optional<PIMedicalSummary> findByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Find a specific summary by ID with organization filtering
     */
    Optional<PIMedicalSummary> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Check if a summary exists for a case
     */
    boolean existsByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Mark summary as stale (when new records are added)
     */
    @Modifying
    @Query("UPDATE PIMedicalSummary s SET s.isStale = true WHERE s.caseId = :caseId AND s.organizationId = :orgId")
    void markAsStale(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Delete summary for a case
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);
}
