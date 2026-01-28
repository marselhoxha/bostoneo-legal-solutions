package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.AssignmentAction;
import com.bostoneo.bostoneosolutions.model.CaseAssignmentHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for CaseAssignmentHistory entity with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface CaseAssignmentHistoryRepository extends JpaRepository<CaseAssignmentHistory, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<CaseAssignmentHistory> findByIdAndOrganizationId(Long id, Long organizationId);

    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId AND cah.caseId = :caseId " +
           "ORDER BY cah.performedAt DESC")
    Page<CaseAssignmentHistory> findByOrganizationIdAndCaseId(@Param("orgId") Long organizationId, @Param("caseId") Long caseId, Pageable pageable);

    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId AND cah.userId = :userId " +
           "ORDER BY cah.performedAt DESC")
    Page<CaseAssignmentHistory> findByOrganizationIdAndUserId(@Param("orgId") Long organizationId, @Param("userId") Long userId, Pageable pageable);

    List<CaseAssignmentHistory> findByOrganizationIdAndAction(Long organizationId, AssignmentAction action);

    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId AND cah.action = 'TRANSFERRED' " +
           "AND cah.performedAt BETWEEN :startDate AND :endDate")
    List<CaseAssignmentHistory> findTransfersBetweenDatesByOrganizationId(
        @Param("orgId") Long organizationId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId AND cah.performedBy.id = :userId " +
           "ORDER BY cah.performedAt DESC")
    List<CaseAssignmentHistory> findByOrganizationIdAndPerformedBy(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    @Query("SELECT COUNT(cah) FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId AND cah.caseId = :caseId")
    long countByOrganizationIdAndCaseId(@Param("orgId") Long organizationId, @Param("caseId") Long caseId);

    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId " +
           "AND cah.performedAt >= :since ORDER BY cah.performedAt DESC")
    List<CaseAssignmentHistory> findRecentActivitiesByOrganizationId(
        @Param("orgId") Long organizationId,
        @Param("since") LocalDateTime since,
        Pageable pageable
    );

    @Query("SELECT cah.action, COUNT(cah) FROM CaseAssignmentHistory cah WHERE cah.organizationId = :orgId " +
           "AND cah.performedAt BETWEEN :startDate AND :endDate GROUP BY cah.action")
    List<Object[]> getActionStatisticsByOrganizationId(
        @Param("orgId") Long organizationId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * SECURITY: Find all case assignment history for an organization (tenant isolation)
     */
    List<CaseAssignmentHistory> findByOrganizationId(Long organizationId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Entity lacks organization_id - requires migration for tenant isolation.

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.caseId = :caseId " +
           "ORDER BY cah.performedAt DESC")
    Page<CaseAssignmentHistory> findByCaseId(@Param("caseId") Long caseId, Pageable pageable);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.userId = :userId " +
           "ORDER BY cah.performedAt DESC")
    Page<CaseAssignmentHistory> findByUserId(@Param("userId") Long userId, Pageable pageable);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<CaseAssignmentHistory> findByAction(AssignmentAction action);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.action = 'TRANSFERRED' " +
           "AND cah.performedAt BETWEEN :startDate AND :endDate")
    List<CaseAssignmentHistory> findTransfersBetweenDates(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.performedBy.id = :userId " +
           "ORDER BY cah.performedAt DESC")
    List<CaseAssignmentHistory> findByPerformedBy(@Param("userId") Long userId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT COUNT(cah) FROM CaseAssignmentHistory cah WHERE cah.caseId = :caseId")
    long countByCaseId(@Param("caseId") Long caseId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT cah FROM CaseAssignmentHistory cah " +
           "WHERE cah.performedAt >= :since ORDER BY cah.performedAt DESC")
    List<CaseAssignmentHistory> findRecentActivities(
        @Param("since") LocalDateTime since,
        Pageable pageable
    );

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT cah.action, COUNT(cah) FROM CaseAssignmentHistory cah " +
           "WHERE cah.performedAt BETWEEN :startDate AND :endDate " +
           "GROUP BY cah.action")
    List<Object[]> getActionStatistics(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
}