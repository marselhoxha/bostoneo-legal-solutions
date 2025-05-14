package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/calendar/external")
@RequiredArgsConstructor
@Slf4j
public class ExternalCalendarController {

    private final CalendarEventService calendarEventService;

    @PostMapping("/sync/google")
    @PreAuthorize("hasAuthority('SYNC:CALENDAR')")
    public ResponseEntity<HttpResponse> syncWithGoogleCalendar(
            @AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("Syncing with Google Calendar for user ID: {}", userId);
        
        // Call service method to sync with Google Calendar
        calendarEventService.syncWithExternalCalendar("GOOGLE", userId.toString());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Calendar events synced with Google Calendar")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/sync/outlook")
    @PreAuthorize("hasAuthority('SYNC:CALENDAR')")
    public ResponseEntity<HttpResponse> syncWithOutlookCalendar(
            @AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("Syncing with Microsoft Outlook Calendar for user ID: {}", userId);
        
        // Call service method to sync with Outlook Calendar
        calendarEventService.syncWithExternalCalendar("OUTLOOK", userId.toString());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Calendar events synced with Microsoft Outlook Calendar")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/export/ical")
    @PreAuthorize("hasAuthority('READ:CALENDAR')")
    public ResponseEntity<String> exportAsICal(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestParam(required = false, defaultValue = "30") int days) {
        log.info("Exporting calendar events as iCal for user ID: {}", userId);
        
        // Get upcoming events for the user
        List<CalendarEventDTO> events = calendarEventService.getUpcomingEvents(days);
        
        // Generate iCal data
        String iCalData = calendarEventService.generateICalendarData(events);
        
        // Set appropriate headers for .ics file download
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=calendar_events.ics");
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(iCalData);
    }

    @GetMapping("/export/ical/case/{caseId}")
    @PreAuthorize("hasAuthority('READ:CALENDAR') and hasAuthority('READ:CASE')")
    public ResponseEntity<String> exportCaseEventsAsICal(
            @PathVariable Long caseId) {
        log.info("Exporting calendar events as iCal for case ID: {}", caseId);
        
        // Get events for the specified case
        List<CalendarEventDTO> events = calendarEventService.getEventsByCaseId(caseId);
        
        // Generate iCal data
        String iCalData = calendarEventService.generateICalendarData(events);
        
        // Set appropriate headers for .ics file download
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=case_" + caseId + "_events.ics");
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(iCalData);
    }
} 