package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.dto.CreateCalendarEventRequest;
import com.bostoneo.bostoneosolutions.enumeration.CalendarEventType;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
@Slf4j
public class CalendarEventController {

    private final CalendarEventService calendarEventService;
    private final CalendarEventRepository calendarEventRepository;

    @GetMapping("/events")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getAllEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("Fetching all calendar events, page: {}, size: {}", page, size);
        
        Page<CalendarEventDTO> eventsPage = calendarEventService.getAllEvents(page, size);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "events", eventsPage.getContent(),
                                "currentPage", eventsPage.getNumber(),
                                "totalItems", eventsPage.getTotalElements(),
                                "totalPages", eventsPage.getTotalPages()
                        ))
                        .message("Calendar events retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/{id}")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getEventById(@PathVariable Long id) {
        log.info("Fetching calendar event with ID: {}", id);
        
        CalendarEventDTO event = calendarEventService.getEventById(id);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", event))
                        .message("Calendar event retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/events")
    @PreAuthorize("hasAuthority('CREATE:CALENDAR')")
    public ResponseEntity<HttpResponse> createEvent(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @Valid @RequestBody CreateCalendarEventRequest request) {
        log.info("Creating calendar event: {} for authenticated user ID: {}", request.getTitle(), userId);
        
        // Validate that userId is not null - this should never happen with proper security
        if (userId == null) {
            log.error("Authenticated user ID is null when creating event - this indicates a security configuration issue");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Unable to determine authenticated user")
                        .status(HttpStatus.UNAUTHORIZED)
                        .statusCode(HttpStatus.UNAUTHORIZED.value())
                        .build());
        }
        
        CalendarEventDTO eventDTO = new CalendarEventDTO();
        eventDTO.setTitle(request.getTitle());
        eventDTO.setDescription(request.getDescription());
        eventDTO.setStartTime(request.getStartTime());
        eventDTO.setEndTime(request.getEndTime());
        eventDTO.setLocation(request.getLocation());
        eventDTO.setEventType(request.getEventType());
        eventDTO.setStatus("SCHEDULED"); // Default status
        eventDTO.setAllDay(request.getAllDay());
        eventDTO.setRecurrenceRule(request.getRecurrenceRule());
        eventDTO.setColor(request.getColor());
        eventDTO.setCaseId(request.getCaseId());
        eventDTO.setUserId(userId); // Set from authenticated user
        eventDTO.setReminderMinutes(request.getReminderMinutes());
        eventDTO.setReminderSent(false);
        eventDTO.setExternalCalendar(request.getExternalCalendar());
        
        // Set notification preferences
        eventDTO.setEmailNotification(request.getEmailNotification());
        eventDTO.setPushNotification(request.getPushNotification());
        
        // Set additional fields
        eventDTO.setHighPriority(request.getHighPriority());
        eventDTO.setAdditionalReminders(request.getAdditionalReminders());
        
        CalendarEventDTO createdEvent = calendarEventService.createEvent(eventDTO);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", createdEvent))
                        .message("Calendar event created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PutMapping("/events/{id}")
    @PreAuthorize("hasAuthority('UPDATE:CALENDAR')")
    public ResponseEntity<HttpResponse> updateEvent(
            @PathVariable Long id,
            @Valid @RequestBody CalendarEventDTO eventDTO) {
        log.info("Updating calendar event with ID: {}", id);
        
        CalendarEventDTO updatedEvent = calendarEventService.updateEvent(id, eventDTO);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", updatedEvent))
                        .message("Calendar event updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/events/{id}")
    @PreAuthorize("hasAuthority('DELETE:CALENDAR')")
    public ResponseEntity<HttpResponse> deleteEvent(@PathVariable Long id) {
        log.info("Deleting calendar event with ID: {}", id);
        
        calendarEventService.deleteEvent(id);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Calendar event deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/case/{caseId}")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getEventsByCaseId(@PathVariable Long caseId) {
        log.info("Fetching calendar events for case ID: {}", caseId);
        
        List<CalendarEventDTO> events = calendarEventService.getEventsByCaseId(caseId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("events", events))
                        .message("Calendar events for case retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/date-range")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getEventsByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        log.info("Fetching calendar events between {} and {}", startDate, endDate);
        
        List<CalendarEventDTO> events = calendarEventService.getEventsByDateRange(startDate, endDate);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("events", events))
                        .message("Calendar events for date range retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/upcoming")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getUpcomingEvents(
            @RequestParam(defaultValue = "7") int days) {
        log.info("Fetching upcoming calendar events for the next {} days", days);
        
        List<CalendarEventDTO> events = calendarEventService.getUpcomingEvents(days);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("events", events))
                        .message("Upcoming calendar events retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/today")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getTodayEvents() {
        log.info("Fetching today's calendar events");
        
        List<CalendarEventDTO> events = calendarEventService.getTodayEvents();
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("events", events))
                        .message("Today's calendar events retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/types")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<HttpResponse> getEventTypes() {
        log.info("Fetching calendar event types");
        
        List<String> eventTypes = Arrays.stream(CalendarEventType.values())
                .map(Enum::name)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("eventTypes", eventTypes))
                        .message("Calendar event types retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/events/export")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<String> exportEvents(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        log.info("Exporting calendar events as iCal");
        
        List<CalendarEventDTO> events;
        if (startDate != null && endDate != null) {
            events = calendarEventService.getEventsByDateRange(startDate, endDate);
        } else {
            // Default to upcoming events if no date range provided
            events = calendarEventService.getUpcomingEvents(30);
        }
        
        String iCalData = calendarEventService.generateICalendarData(events);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=calendar_events.ics");
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(iCalData);
    }

    @GetMapping("/events/case/{caseId}/export")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<String> exportCaseEvents(@PathVariable Long caseId) {
        log.info("Exporting calendar events for case ID: {} as iCal", caseId);
        
        List<CalendarEventDTO> events = calendarEventService.getEventsByCaseId(caseId);
        String iCalData = calendarEventService.generateICalendarData(events);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=case_" + caseId + "_events.ics");
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(iCalData);
    }

    /**
     * Test endpoint to manually trigger reminders for a specific event
     * This endpoint is for development/testing only and should be secured or removed in production
     */
    @GetMapping("/test-reminder/{eventId}")
    public ResponseEntity<?> testReminderForEvent(@PathVariable Long eventId) {
        log.info("Testing reminder for event ID: {}", eventId);
        
        try {
            // Get the event 
            CalendarEventDTO eventDTO = calendarEventService.getEventById(eventId);
            if (eventDTO == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(HttpResponse.builder()
                            .timeStamp(LocalDateTime.now().toString())
                            .statusCode(HttpStatus.NOT_FOUND.value())
                            .status(HttpStatus.NOT_FOUND)
                            .reason("Event not found")
                            .message("Event with ID " + eventId + " not found")
                            .build());
            }
            
            // Process reminders
            calendarEventService.processReminderForEvent(eventId);
            
            return ResponseEntity.ok()
                    .body(HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .statusCode(HttpStatus.OK.value())
                        .status(HttpStatus.OK)
                        .reason("Success")
                        .message("Reminder test triggered successfully for event: " + eventId)
                        .build());
        } catch (Exception e) {
            log.error("Error testing reminder for event {}: {}", eventId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                        .timeStamp(LocalDateTime.now().toString())
                        .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                        .status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .reason("Error testing reminder")
                        .message(e.getMessage())
                        .build());
        }
    }
} 