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
     * Find workload for a user on a specific date
     */
    Optional<UserWorkload> findByUserIdAndCalculationDate(Long userId, LocalDate calculationDate);
    
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
     * Find users with high workload
     */
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.calculationDate = :date " +
           "AND uw.capacityPercentage >= :threshold ORDER BY uw.capacityPercentage DESC")
    List<UserWorkload> findHighWorkloadUsers(
        @Param("date") LocalDate date,
        @Param("threshold") BigDecimal threshold
    );
    
    /**
     * Find users with available capacity
     */
    @Query("SELECT uw FROM UserWorkload uw WHERE uw.calculationDate = :date " +
           "AND uw.capacityPercentage < :threshold ORDER BY uw.capacityPercentage ASC")
    List<UserWorkload> findAvailableCapacityUsers(
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
           "AND calculation_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) " +
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
     * Find team members by manager
     */
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
}