package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.ReminderQueueItem;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.repository.ReminderQueueRepository;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
@Slf4j
public class ReminderController {

    private final ReminderQueueService reminderQueueService;
    private final ReminderQueueRepository reminderQueueRepository;
    private final CalendarEventRepository calendarEventRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<List<ReminderQueueItem>> getAllReminders() {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting all reminders for org {}", orgId);
        // SECURITY: Use tenant-filtered query
        return ResponseEntity.ok(reminderQueueRepository.findByOrganizationIdOrderByScheduledTimeAsc(orgId));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<List<ReminderQueueItem>> getPendingReminders() {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting pending reminders for org {}", orgId);
        // SECURITY: Use tenant-filtered query
        return ResponseEntity.ok(reminderQueueRepository.findPendingByOrganizationId(orgId));
    }

    @GetMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<List<ReminderQueueItem>> getRemindersByEvent(@PathVariable Long eventId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting reminders for event {} in org {}", eventId, orgId);

        // SECURITY: Verify event belongs to this organization first
        Optional<CalendarEvent> eventOpt = calendarEventRepository.findByIdAndOrganizationId(eventId, orgId);
        if (eventOpt.isEmpty()) {
            log.warn("Unauthorized access attempt to event {} by org {}", eventId, orgId);
            return ResponseEntity.notFound().build();
        }

        // SECURITY: Use tenant-filtered query
        return ResponseEntity.ok(reminderQueueRepository.findByOrganizationIdAndEventId(orgId, eventId));
    }

    @PostMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<?> createReminderForEvent(
            @PathVariable Long eventId,
            @RequestParam Integer minutesBefore,
            @RequestParam(defaultValue = "PRIMARY") String reminderType) {

        Long orgId = getRequiredOrganizationId();
        log.info("Creating reminder for event {} in org {}", eventId, orgId);

        // SECURITY: Use tenant-filtered query to verify event access
        Optional<CalendarEvent> eventOpt = calendarEventRepository.findByIdAndOrganizationId(eventId, orgId);

        if (eventOpt.isEmpty()) {
            log.warn("Unauthorized access attempt to create reminder for event {} by org {}", eventId, orgId);
            return ResponseEntity.notFound().build();
        }

        CalendarEvent event = eventOpt.get();

        // Check for valid minutesBefore values (e.g., minimum 5 minutes, maximum 1 week)
        if (minutesBefore < 5 || minutesBefore > 10080) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Minutes before must be between 5 minutes and 1 week (10080 minutes)")
            );
        }

        ReminderQueueItem reminder = reminderQueueService.enqueueReminder(event, minutesBefore, reminderType);

        if (reminder == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Cannot create reminder for past events or the reminder time has already passed")
            );
        }

        // Set organization ID on the reminder
        reminder.setOrganizationId(orgId);
        reminder = reminderQueueRepository.save(reminder);

        return ResponseEntity.status(HttpStatus.CREATED).body(reminder);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<Void> deleteReminder(@PathVariable Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting reminder {} in org {}", id, orgId);

        // SECURITY: Use tenant-filtered query
        Optional<ReminderQueueItem> reminderOpt = reminderQueueRepository.findByIdAndOrganizationId(id, orgId);

        if (reminderOpt.isEmpty()) {
            log.warn("Unauthorized access attempt to delete reminder {} by org {}", id, orgId);
            return ResponseEntity.notFound().build();
        }

        reminderQueueRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<?> deleteRemindersForEvent(@PathVariable Long eventId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting reminders for event {} in org {}", eventId, orgId);

        // SECURITY: Verify event belongs to this organization
        Optional<CalendarEvent> eventOpt = calendarEventRepository.findByIdAndOrganizationId(eventId, orgId);
        if (eventOpt.isEmpty()) {
            log.warn("Unauthorized access attempt to delete reminders for event {} by org {}", eventId, orgId);
            return ResponseEntity.notFound().build();
        }

        reminderQueueService.deleteRemindersForEvent(eventId);
        return ResponseEntity.ok(Map.of("message", "Reminders deleted successfully"));
    }

    @PostMapping("/process")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<?> processReminderQueue() {
        try {
            // Note: Processing is system-level, processes all pending reminders
            reminderQueueService.processReminderQueue();
            return ResponseEntity.ok(Map.of("message", "Reminder queue processed successfully"));
        } catch (Exception e) {
            log.error("Error processing reminder queue", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error processing reminder queue", "error", e.getMessage()));
        }
    }
}
