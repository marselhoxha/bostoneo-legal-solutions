package com.bostoneo.bostoneosolutions.scheduler;

import com.bostoneo.bostoneosolutions.service.AppointmentRequestService;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class ReminderScheduler {

    @Autowired
    private ReminderQueueService reminderQueueService;

    @Autowired
    private CalendarEventService calendarEventService;

    @Autowired
    private AppointmentRequestService appointmentRequestService;

    @Value("${app.reminders.enabled:true}")
    private boolean remindersEnabled;

    /**
     * Process all reminders every minute
     * This will check for any pending reminders that are due to be sent
     */
    @Scheduled(fixedDelayString = "${app.reminders.check-interval:60000}")
    public void processReminders() {
        if (!remindersEnabled) {
            log.debug("Reminder processing is disabled");
            return;
        }

        try {
            // Process reminder queue items
            reminderQueueService.processReminderQueue();

            // Process calendar event reminders
            calendarEventService.processEventReminders();

            // Process appointment reminders
            appointmentRequestService.processAppointmentReminders();

        } catch (InvalidDataAccessResourceUsageException e) {
            // This is likely due to the reminder_queue table not existing yet or column mismatch
            // Detailed error message for easier troubleshooting
            log.info("Reminder queue database access issue: {} - SQL Error: {}",
                    e.getMessage(),
                    e.getCause() != null ? e.getCause().getMessage() : "Unknown");
        } catch (Exception e) {
            log.error("Error processing reminders: {}", e.getMessage(), e);
        }
    }
} 