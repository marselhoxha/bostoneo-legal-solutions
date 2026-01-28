package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.UserWorkload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserWorkloadRepository extends JpaRepository<UserWorkload, Long> {
    
    /**
     * @deprecated Use findByOrganizationIdAndUserIdAndCalculationDate for tenant isolation
     */
    @Deprecated
    Optional<UserWorkload> findByUserIdAndCalculationDate(Long userId, LocalDate calculationDate);

    /**
     * Find workload for a user on a specific date - TENANT FILTERED
     */
    Optional<UserWorkload> findByOrganizationIdAndUserIdAndCalculationDate(Long organizationId, Long userId, LocalDate calculationDate);

    /**
     * Find latest workload for a user
     */
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.user.id = :userId " +
           "ORDER BY uw.calculationDate DESC LIMIT 1")
    Optional<UserWorkload> findLatestByUserId(@Param("userId") Long userId);
    
    /**
     * Find historical workload data for a user
     */
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.user.id = :userId " +
           "ORDER BY uw.calculationDate DESC")
    List<UserWorkload> findByUserIdOrderByCalculationDateDesc(@Param("userId") Long userId);
    
    /**
     * @deprecated Use findHighWorkloadUsersByOrganization for tenant isolation
     */
    @Deprecated
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.calculationDate = :date " +
           "AND uw.capacityPercentage >= :threshold ORDER BY uw.capacityPercentage DESC")
    List<UserWorkload> findHighWorkloadUsers(
        @Param("date") LocalDate date,
        @Param("threshold") BigDecimal threshold
    );

    /**
     * Find users with high workload - TENANT FILTERED
     */
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.organizationId = :orgId " +
           "AND uw.calculationDate = :date AND uw.capacityPercentage >= :threshold " +
           "ORDER BY uw.capacityPercentage DESC")
    List<UserWorkload> findHighWorkloadUsersByOrganization(
        @Param("orgId") Long organizationId,
        @Param("date") LocalDate date,
        @Param("threshold") BigDecimal threshold
    );

    /**
     * @deprecated Use findAvailableCapacityUsersByOrganization for tenant isolation
     */
    @Deprecated
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.calculationDate = :date " +
           "AND uw.capacityPercentage < :threshold ORDER BY uw.capacityPercentage ASC")
    List<UserWorkload> findAvailableCapacityUsers(
        @Param("date") LocalDate date,
        @Param("threshold") BigDecimal threshold
    );

    /**
     * Find users with available capacity - TENANT FILTERED
     */
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.organizationId = :orgId " +
           "AND uw.calculationDate = :date AND uw.capacityPercentage < :threshold " +
           "ORDER BY uw.capacityPercentage ASC")
    List<UserWorkload> findAvailableCapacityUsersByOrganization(
        @Param("orgId") Long organizationId,
        @Param("date") LocalDate date,
        @Param("threshold") BigDecimal threshold
    );
    
    /**
     * Calculate average workload for a team
     */
    @Query("SELECT AVG(uw.capacityPercentage) FROM UserWorkload uw " +
           "WHERE uw.calculationDate = :date AND uw.user.id IN :userIds")
    BigDecimal calculateAverageWorkload(
        @Param("date") LocalDate date,
        @Param("userIds") List<Long> userIds
    );
    
    /**
     * Count consecutive high workload days
     */
    @Query(value = "SELECT COUNT(*) FROM (" +
           "SELECT calculation_date FROM user_workload " +
           "WHERE user_id = :userId AND capacity_percentage >= :threshold " +
           "AND calculation_date >= CURRENT_DATE - INTERVAL '30 days' " +
           "ORDER BY calculation_date DESC) t",
           nativeQuery = true)
    int countConsecutiveHighWorkloadDays(
        @Param("userId") Long userId,
        @Param("threshold") BigDecimal threshold
    );
    
    /**
     * Find last peak workload date
     */
    @Query("SELECT MAX(uw.calculationDate) FROM UserWorkload uw " +
           "WHERE uw.user.id = :userId AND uw.capacityPercentage >= 90")
    LocalDate findLastPeakWorkloadDate(@Param("userId") Long userId);
    
    /**
     * Get workload trend data
     */
    @Query("SELECT uw.calculationDate, uw.capacityPercentage FROM UserWorkload uw " +
           "WHERE uw.user.id = :userId AND uw.calculationDate BETWEEN :startDate AND :endDate " +
           "ORDER BY uw.calculationDate")
    List<Object[]> getWorkloadTrend(
        @Param("userId") Long userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    
    /**
     * @deprecated Use findTeamWorkloadByManagerAndOrganization for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT DISTINCT uw.* FROM user_workload uw " +
           "JOIN users u ON uw.user_id = u.id " +
           "WHERE uw.calculation_date = :date " +
           "AND u.id IN (SELECT user_id FROM case_assignments ca " +
           "JOIN legal_cases lc ON ca.case_id = lc.id " +
           "WHERE lc.id IN (SELECT case_id FROM case_assignments " +
           "WHERE user_id = :managerId AND role_type = 'LEAD_ATTORNEY'))",
           nativeQuery = true)
    List<UserWorkload> findTeamWorkloadByManager(
        @Param("managerId") Long managerId,
        @Param("date") LocalDate date
    );

    /**
     * Find team members by manager - TENANT FILTERED
     */
    @Query(value = "SELECT DISTINCT uw.* FROM user_workload uw " +
           "JOIN users u ON uw.user_id = u.id " +
           "WHERE uw.organization_id = :orgId " +
           "AND uw.calculation_date = :date " +
           "AND u.id IN (SELECT user_id FROM case_assignments ca " +
           "JOIN legal_cases lc ON ca.case_id = lc.id " +
           "WHERE lc.organization_id = :orgId " +
           "AND lc.id IN (SELECT case_id FROM case_assignments " +
           "WHERE user_id = :managerId AND role_type = 'LEAD_ATTORNEY'))",
           nativeQuery = true)
    List<UserWorkload> findTeamWorkloadByManagerAndOrganization(
        @Param("orgId") Long organizationId,
        @Param("managerId") Long managerId,
        @Param("date") LocalDate date
    );

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    Optional<UserWorkload> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}