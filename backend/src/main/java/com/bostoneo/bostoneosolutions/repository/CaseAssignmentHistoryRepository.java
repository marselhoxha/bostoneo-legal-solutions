package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.enumeration.AssignmentAction;
import com.***REMOVED***.***REMOVED***solutions.model.CaseAssignmentHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CaseAssignmentHistoryRepository extends JpaRepository<CaseAssignmentHistory, Long> {
    
    /**
     * Find history for a specific case
     */
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.caseId = :caseId " +
           "ORDER BY cah.performedAt DESC")
    Page<CaseAssignmentHistory> findByCaseId(@Param("caseId") Long caseId, Pageable pageable);
    
    /**
     * Find history for a specific user
     */
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.userId = :userId " +
           "ORDER BY cah.performedAt DESC")
    Page<CaseAssignmentHistory> findByUserId(@Param("userId") Long userId, Pageable pageable);
    
    /**
     * Find history by action type
     */
    List<CaseAssignmentHistory> findByAction(AssignmentAction action);
    
    /**
     * Find transfers between specific dates
     */
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.action = 'TRANSFERRED' " +
           "AND cah.performedAt BETWEEN :startDate AND :endDate")
    List<CaseAssignmentHistory> findTransfersBetweenDates(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
    
    /**
     * Find history performed by a specific user
     */
    @Query("SELECT cah FROM CaseAssignmentHistory cah WHERE cah.performedBy.id = :userId " +
           "ORDER BY cah.performedAt DESC")
    List<CaseAssignmentHistory> findByPerformedBy(@Param("userId") Long userId);
    
    /**
     * Count assignment changes for a case
     */
    @Query("SELECT COUNT(cah) FROM CaseAssignmentHistory cah WHERE cah.caseId = :caseId")
    long countByCaseId(@Param("caseId") Long caseId);
    
    /**
     * Find recent assignment activities
     */
    @Query("SELECT cah FROM CaseAssignmentHistory cah " +
           "WHERE cah.performedAt >= :since ORDER BY cah.performedAt DESC")
    List<CaseAssignmentHistory> findRecentActivities(
        @Param("since") LocalDateTime since,
        Pageable pageable
    );
    
    /**
     * Get assignment history statistics
     */
    @Query("SELECT cah.action, COUNT(cah) FROM CaseAssignmentHistory cah " +
           "WHERE cah.performedAt BETWEEN :startDate AND :endDate " +
           "GROUP BY cah.action")
    List<Object[]> getActionStatistics(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
}