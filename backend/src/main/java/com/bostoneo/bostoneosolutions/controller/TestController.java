package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;
import com.***REMOVED***.***REMOVED***solutions.repository.CalendarEventRepository;
import com.***REMOVED***.***REMOVED***solutions.service.CalendarEventService;
import com.***REMOVED***.***REMOVED***solutions.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Controller for testing functionality
 * These endpoints are for development and testing only
 */
@RestController
@RequestMapping("/api/v1/test")
@RequiredArgsConstructor
@Slf4j
public class TestController {
    
    private final EmailService emailService;
    private final CalendarEventService calendarEventService;
    
    /**
     * Simple ping endpoint for testing
     */
    @GetMapping("/ping")
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok("pong");
    }
    
    /**
     * Process reminders for all events
     */
    @PostMapping("/process-all-reminders")
    public ResponseEntity<Map<String, String>> processAllReminders() {
        log.info("Manually triggering reminder processing for all events");
        calendarEventService.processEventReminders();
        return ResponseEntity.ok(Map.of("message", "Reminder processing triggered for all events"));
    }
    
    /**
     * Process reminders for a specific event
     */
    @PostMapping("/process-event-reminder/{eventId}")
    public ResponseEntity<Map<String, String>> processEventReminder(@PathVariable Long eventId) {
        log.info("Manually triggering reminder processing for event ID: {}", eventId);
        calendarEventService.processReminderForEvent(eventId);
        return ResponseEntity.ok(Map.of("message", "Reminder processing triggered for event ID: " + eventId));
    }
    
    /**
     * Reset reminder flags and process reminders for a specific event
     * Useful for testing reminders that have already been sent
     */
    @PostMapping("/reset-and-process-reminder/{eventId}")
    public ResponseEntity<Map<String, String>> resetAndProcessReminder(@PathVariable Long eventId) {
        log.info("Resetting and processing reminders for event ID: {}", eventId);
        calendarEventService.processReminderForEvent(eventId);
        return ResponseEntity.ok(Map.of("message", "Reminder flags reset and processing triggered for event ID: " + eventId));
    }

    /**
     * Test endpoint to directly send a test email
     * Disabled to prevent unwanted test emails
     */
    /*
    @GetMapping("/send-test-email")
    public Map<String, Object> sendTestEmail() {
        log.info("Sending direct test email");
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Create a simple test deadline with current time
            CalendarEvent testEvent = new CalendarEvent();
            LocalDateTime now = LocalDateTime.now();
            testEvent.setId(999L); // Dummy ID
            testEvent.setTitle("TEST EMAIL - This is a test reminder");
            testEvent.setDescription("This email was sent from the test endpoint to verify email functionality");
            testEvent.setEventType("DEADLINE");
            testEvent.setStartTime(now.plusMinutes(30));
            testEvent.setReminderMinutes(15);
            testEvent.setHighPriority(true);
            
            // Hard-coded email for testing
            String emailAddress = "marsel.hox@gmail.com";
            String name = "Marsel";
            
            // Send the test email directly
            emailService.sendDeadlineReminderEmail(
                emailAddress,
                name,
                testEvent,
                testEvent.getReminderMinutes()
            );
            
            response.put("success", true);
            response.put("message", "Test email sent successfully");
            response.put("emailSentTo", emailAddress);
            response.put("eventDetails", Map.of(
                "title", testEvent.getTitle(),
                "eventType", testEvent.getEventType(),
                "dueTime", testEvent.getStartTime(),
                "reminderMinutes", testEvent.getReminderMinutes(),
                "highPriority", testEvent.getHighPriority()
            ));
            
        } catch (Exception e) {
            log.error("Error sending test email: {}", e.getMessage());
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        
        return response;
    }
    */
} 