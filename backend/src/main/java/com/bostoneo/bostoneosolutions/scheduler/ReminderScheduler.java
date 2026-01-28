package com.bostoneo.bostoneosolutions.scheduler;

import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.AppointmentRequestService;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
public class ReminderScheduler {

    @Autowired
    private ReminderQueueService reminderQueueService;

    @Autowired
    private CalendarEventService calendarEventService;

    @Autowired
    private AppointmentRequestService appointmentRequestService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Value("${app.reminders.enabled:true}")
    private boolean remindersEnabled;

    /**
     * Process all reminders every minute
     * SECURITY: Iterates through each organization and sets tenant context
     * to ensure proper data isolation during reminder processing.
     */
    @Scheduled(fixedDelayString = "${app.reminders.check-interval:60000}")
    public void processReminders() {
        if (!remindersEnabled) {
            log.debug("Reminder processing is disabled");
            return;
        }

        try {
            // SECURITY: Process reminder queue items (uses its own org-filtered queries)
            reminderQueueService.processReminderQueue();

            // SECURITY: Get all active organizations and process reminders per-org
            List<Organization> organizations = organizationRepository.findAll();

            for (Organization org : organizations) {
                try {
                    // SECURITY: Set tenant context for this organization
                    TenantContext.setCurrentTenant(org.getId());
                    log.debug("Processing reminders for organization: {} (ID: {})", org.getName(), org.getId());

                    // Process calendar event reminders within org context
                    calendarEventService.processEventReminders();

                    // Process appointment reminders within org context
                    appointmentRequestService.processAppointmentReminders();

                } catch (Exception e) {
                    log.error("Error processing reminders for organization {}: {}", org.getId(), e.getMessage());
                } finally {
                    // SECURITY: Always clear tenant context after processing
                    TenantContext.clear();
                }
            }

        } catch (InvalidDataAccessResourceUsageException e) {
            // This is likely due to the reminder_queue table not existing yet or column mismatch
            log.info("Reminder queue database access issue: {} - SQL Error: {}",
                    e.getMessage(),
                    e.getCause() != null ? e.getCause().getMessage() : "Unknown");
        } catch (Exception e) {
            log.error("Error processing reminders: {}", e.getMessage(), e);
        } finally {
            // SECURITY: Ensure tenant context is cleared even on error
            TenantContext.clear();
        }
    }
} 