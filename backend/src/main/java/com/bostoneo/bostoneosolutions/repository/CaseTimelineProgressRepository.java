package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseTimelineProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseTimelineProgressRepository extends JpaRepository<CaseTimelineProgress, Long> {

    List<CaseTimelineProgress> findByCaseIdOrderByPhaseOrderAsc(Long caseId);

    Optional<CaseTimelineProgress> findByCaseIdAndPhaseOrder(Long caseId, Integer phaseOrder);

    @Query("SELECT p FROM CaseTimelineProgress p WHERE p.caseId = :caseId AND p.status = 'IN_PROGRESS'")
    Optional<CaseTimelineProgress> findCurrentPhase(@Param("caseId") Long caseId);

    @Query("SELECT COUNT(p) FROM CaseTimelineProgress p WHERE p.caseId = :caseId AND p.status = 'COMPLETED'")
    int countCompletedPhases(@Param("caseId") Long caseId);

    @Query("SELECT COUNT(p) FROM CaseTimelineProgress p WHERE p.caseId = :caseId")
    int countTotalPhases(@Param("caseId") Long caseId);

    void deleteByCaseId(Long caseId);

    boolean existsByCaseId(Long caseId);

    // ==================== TENANT-FILTERED METHODS ====================

    List<CaseTimelineProgress> findByOrganizationIdAndCaseIdOrderByPhaseOrderAsc(Long organizationId, Long caseId);

    Optional<CaseTimelineProgress> findByOrganizationIdAndCaseIdAndPhaseOrder(Long organizationId, Long caseId, Integer phaseOrder);

    @Query("SELECT p FROM CaseTimelineProgress p WHERE p.organizationId = :orgId AND p.caseId = :caseId AND p.status = 'IN_PROGRESS'")
    Optional<CaseTimelineProgress> findCurrentPhaseByOrganization(@Param("orgId") Long organizationId, @Param("caseId") Long caseId);

    void deleteByOrganizationIdAndCaseId(Long organizationId, Long caseId);

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    Optional<CaseTimelineProgress> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}
