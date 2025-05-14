package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.ReminderQueueItem;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.repository.ReminderQueueRepository;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/reminders")
@Slf4j
public class ReminderController {

    @Autowired
    private ReminderQueueService reminderQueueService;
    
    @Autowired
    private ReminderQueueRepository reminderQueueRepository;
    
    @Autowired
    private CalendarEventRepository calendarEventRepository;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<ReminderQueueItem>> getAllReminders() {
        return ResponseEntity.ok(reminderQueueRepository.findAll());
    }
    
    @GetMapping("/pending")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<ReminderQueueItem>> getPendingReminders() {
        return ResponseEntity.ok(reminderQueueService.getPendingReminders());
    }
    
    @GetMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<List<ReminderQueueItem>> getRemindersByEvent(@PathVariable Long eventId) {
        return ResponseEntity.ok(reminderQueueRepository.findByEventId(eventId));
    }
    
    @PostMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<?> createReminderForEvent(
            @PathVariable Long eventId,
            @RequestParam Integer minutesBefore,
            @RequestParam(defaultValue = "PRIMARY") String reminderType) {
        
        Optional<CalendarEvent> eventOpt = calendarEventRepository.findById(eventId);
        
        if (eventOpt.isEmpty()) {
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
        
        return ResponseEntity.status(HttpStatus.CREATED).body(reminder);
    }
    
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<Void> deleteReminder(@PathVariable Long id) {
        Optional<ReminderQueueItem> reminderOpt = reminderQueueRepository.findById(id);
        
        if (reminderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        reminderQueueRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
    
    @DeleteMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')")
    public ResponseEntity<?> deleteRemindersForEvent(@PathVariable Long eventId) {
        reminderQueueService.deleteRemindersForEvent(eventId);
        return ResponseEntity.ok(Map.of("message", "Reminders deleted successfully"));
    }
    
    @PostMapping("/process")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> processReminderQueue() {
        try {
            reminderQueueService.processReminderQueue();
            return ResponseEntity.ok(Map.of("message", "Reminder queue processed successfully"));
        } catch (Exception e) {
            log.error("Error processing reminder queue", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error processing reminder queue", "error", e.getMessage()));
        }
    }
} 