package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.TimerSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;

public interface TimerSessionRepository extends PagingAndSortingRepository<TimerSession, Long>, ListCrudRepository<TimerSession, Long> {
    
    // Find timer sessions by user
    List<TimerSession> findByUserId(Long userId);
    
    Page<TimerSession> findByUserId(Long userId, Pageable pageable);
    
    // Find timer sessions by legal case
    List<TimerSession> findByLegalCaseId(Long legalCaseId);
    
    Page<TimerSession> findByLegalCaseId(Long legalCaseId, Pageable pageable);
    
    // Find timer sessions by user and case
    List<TimerSession> findByUserIdAndLegalCaseId(Long userId, Long legalCaseId);
    
    // Find timer sessions by date range
    @Query("SELECT ts FROM TimerSession ts WHERE ts.userId = :userId AND ts.startTime BETWEEN :startDate AND :endDate ORDER BY ts.startTime DESC")
    List<TimerSession> findByUserIdAndDateRange(@Param("userId") Long userId, @Param("startDate") Date startDate, @Param("endDate") Date endDate);
    
    // Find unconverted timer sessions
    List<TimerSession> findByUserIdAndConvertedToTimeEntry(Long userId, Boolean converted);
    
    List<TimerSession> findByConvertedToTimeEntry(Boolean converted);
    
    // Find timer sessions that need to be converted to time entries
    @Query("SELECT ts FROM TimerSession ts WHERE ts.convertedToTimeEntry = false AND ts.endTime IS NOT NULL ORDER BY ts.endTime DESC")
    List<TimerSession> findUnconvertedSessions();
    
    // Get total duration for user in date range
    @Query("SELECT COALESCE(SUM(ts.duration), 0) FROM TimerSession ts WHERE ts.userId = :userId AND ts.startTime BETWEEN :startDate AND :endDate")
    Long getTotalDurationByUserAndDateRange(@Param("userId") Long userId, @Param("startDate") Date startDate, @Param("endDate") Date endDate);
    
    // Get total duration for case
    @Query("SELECT COALESCE(SUM(ts.duration), 0) FROM TimerSession ts WHERE ts.legalCaseId = :legalCaseId")
    Long getTotalDurationByCase(@Param("legalCaseId") Long legalCaseId);
    
    // Analytics queries
    @Query("SELECT COUNT(ts) FROM TimerSession ts WHERE ts.userId = :userId AND ts.startTime >= :startDate")
    Long getSessionCountByUserSince(@Param("userId") Long userId, @Param("startDate") Date startDate);
    
    @Query("SELECT AVG(ts.duration) FROM TimerSession ts WHERE ts.userId = :userId")
    Double getAverageSessionDurationByUser(@Param("userId") Long userId);
    
    // Find sessions by time entry ID
    List<TimerSession> findByTimeEntryId(Long timeEntryId);
    
    // Find sessions that were converted to time entries
    @Query("SELECT ts FROM TimerSession ts WHERE ts.convertedToTimeEntry = true AND ts.timeEntryId IS NOT NULL")
    List<TimerSession> findConvertedSessions();
    
    // Delete old timer sessions (for cleanup)
    @Query("DELETE FROM TimerSession ts WHERE ts.startTime < :cutoffDate AND ts.convertedToTimeEntry = true")
    void deleteOldConvertedSessions(@Param("cutoffDate") Date cutoffDate);
} 