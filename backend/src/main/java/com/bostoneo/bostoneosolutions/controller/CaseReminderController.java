package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.CaseReminderDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CreateReminderRequest;
import com.***REMOVED***.***REMOVED***solutions.dto.UpdateReminderRequest;
import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.service.CaseActivityService;
import com.***REMOVED***.***REMOVED***solutions.service.CaseReminderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/legal/cases/{caseId}/reminders")
@RequiredArgsConstructor
@Slf4j
public class CaseReminderController {

    private final CaseReminderService reminderService;
    private final CaseActivityService activityService;

    @GetMapping
    @PreAuthorize("hasAuthority('reminders:read')")
    public ResponseEntity<HttpResponse> getRemindersByCaseId(
            @PathVariable("caseId") Long caseId,
            @RequestParam(required = false) String status) {
        log.info("Getting reminders for case ID: {} with status: {}", caseId, status);
        List<CaseReminderDTO> reminders = reminderService.getRemindersByCaseId(caseId, status);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("reminders", reminders))
                        .message("Case reminders retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/{reminderId}")
    @PreAuthorize("hasAuthority('reminders:read')")
    public ResponseEntity<HttpResponse> getReminderById(
            @PathVariable("caseId") Long caseId,
            @PathVariable("reminderId") Long reminderId) {
        log.info("Getting reminder ID: {} for case ID: {}", reminderId, caseId);
        CaseReminderDTO reminder = reminderService.getReminderById(caseId, reminderId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("reminder", reminder))
                        .message("Case reminder retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('reminders:create')")
    public ResponseEntity<HttpResponse> createReminder(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody CreateReminderRequest request) {
        log.info("Creating reminder for case ID: {}", caseId);
        
        request.setCaseId(caseId); // Ensure caseId from path is used
        CaseReminderDTO createdReminder = reminderService.createReminder(request);
        
        // Log activity with userId
        activityService.logReminderCreated(caseId, createdReminder.getId(), createdReminder.getTitle(), userId);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("reminder", createdReminder))
                        .message("Case reminder created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PutMapping("/{reminderId}")
    @PreAuthorize("hasAuthority('reminders:update')")
    public ResponseEntity<HttpResponse> updateReminder(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @PathVariable("reminderId") Long reminderId,
            @Valid @RequestBody UpdateReminderRequest request) {
        log.info("Updating reminder ID: {} for case ID: {}", reminderId, caseId);
        
        CaseReminderDTO updatedReminder = reminderService.updateReminder(caseId, reminderId, request);
        
        // Log activity with userId
        activityService.logReminderUpdated(caseId, reminderId, updatedReminder.getTitle(), userId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("reminder", updatedReminder))
                        .message("Case reminder updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/{reminderId}/complete")
    @PreAuthorize("hasAuthority('reminders:update')")
    public ResponseEntity<HttpResponse> completeReminder(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @PathVariable("reminderId") Long reminderId) {
        log.info("Completing reminder ID: {} for case ID: {}", reminderId, caseId);
        
        CaseReminderDTO completedReminder = reminderService.completeReminder(caseId, reminderId);
        
        // Log activity with userId
        activityService.logReminderCompleted(caseId, reminderId, completedReminder.getTitle(), userId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("reminder", completedReminder))
                        .message("Case reminder completed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/{reminderId}")
    @PreAuthorize("hasAuthority('reminders:delete')")
    public ResponseEntity<HttpResponse> deleteReminder(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @PathVariable("reminderId") Long reminderId) {
        log.info("Deleting reminder ID: {} for case ID: {}", reminderId, caseId);
        
        // Get the reminder title before deletion for activity logging
        CaseReminderDTO reminder = reminderService.getReminderById(caseId, reminderId);
        
        reminderService.deleteReminder(caseId, reminderId);
        
        // Log activity with userId
        activityService.logReminderDeleted(caseId, reminderId, reminder.getTitle(), userId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Case reminder deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/upcoming")
    @PreAuthorize("hasAuthority('reminders:read')")
    public ResponseEntity<HttpResponse> getUpcomingReminders() {
        log.info("Getting upcoming reminders for current user");
        List<CaseReminderDTO> upcomingReminders = reminderService.getUpcomingRemindersForCurrentUser();
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("reminders", upcomingReminders))
                        .message("Upcoming reminders retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
} 