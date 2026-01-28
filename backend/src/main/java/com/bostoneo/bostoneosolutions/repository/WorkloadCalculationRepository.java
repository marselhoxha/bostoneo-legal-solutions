package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.WorkloadCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository for WorkloadCalculation entity with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface WorkloadCalculationRepository extends JpaRepository<WorkloadCalculation, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<WorkloadCalculation> findByIdAndOrganizationId(Long id, Long organizationId);

    Optional<WorkloadCalculation> findByOrganizationIdAndUserIdAndCalculationDate(Long organizationId, Long userId, LocalDate calculationDate);

    @Query("SELECT wc FROM WorkloadCalculation wc WHERE wc.organizationId = :orgId AND wc.userId = :userId " +
           "ORDER BY wc.calculationDate DESC")
    List<WorkloadCalculation> findByOrganizationIdAndUserIdOrderByCalculationDateDesc(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    @Query("SELECT wc FROM WorkloadCalculation wc WHERE wc.organizationId = :orgId AND wc.userId = :userId " +
           "AND wc.calculationDate BETWEEN :startDate AND :endDate ORDER BY wc.calculationDate")
    List<WorkloadCalculation> findByOrganizationIdAndUserIdAndDateRange(
        @Param("orgId") Long organizationId,
        @Param("userId") Long userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    @Modifying
    @Query("DELETE FROM WorkloadCalculation wc WHERE wc.organizationId = :orgId AND wc.calculationDate < :beforeDate")
    void deleteOldCalculationsByOrganizationId(@Param("orgId") Long organizationId, @Param("beforeDate") LocalDate beforeDate);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Entity lacks organization_id - requires migration for tenant isolation.

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    Optional<WorkloadCalculation> findByUserIdAndCalculationDate(Long userId, LocalDate calculationDate);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT wc FROM WorkloadCalculation wc WHERE wc.userId = :userId " +
           "ORDER BY wc.calculationDate DESC")
    List<WorkloadCalculation> findByUserIdOrderByCalculationDateDesc(@Param("userId") Long userId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT wc FROM WorkloadCalculation wc WHERE wc.userId = :userId " +
           "AND wc.calculationDate BETWEEN :startDate AND :endDate " +
           "ORDER BY wc.calculationDate")
    List<WorkloadCalculation> findByUserIdAndDateRange(
        @Param("userId") Long userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /** @deprecated Affects data from all organizations - should filter by org */
    @Deprecated
    @Query("DELETE FROM WorkloadCalculation wc WHERE wc.calculationDate < :beforeDate")
    void deleteOldCalculations(@Param("beforeDate") LocalDate beforeDate);
}