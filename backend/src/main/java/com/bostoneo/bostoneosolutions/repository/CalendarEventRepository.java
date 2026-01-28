package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
    // Find events by case ID
    List<CalendarEvent> findByCaseId(Long caseId);
    
    // Find events by user ID
    List<CalendarEvent> findByUserId(Long userId);
    
    // Find events by event type
    List<CalendarEvent> findByEventType(String eventType);
    
    // Find events by status
    List<CalendarEvent> findByStatus(String status);
    
    // Find events in a date range
    @Query("SELECT e FROM CalendarEvent e WHERE " +
           "(e.startTime BETWEEN :startDate AND :endDate) OR " +
           "(e.endTime BETWEEN :startDate AND :endDate) OR " +
           "(e.startTime <= :startDate AND e.endTime >= :endDate)")
    List<CalendarEvent> findByDateRange(
            @Param("startDate") LocalDateTime startDate, 
            @Param("endDate") LocalDateTime endDate);
    
    // Find upcoming events requiring reminders
    @Query("SELECT e FROM CalendarEvent e WHERE " +
           "e.reminderMinutes IS NOT NULL AND " +
           "e.reminderSent = false AND " +
           "e.startTime <= :reminderTime")
    List<CalendarEvent> findEventsRequiringReminders(
            @Param("reminderTime") LocalDateTime reminderTime);
    
    // Find events by case ID and date range
    @Query("SELECT e FROM CalendarEvent e WHERE " +
           "e.caseId = :caseId AND " +
           "((e.startTime BETWEEN :startDate AND :endDate) OR " +
           "(e.endTime BETWEEN :startDate AND :endDate) OR " +
           "(e.startTime <= :startDate AND e.endTime >= :endDate))")
    List<CalendarEvent> findByCaseIdAndDateRange(
            @Param("caseId") Long caseId,
            @Param("startDate") LocalDateTime startDate, 
            @Param("endDate") LocalDateTime endDate);
    
    // Find events by user ID and date range
    @Query("SELECT e FROM CalendarEvent e WHERE " +
           "e.userId = :userId AND " +
           "((e.startTime BETWEEN :startDate AND :endDate) OR " +
           "(e.endTime BETWEEN :startDate AND :endDate) OR " +
           "(e.startTime <= :startDate AND e.endTime >= :endDate))")
    List<CalendarEvent> findByUserIdAndDateRange(
            @Param("userId") Long userId,
            @Param("startDate") LocalDateTime startDate, 
            @Param("endDate") LocalDateTime endDate);

    // Add method to find events by multiple case IDs
    Page<CalendarEvent> findByCaseIdIn(List<Long> caseIds, Pageable pageable);

    List<CalendarEvent> findByStartTimeBetween(LocalDateTime start, LocalDateTime end);

    // ==================== TENANT-FILTERED METHODS ====================

    List<CalendarEvent> findByOrganizationId(Long organizationId);

    Page<CalendarEvent> findByOrganizationId(Long organizationId, Pageable pageable);

    List<CalendarEvent> findByOrganizationIdAndUserId(Long organizationId, Long userId);

    @Query("SELECT e FROM CalendarEvent e WHERE e.organizationId = :orgId AND " +
           "(e.startTime BETWEEN :startDate AND :endDate)")
    List<CalendarEvent> findByOrganizationIdAndDateRange(@Param("orgId") Long organizationId,
                                                         @Param("startDate") LocalDateTime startDate,
                                                         @Param("endDate") LocalDateTime endDate);

    @Query("SELECT e FROM CalendarEvent e WHERE e.organizationId = :orgId AND e.userId = :userId AND " +
           "(e.startTime BETWEEN :startDate AND :endDate)")
    List<CalendarEvent> findByOrganizationIdAndUserIdAndDateRange(@Param("orgId") Long organizationId,
                                                                   @Param("userId") Long userId,
                                                                   @Param("startDate") LocalDateTime startDate,
                                                                   @Param("endDate") LocalDateTime endDate);

    long countByOrganizationId(Long organizationId);

    // Secure findById with org verification
    java.util.Optional<CalendarEvent> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    List<CalendarEvent> findByOrganizationIdAndCaseId(Long organizationId, Long caseId);

    List<CalendarEvent> findByOrganizationIdAndEventType(Long organizationId, String eventType);

    List<CalendarEvent> findByOrganizationIdAndStatus(Long organizationId, String status);

    @Query("SELECT e FROM CalendarEvent e WHERE e.organizationId = :orgId AND e.caseId = :caseId AND " +
           "(e.startTime BETWEEN :startDate AND :endDate)")
    List<CalendarEvent> findByOrganizationIdAndCaseIdAndDateRange(@Param("orgId") Long organizationId,
                                                                   @Param("caseId") Long caseId,
                                                                   @Param("startDate") LocalDateTime startDate,
                                                                   @Param("endDate") LocalDateTime endDate);

    @Query("SELECT e FROM CalendarEvent e WHERE e.organizationId = :orgId AND e.caseId IN :caseIds")
    Page<CalendarEvent> findByOrganizationIdAndCaseIdIn(@Param("orgId") Long organizationId,
                                                         @Param("caseIds") List<Long> caseIds,
                                                         Pageable pageable);

    // Find events requiring reminders by organization (for scheduled tasks)
    @Query("SELECT e FROM CalendarEvent e WHERE e.organizationId = :organizationId AND " +
           "e.reminderMinutes IS NOT NULL AND " +
           "e.reminderSent = false AND " +
           "e.startTime <= :reminderTime")
    List<CalendarEvent> findEventsRequiringRemindersByOrganizationId(
            @Param("organizationId") Long organizationId,
            @Param("reminderTime") LocalDateTime reminderTime);
} 