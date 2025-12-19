package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ActiveTimer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ActiveTimerRepository extends PagingAndSortingRepository<ActiveTimer, Long>, ListCrudRepository<ActiveTimer, Long> {
    
    // Find active timers
    List<ActiveTimer> findByUserIdAndIsActive(Long userId, Boolean isActive);
    
    List<ActiveTimer> findByLegalCaseIdAndIsActive(Long legalCaseId, Boolean isActive);
    
    List<ActiveTimer> findByIsActive(Boolean isActive);
    
    Page<ActiveTimer> findByIsActive(Boolean isActive, Pageable pageable);
    
    // Find specific active timer for a user and case
    Optional<ActiveTimer> findByUserIdAndLegalCaseIdAndIsActive(Long userId, Long legalCaseId, Boolean isActive);
    
    // Check if user has any active timers
    @Query("SELECT COUNT(at) > 0 FROM ActiveTimer at WHERE at.userId = :userId AND at.isActive = true")
    boolean hasActiveTimer(@Param("userId") Long userId);
    
    // Get all active timers for a user (running only)
    @Query("SELECT at FROM ActiveTimer at WHERE at.userId = :userId AND at.isActive = true ORDER BY at.startTime DESC")
    List<ActiveTimer> findActiveTimersByUser(@Param("userId") Long userId);

    // Get all timers for a user (both running and paused)
    @Query("SELECT at FROM ActiveTimer at WHERE at.userId = :userId ORDER BY at.isActive DESC, at.startTime DESC")
    List<ActiveTimer> findAllTimersByUser(@Param("userId") Long userId);
    
    // Get all active timers for a case
    @Query("SELECT at FROM ActiveTimer at WHERE at.legalCaseId = :legalCaseId AND at.isActive = true ORDER BY at.startTime DESC")
    List<ActiveTimer> findActiveTimersByCase(@Param("legalCaseId") Long legalCaseId);
    
    // Stop all active timers for a user (for cleanup)
    @Query("UPDATE ActiveTimer at SET at.isActive = false WHERE at.userId = :userId AND at.isActive = true")
    void deactivateAllUserTimers(@Param("userId") Long userId);
} 
 
 
 
 
 
 