package com.bostoneo.bostoneosolutions.service.impl;

import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.EmailTemplate;
import com.bostoneo.bostoneosolutions.model.ReminderQueueItem;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.EmailTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.ReminderQueueRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class ReminderQueueServiceImpl implements ReminderQueueService {

    @Autowired
    private ReminderQueueRepository reminderQueueRepository;
    
    @Autowired
    private EmailTemplateRepository emailTemplateRepository;
    
    @Autowired
    private UserRepository<?> userRepository;
    
    @Autowired
    private CalendarEventRepository calendarEventRepository;
    
    @Autowired
    private EmailService emailService;
    
    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");

    @Override
    public ReminderQueueItem enqueueReminder(CalendarEvent event, Integer minutesBefore, String reminderType) {
        // Check if a reminder with the same criteria already exists
        List<ReminderQueueItem> existingReminders = reminderQueueRepository
                .findByEventAndMinutesAndType(event.getId(), minutesBefore, reminderType);
        
        if (!existingReminders.isEmpty()) {
            log.info("Reminder already exists for event {} with {} minutes before", event.getId(), minutesBefore);
            return existingReminders.get(0);
        }
        
        // Calculate when the reminder should be sent
        LocalDateTime eventTime = event.getStartTime();
        LocalDateTime scheduledTime = eventTime.minusMinutes(minutesBefore);
        
        // Don't schedule reminders for past events
        if (scheduledTime.isBefore(LocalDateTime.now())) {
            log.info("Not scheduling reminder for past event: {}", event.getId());
            return null;
        }
        
        // Use event's userId - it should never be null since the user is authenticated
        Long userId = event.getUserId();
        if (userId == null) {
            // This should never happen with properly authenticated requests, log as error
            log.error("Event {} has no user ID despite user being authenticated. This indicates a potential issue in the authentication flow or event creation process.", event.getId());
            
            // Try to get authenticated user from security context as backup
            try {
                org.springframework.security.core.Authentication auth = 
                    org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof org.springframework.security.core.userdetails.UserDetails) {
                    // Extract user ID from principal if possible based on your security implementation
                    // This is a simplified example, adjust according to your actual UserDetails implementation
                    Object principal = auth.getPrincipal();
                    if (principal instanceof User) {
                        userId = ((User) principal).getId();
                        log.info("Retrieved user ID {} from security context", userId);
                    }
                }
            } catch (Exception e) {
                log.error("Failed to get authenticated user from security context", e);
            }
            
            // SECURITY: Fail if we can't determine the user - don't use hardcoded fallback
            if (userId == null) {
                log.error("Cannot create reminder for event {} - user ID cannot be determined", event.getId());
                throw new RuntimeException("Cannot create reminder - event has no userId and authentication context unavailable");
            }
        }
        
        ReminderQueueItem reminder = new ReminderQueueItem();
        reminder.setEventId(event.getId());
        reminder.setUserId(userId);
        reminder.setScheduledTime(scheduledTime);
        reminder.setMinutesBefore(minutesBefore);
        reminder.setStatus("PENDING");
        reminder.setReminderType(reminderType);
        
        return reminderQueueRepository.save(reminder);
    }

    @Override
    public void processReminderQueue() {
        List<ReminderQueueItem> pendingReminders = 
                reminderQueueRepository.findPendingRemindersReadyToSend(LocalDateTime.now());
        
        
        for (ReminderQueueItem reminder : pendingReminders) {
            try {
                // SECURITY: Use org-filtered query to ensure event belongs to same org as reminder
                Optional<CalendarEvent> eventOpt = calendarEventRepository.findByIdAndOrganizationId(
                        reminder.getEventId(), reminder.getOrganizationId());

                if (eventOpt.isEmpty()) {
                    log.error("Event not found for reminder: {} (org: {})", reminder.getId(), reminder.getOrganizationId());
                    markReminderAsFailed(reminder.getId(), "Event not found");
                    continue;
                }
                
                CalendarEvent event = eventOpt.get();
                
                // Skip if the event has already passed
                if (event.getStartTime().isBefore(LocalDateTime.now())) {
                    markReminderAsFailed(reminder.getId(), "Event already passed");
                    continue;
                }
                
                User user = userRepository.get(reminder.getUserId());
                
                if (user == null) {
                    log.error("User not found for reminder: {}", reminder.getId());
                    markReminderAsFailed(reminder.getId(), "User not found");
                    continue;
                }
                
                // Get the appropriate email template
                Optional<EmailTemplate> templateOpt = emailTemplateRepository
                        .findDefaultTemplateForEventType(event.getEventType());
                
                if (templateOpt.isEmpty()) {
                    log.error("No template found for event type: {}", event.getEventType());
                    markReminderAsFailed(reminder.getId(), "Email template not found");
                    continue;
                }
                
                EmailTemplate template = templateOpt.get();
                
                // Prepare template data
                Map<String, String> templateData = new HashMap<>();
                templateData.put("userName", user.getFirstName() + " " + user.getLastName());
                templateData.put("eventTitle", event.getTitle());
                templateData.put("eventDate", event.getStartTime().format(DATE_FORMATTER));
                templateData.put("eventTime", event.getStartTime().format(TIME_FORMATTER));
                templateData.put("minutesBefore", reminder.getMinutesBefore().toString());
                templateData.put("eventType", event.getEventType());
                templateData.put("eventLocation", event.getLocation() != null ? event.getLocation() : "N/A");
                
                // Send the email
                boolean emailSent = emailService.sendTemplatedEmail(
                        user.getEmail(),
                        template.getSubject(),
                        template.getBodyTemplate(),
                        templateData
                );
                
                // Send push notification if enabled for this event
                boolean pushSent = false;
                if (event.getPushNotification() != null && event.getPushNotification()) {
                    try {
                        notificationService.sendEventReminderNotification(
                            event, 
                            reminder.getMinutesBefore(), 
                            reminder.getUserId()
                        );
                        pushSent = true;
                        log.info("Push notification sent successfully for event: {}", event.getId());
                    } catch (Exception e) {
                        log.error("Failed to send push notification for event: {}", event.getId(), e);
                    }
                }
                
                if (emailSent) {
                    markReminderAsSent(reminder.getId());
                    log.info("Reminder email sent successfully for event: {}", event.getId());
                } else {
                    markReminderAsFailed(reminder.getId(), "Failed to send email");
                    log.error("Failed to send reminder email for event: {}", event.getId());
                }
                
            } catch (Exception e) {
                log.error("Error processing reminder: {}", reminder.getId(), e);
                markReminderAsFailed(reminder.getId(), e.getMessage());
            }
        }
    }

    @Override
    public List<ReminderQueueItem> getPendingReminders() {
        return reminderQueueRepository.findByStatus("PENDING");
    }

    @Override
    public void markReminderAsSent(Long reminderId) {
        // SECURITY: Use org-filtered query when called from user context
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (orgId != null) {
            reminderQueueRepository.findByIdAndOrganizationId(reminderId, orgId).ifPresent(reminder -> {
                reminder.setStatus("SENT");
                reminder.setLastAttempt(LocalDateTime.now());
                reminderQueueRepository.save(reminder);
            });
        } else {
            // Internal/scheduled calls without org context
            reminderQueueRepository.findById(reminderId).ifPresent(reminder -> {
                reminder.setStatus("SENT");
                reminder.setLastAttempt(LocalDateTime.now());
                reminderQueueRepository.save(reminder);
            });
        }
    }

    @Override
    public void markReminderAsFailed(Long reminderId, String errorMessage) {
        // SECURITY: Use org-filtered query when called from user context
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (orgId != null) {
            reminderQueueRepository.findByIdAndOrganizationId(reminderId, orgId).ifPresent(reminder -> {
                reminder.setStatus("FAILED");
                reminder.setLastAttempt(LocalDateTime.now());
                reminder.setErrorMessage(errorMessage);
                reminder.setRetryCount(reminder.getRetryCount() + 1);
                reminderQueueRepository.save(reminder);
            });
        } else {
            // Internal/scheduled calls without org context
            reminderQueueRepository.findById(reminderId).ifPresent(reminder -> {
                reminder.setStatus("FAILED");
                reminder.setLastAttempt(LocalDateTime.now());
                reminder.setErrorMessage(errorMessage);
                reminder.setRetryCount(reminder.getRetryCount() + 1);
                reminderQueueRepository.save(reminder);
            });
        }
    }

    @Override
    public void deleteRemindersForEvent(Long eventId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify the event belongs to the current organization
        calendarEventRepository.findByIdAndOrganizationId(eventId, orgId)
            .orElseThrow(() -> new RuntimeException("Event not found or access denied: " + eventId));

        // SECURITY: Use tenant-filtered query
        List<ReminderQueueItem> reminders = reminderQueueRepository.findByOrganizationIdAndEventId(orgId, eventId);
        reminderQueueRepository.deleteAll(reminders);
        log.info("Deleted {} reminders for event {} in org {}", reminders.size(), eventId, orgId);
    }
} 