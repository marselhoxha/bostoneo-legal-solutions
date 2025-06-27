package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.WorkloadCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkloadCalculationRepository extends JpaRepository<WorkloadCalculation, Long> {
    
    /**
     * Find calculation for a user on a specific date
     */
    Optional<WorkloadCalculation> findByUserIdAndCalculationDate(Long userId, LocalDate calculationDate);
    
    /**
     * Find historical calculations for a user
     */
    @Query("SELECT wc FROM WorkloadCalculation wc WHERE wc.userId = :userId " +
           "ORDER BY wc.calculationDate DESC")
    List<WorkloadCalculation> findByUserIdOrderByCalculationDateDesc(@Param("userId") Long userId);
    
    /**
     * Find calculations within a date range
     */
    @Query("SELECT wc FROM WorkloadCalculation wc WHERE wc.userId = :userId " +
           "AND wc.calculationDate BETWEEN :startDate AND :endDate " +
           "ORDER BY wc.calculationDate")
    List<WorkloadCalculation> findByUserIdAndDateRange(
        @Param("userId") Long userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    
    /**
     * Clean up old calculations
     */
    @Query("DELETE FROM WorkloadCalculation wc WHERE wc.calculationDate < :beforeDate")
    void deleteOldCalculations(@Param("beforeDate") LocalDate beforeDate);
}