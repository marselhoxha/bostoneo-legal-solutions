package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.CalendarEventDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CreateCalendarEventRequest;
import com.***REMOVED***.***REMOVED***solutions.dto.LegalCaseDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CalendarEventStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CalendarEventType;
import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import com.***REMOVED***.***REMOVED***solutions.service.CalendarEventService;
import com.***REMOVED***.***REMOVED***solutions.service.LegalCaseService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/legal/cases/{caseId}/calendar")
@RequiredArgsConstructor
@Slf4j
public class CaseCalendarController {

    private final CalendarEventService calendarEventService;
    private final LegalCaseService legalCaseService;

    @GetMapping("/events")
    @PreAuthorize("hasAuthority('READ:CALENDAR') and hasAuthority('READ:CASE')")
    public ResponseEntity<HttpResponse> getCaseEvents(@PathVariable Long caseId) {
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

    @PostMapping("/events")
    @PreAuthorize("hasAuthority('CREATE:CALENDAR') and hasAuthority('UPDATE:CASE')")
    public ResponseEntity<HttpResponse> createCaseEvent(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId,
            @Valid @RequestBody CreateCalendarEventRequest request) {
        log.info("Creating calendar event for case ID: {}", caseId);
        
        // Ensure the case exists
        LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
        if (legalCase == null) {
            throw new EntityNotFoundException("Case not found with ID: " + caseId);
        }
        
        CalendarEventDTO eventDTO = new CalendarEventDTO();
        eventDTO.setTitle(request.getTitle());
        eventDTO.setDescription(request.getDescription());
        eventDTO.setStartTime(request.getStartTime());
        eventDTO.setEndTime(request.getEndTime());
        eventDTO.setLocation(request.getLocation());
        eventDTO.setEventType(request.getEventType());
        eventDTO.setStatus(CalendarEventStatus.SCHEDULED.name());
        eventDTO.setAllDay(request.getAllDay());
        eventDTO.setRecurrenceRule(request.getRecurrenceRule());
        eventDTO.setColor(request.getColor());
        eventDTO.setCaseId(caseId);
        eventDTO.setCaseTitle(legalCase.getTitle());
        eventDTO.setCaseNumber(legalCase.getCaseNumber());
        eventDTO.setUserId(userId);
        eventDTO.setReminderMinutes(request.getReminderMinutes());
        eventDTO.setReminderSent(false);
        eventDTO.setExternalCalendar(request.getExternalCalendar());
        
        CalendarEventDTO createdEvent = calendarEventService.createEvent(eventDTO);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", createdEvent))
                        .message("Calendar event created successfully for case")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PostMapping("/court-date")
    @PreAuthorize("hasAuthority('CREATE:CALENDAR') and hasAuthority('UPDATE:CASE')")
    public ResponseEntity<HttpResponse> createCourtDateEvent(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId,
            @RequestParam String title,
            @RequestParam LocalDateTime startTime,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String description,
            @RequestParam(required = false, defaultValue = "60") Integer reminderMinutes) {
        log.info("Creating court date event for case ID: {}", caseId);
        
        // Ensure the case exists
        LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
        if (legalCase == null) {
            throw new EntityNotFoundException("Case not found with ID: " + caseId);
        }
        
        // Default end time to 1 hour after start
        LocalDateTime endTime = startTime.plusHours(1);
        
        // Create court date event
        CalendarEventDTO eventDTO = new CalendarEventDTO();
        eventDTO.setTitle(title);
        eventDTO.setDescription(description);
        eventDTO.setStartTime(startTime);
        eventDTO.setEndTime(endTime);
        eventDTO.setLocation(location);
        eventDTO.setEventType(CalendarEventType.COURT_DATE.name());
        eventDTO.setStatus(CalendarEventStatus.SCHEDULED.name());
        eventDTO.setAllDay(false);
        eventDTO.setColor("#B71C1C"); // Red color for court dates
        eventDTO.setCaseId(caseId);
        eventDTO.setCaseTitle(legalCase.getTitle());
        eventDTO.setCaseNumber(legalCase.getCaseNumber());
        eventDTO.setUserId(userId);
        eventDTO.setReminderMinutes(reminderMinutes);
        eventDTO.setReminderSent(false);
        
        CalendarEventDTO createdEvent = calendarEventService.createEvent(eventDTO);
        
        // Also update the case's nextHearing date if applicable
        if (legalCase.getNextHearing() == null || startTime.toLocalDate().isBefore(legalCase.getNextHearing().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate())) {
            // Create a copy of the case with updated hearing date
            LegalCaseDTO updatedCase = new LegalCaseDTO();
            updatedCase.setId(legalCase.getId());
            updatedCase.setTitle(legalCase.getTitle());
            updatedCase.setCaseNumber(legalCase.getCaseNumber());
            updatedCase.setStatus(legalCase.getStatus());
            updatedCase.setNextHearing(java.util.Date.from(startTime.atZone(java.time.ZoneId.systemDefault()).toInstant()));
            
            // Only update the nextHearing field
            legalCaseService.updateCase(caseId, updatedCase);
        }
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", createdEvent))
                        .message("Court date event created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PostMapping("/deadline")
    @PreAuthorize("hasAuthority('CREATE:CALENDAR') and hasAuthority('UPDATE:CASE')")
    public ResponseEntity<HttpResponse> createDeadlineEvent(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId,
            @RequestParam String title,
            @RequestParam LocalDateTime dueDate,
            @RequestParam(required = false) String description,
            @RequestParam(required = false, defaultValue = "1440") Integer reminderMinutes) { // Default 1 day reminder
        log.info("Creating deadline event for case ID: {}", caseId);
        
        // Ensure the case exists
        LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
        if (legalCase == null) {
            throw new EntityNotFoundException("Case not found with ID: " + caseId);
        }
        
        // Create deadline event (all-day event)
        CalendarEventDTO eventDTO = new CalendarEventDTO();
        eventDTO.setTitle("DEADLINE: " + title);
        eventDTO.setDescription(description);
        eventDTO.setStartTime(LocalDateTime.of(dueDate.toLocalDate(), LocalTime.MIN));
        eventDTO.setEndTime(LocalDateTime.of(dueDate.toLocalDate(), LocalTime.MAX));
        eventDTO.setEventType(CalendarEventType.DEADLINE.name());
        eventDTO.setStatus(CalendarEventStatus.SCHEDULED.name());
        eventDTO.setAllDay(true);
        eventDTO.setColor("#FB8C00"); // Orange color for deadlines
        eventDTO.setCaseId(caseId);
        eventDTO.setCaseTitle(legalCase.getTitle());
        eventDTO.setCaseNumber(legalCase.getCaseNumber());
        eventDTO.setUserId(userId);
        eventDTO.setReminderMinutes(reminderMinutes);
        eventDTO.setReminderSent(false);
        
        CalendarEventDTO createdEvent = calendarEventService.createEvent(eventDTO);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", createdEvent))
                        .message("Deadline event created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PostMapping("/meeting")
    @PreAuthorize("hasAuthority('CREATE:CALENDAR') and hasAuthority('UPDATE:CASE')")
    public ResponseEntity<HttpResponse> createMeetingEvent(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId,
            @RequestParam String title,
            @RequestParam LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String description,
            @RequestParam(required = false, defaultValue = "30") Integer reminderMinutes) {
        log.info("Creating meeting event for case ID: {}", caseId);
        
        // Ensure the case exists
        LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
        if (legalCase == null) {
            throw new EntityNotFoundException("Case not found with ID: " + caseId);
        }
        
        // Default end time to 1 hour after start if not provided
        LocalDateTime meetingEndTime = endTime != null ? endTime : startTime.plusHours(1);
        
        // Create meeting event
        CalendarEventDTO eventDTO = new CalendarEventDTO();
        eventDTO.setTitle(title);
        eventDTO.setDescription(description);
        eventDTO.setStartTime(startTime);
        eventDTO.setEndTime(meetingEndTime);
        eventDTO.setLocation(location);
        eventDTO.setEventType(CalendarEventType.CLIENT_MEETING.name());
        eventDTO.setStatus(CalendarEventStatus.SCHEDULED.name());
        eventDTO.setAllDay(false);
        eventDTO.setColor("#2196F3"); // Blue color for meetings
        eventDTO.setCaseId(caseId);
        eventDTO.setCaseTitle(legalCase.getTitle());
        eventDTO.setCaseNumber(legalCase.getCaseNumber());
        eventDTO.setUserId(userId);
        eventDTO.setReminderMinutes(reminderMinutes);
        eventDTO.setReminderSent(false);
        
        CalendarEventDTO createdEvent = calendarEventService.createEvent(eventDTO);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", createdEvent))
                        .message("Meeting event created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PostMapping("/create-from-case-dates")
    @PreAuthorize("hasAuthority('CREATE:CALENDAR') and hasAuthority('UPDATE:CASE')")
    public ResponseEntity<HttpResponse> createEventsFromCaseDates(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId) {
        log.info("Creating calendar events from important case dates for case ID: {}", caseId);
        
        // Ensure the case exists
        LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
        if (legalCase == null) {
            throw new EntityNotFoundException("Case not found with ID: " + caseId);
        }
        
        List<CalendarEventDTO> createdEvents = new ArrayList<>();
        
        // Create event for filing date if present
        if (legalCase.getFilingDate() != null) {
            CalendarEventDTO filingEvent = new CalendarEventDTO();
            filingEvent.setTitle("Filing: " + legalCase.getCaseNumber());
            filingEvent.setDescription("Case filing date for " + legalCase.getTitle());
            
            LocalDateTime filingDate = legalCase.getFilingDate().toInstant()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toLocalDateTime();
            
            filingEvent.setStartTime(LocalDateTime.of(filingDate.toLocalDate(), LocalTime.MIN));
            filingEvent.setEndTime(LocalDateTime.of(filingDate.toLocalDate(), LocalTime.MAX));
            filingEvent.setEventType(CalendarEventType.DEADLINE.name());
            filingEvent.setStatus(CalendarEventStatus.COMPLETED.name()); // Assuming past event
            filingEvent.setAllDay(true);
            filingEvent.setColor("#4CAF50"); // Green for filing
            filingEvent.setCaseId(caseId);
            filingEvent.setUserId(userId);
            
            CalendarEventDTO createdFilingEvent = calendarEventService.createEvent(filingEvent);
            createdEvents.add(createdFilingEvent);
        }
        
        // Create event for next hearing if present
        if (legalCase.getNextHearing() != null) {
            CalendarEventDTO hearingEvent = new CalendarEventDTO();
            hearingEvent.setTitle("Hearing: " + legalCase.getCaseNumber());
            hearingEvent.setDescription("Court hearing for " + legalCase.getTitle());
            
            LocalDateTime hearingDate = legalCase.getNextHearing().toInstant()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toLocalDateTime();
            
            hearingEvent.setStartTime(LocalDateTime.of(hearingDate.toLocalDate(), LocalTime.of(9, 0))); // Default 9 AM
            hearingEvent.setEndTime(LocalDateTime.of(hearingDate.toLocalDate(), LocalTime.of(11, 0))); // Default 2 hours
            hearingEvent.setEventType(CalendarEventType.COURT_DATE.name());
            hearingEvent.setStatus(CalendarEventStatus.SCHEDULED.name());
            hearingEvent.setAllDay(false);
            hearingEvent.setColor("#B71C1C"); // Red for court dates
            hearingEvent.setCaseId(caseId);
            hearingEvent.setUserId(userId);
            hearingEvent.setReminderMinutes(1440); // 1 day reminder
            hearingEvent.setReminderSent(false);
            
            // Add court information if available
            if (legalCase.getCourtName() != null) {
                hearingEvent.setLocation(legalCase.getCourtName() + 
                        (legalCase.getCourtroom() != null ? ", " + legalCase.getCourtroom() : ""));
            }
            
            CalendarEventDTO createdHearingEvent = calendarEventService.createEvent(hearingEvent);
            createdEvents.add(createdHearingEvent);
        }
        
        // Create event for trial date if present
        if (legalCase.getTrialDate() != null) {
            CalendarEventDTO trialEvent = new CalendarEventDTO();
            trialEvent.setTitle("Trial: " + legalCase.getCaseNumber());
            trialEvent.setDescription("Trial for " + legalCase.getTitle());
            
            LocalDateTime trialDate = legalCase.getTrialDate().toInstant()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toLocalDateTime();
            
            trialEvent.setStartTime(LocalDateTime.of(trialDate.toLocalDate(), LocalTime.of(9, 0))); // Default 9 AM
            trialEvent.setEndTime(LocalDateTime.of(trialDate.toLocalDate(), LocalTime.of(17, 0))); // Default full day
            trialEvent.setEventType(CalendarEventType.COURT_DATE.name());
            trialEvent.setStatus(CalendarEventStatus.SCHEDULED.name());
            trialEvent.setAllDay(true);
            trialEvent.setColor("#B71C1C"); // Red for court dates
            trialEvent.setCaseId(caseId);
            trialEvent.setUserId(userId);
            trialEvent.setReminderMinutes(4320); // 3 days reminder
            trialEvent.setReminderSent(false);
            
            // Add court information if available
            if (legalCase.getCourtName() != null) {
                trialEvent.setLocation(legalCase.getCourtName() + 
                        (legalCase.getCourtroom() != null ? ", " + legalCase.getCourtroom() : ""));
            }
            
            CalendarEventDTO createdTrialEvent = calendarEventService.createEvent(trialEvent);
            createdEvents.add(createdTrialEvent);
        }
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("events", createdEvents))
                        .message("Calendar events created from case dates")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }
} 