package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;
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
} 