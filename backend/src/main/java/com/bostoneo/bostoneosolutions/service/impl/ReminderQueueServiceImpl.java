package com.bostoneo.bostoneosolutions.service.impl;

import com.bostoneo.bostoneosolutions.dto.email.EmailBranding;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.model.ReminderQueueItem;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.repository.ReminderQueueRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.EmailTemplateEngine;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class ReminderQueueServiceImpl implements ReminderQueueService {

    @Autowired
    private ReminderQueueRepository reminderQueueRepository;

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

    @Autowired
    private EmailTemplateEngine templateEngine;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Value("${UI_APP_URL:http://localhost:4200}")
    private String frontendUrl;

    @Value("${LEGIENCE_LOGO_URL:https://legience.com/assets/legience-logo.png}")
    private String legienceLogoUrl;

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
        reminder.setOrganizationId(event.getOrganizationId());
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
                // Set tenant context so user/org lookups work correctly in the scheduler thread
                TenantContext.setCurrentTenant(reminder.getOrganizationId());

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
                
                // Get organization for branding
                Organization org = organizationRepository.findById(reminder.getOrganizationId()).orElse(null);

                // Build branding - determine if client-facing or internal
                boolean isClientFacing = "CLIENT_MEETING".equals(event.getEventType());
                EmailBranding branding;
                if (org != null) {
                    if (isClientFacing) {
                        branding = EmailBranding.firmClient(org.getName(), org.getLogoUrl(), org.getPrimaryColor(),
                                org.getEmail(), org.getPhone(), org.getAddress(), frontendUrl);
                    } else {
                        branding = EmailBranding.firmInternal(org.getName(), org.getLogoUrl(), org.getPrimaryColor(),
                                org.getEmail(), frontendUrl);
                    }
                } else {
                    branding = EmailBranding.platform(frontendUrl, legienceLogoUrl);
                }

                // Determine urgency banner
                EmailContent.UrgencyBanner urgency = getUrgencyBanner(event.getEventType());

                // Determine detail card accent color
                String accentColor = getAccentColor(event.getEventType());

                // Build detail card rows
                List<Map.Entry<String, String>> rows = new ArrayList<>();
                rows.add(Map.entry("Date", event.getStartTime().format(DATE_FORMATTER)));
                rows.add(Map.entry("Time", event.getStartTime().format(TIME_FORMATTER)));
                if (event.getLocation() != null && !event.getLocation().isEmpty()) {
                    rows.add(Map.entry("Location", event.getLocation()));
                }
                if (event.getCaseId() != null && event.getLegalCase() != null) {
                    if (event.getLegalCase().getTitle() != null) {
                        rows.add(Map.entry("Case", event.getLegalCase().getTitle()));
                    }
                    if (event.getLegalCase().getCaseNumber() != null) {
                        rows.add(Map.entry("Case #", event.getLegalCase().getCaseNumber()));
                    }
                }

                // Build CTA
                String ctaText = getCtaText(event.getEventType());
                String ctaUrl = getCtaUrl(event, frontendUrl);

                // Time remaining text
                String timeText = formatTimeBefore(reminder.getMinutesBefore());

                // Build content
                String signOff = org != null ? org.getName() : "Legience Team";
                EmailContent content = EmailContent.builder()
                        .recipientName(user.getFirstName() + " " + user.getLastName())
                        .bodyParagraphs(List.of(getReminderIntroText(event.getEventType()), timeText))
                        .detailCard(EmailContent.DetailCard.builder()
                                .title(event.getTitle())
                                .rows(rows)
                                .accentColor(accentColor)
                                .build())
                        .ctaButton(EmailContent.CtaButton.builder().text(ctaText).url(ctaUrl).build())
                        .signOffName(signOff)
                        .urgency(urgency)
                        .build();

                String htmlBody = templateEngine.render(branding, content);
                String subject = "Reminder: " + event.getTitle();

                boolean emailSent = emailService.sendEmail(user.getEmail(), subject, htmlBody);
                
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
            } finally {
                TenantContext.clear();
            }
        }
    }

    @Override
    public List<ReminderQueueItem> getPendingReminders() {
        // SECURITY: Require organization context - no fallback to global query
        Long orgId = tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> {
                    log.error("SECURITY: getPendingReminders called without organization context");
                    return new RuntimeException("Organization context required for getPendingReminders");
                });
        return reminderQueueRepository.findPendingByOrganizationId(orgId);
    }

    /**
     * SECURITY: Get all pending reminders for scheduled job processing.
     * This method is only for use by scheduled tasks that iterate through all organizations.
     * @return List of all pending reminders across all organizations
     */
    public List<ReminderQueueItem> getAllPendingRemindersForScheduler() {
        // SECURITY: This is intentionally global for the scheduler - it processes all orgs in sequence
        log.debug("Scheduler fetching all pending reminders for processing");
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

    // ─────────────────────────────────────────────────────────────────────
    //  Email template helper methods
    // ─────────────────────────────────────────────────────────────────────

    private EmailContent.UrgencyBanner getUrgencyBanner(String eventType) {
        return switch (eventType) {
            case "HEARING", "COURT_DATE" -> EmailContent.UrgencyBanner.builder()
                    .text("COURT APPEARANCE TODAY").level("red").build();
            case "DEADLINE" -> EmailContent.UrgencyBanner.builder()
                    .text("DEADLINE APPROACHING").level("amber").build();
            default -> null;
        };
    }

    private String getAccentColor(String eventType) {
        return switch (eventType) {
            case "HEARING", "COURT_DATE" -> "#dc2626";
            case "DEADLINE" -> "#d97706";
            case "DEPOSITION" -> "#7c3aed";
            default -> null; // will use primaryColor from branding
        };
    }

    private String getCtaText(String eventType) {
        return switch (eventType) {
            case "HEARING", "COURT_DATE" -> "View Case Details";
            case "DEADLINE" -> "View Deadline";
            default -> "View Calendar";
        };
    }

    private String getCtaUrl(CalendarEvent event, String baseUrl) {
        if (event.getCaseId() != null && ("HEARING".equals(event.getEventType()) || "COURT_DATE".equals(event.getEventType()))) {
            return baseUrl + "/legal/cases/" + event.getCaseId();
        }
        return baseUrl + "/legal/calendar";
    }

    private String getReminderIntroText(String eventType) {
        return switch (eventType) {
            case "HEARING" -> "This is a reminder for your upcoming hearing.";
            case "COURT_DATE" -> "This is a reminder for your upcoming court date.";
            case "DEADLINE" -> "This is a reminder about an approaching deadline.";
            case "DEPOSITION" -> "This is a reminder for your upcoming deposition.";
            case "MEDIATION" -> "This is a reminder for your upcoming mediation session.";
            case "CONSULTATION" -> "This is a reminder for your upcoming consultation.";
            case "CLIENT_MEETING" -> "This is a reminder for your upcoming meeting with our team.";
            case "TEAM_MEETING" -> "This is a reminder for your upcoming team meeting.";
            default -> "This is a reminder for your upcoming event.";
        };
    }

    private String formatTimeBefore(Integer minutesBefore) {
        if (minutesBefore == null) return "";
        if (minutesBefore < 60) {
            return "This event is scheduled to begin in " + minutesBefore + " minutes.";
        } else if (minutesBefore < 1440) {
            int hours = minutesBefore / 60;
            return "This event is scheduled to begin in " + hours + (hours == 1 ? " hour." : " hours.");
        } else {
            int days = minutesBefore / 1440;
            return "This event is scheduled to begin in " + days + (days == 1 ? " day." : " days.");
        }
    }
} 