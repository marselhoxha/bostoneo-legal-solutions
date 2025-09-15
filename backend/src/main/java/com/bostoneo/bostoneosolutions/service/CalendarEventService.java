package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import org.springframework.data.domain.Page;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public interface CalendarEventService {
    
    // CRUD operations
    CalendarEventDTO createEvent(CalendarEventDTO eventDTO);
    CalendarEventDTO getEventById(Long id);
    Page<CalendarEventDTO> getAllEvents(int page, int size);
    CalendarEventDTO updateEvent(Long id, CalendarEventDTO eventDTO);
    void deleteEvent(Long id);
    
    // Case-related operations
    List<CalendarEventDTO> getEventsByCaseId(Long caseId);
    List<CalendarEventDTO> getEventsByCaseIdAndDateRange(Long caseId, LocalDateTime startDate, LocalDateTime endDate);
    
    // User-related operations
    List<CalendarEventDTO> getEventsByUserId(Long userId);
    List<CalendarEventDTO> getEventsByUserIdAndDateRange(Long userId, LocalDateTime startDate, LocalDateTime endDate);
    
    // Time-related operations
    List<CalendarEventDTO> getEventsByDateRange(LocalDateTime startDate, LocalDateTime endDate);
    List<CalendarEventDTO> getUpcomingEvents(int days);
    List<CalendarEventDTO> getTodayEvents();
    
    // Status and type operations
    List<CalendarEventDTO> getEventsByStatus(String status);
    List<CalendarEventDTO> getEventsByType(String eventType);
    
    // Automated operations
    void processEventReminders();
    
    // External calendar operations
    void syncWithExternalCalendar(String calendarType, String userId);
    String generateICalendarData(List<CalendarEventDTO> events);
    
    void processReminderForEvent(Long eventId);
    
    // Add method for filtering events by case IDs
    Page<CalendarEventDTO> getEventsForCases(Set<Long> caseIds, int page, int size);
    
    // Add method for role-based event filtering
    Page<CalendarEventDTO> getEventsForUser(Long userId, int page, int size);
} 