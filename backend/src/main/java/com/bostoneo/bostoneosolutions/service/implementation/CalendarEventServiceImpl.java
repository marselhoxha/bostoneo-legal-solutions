package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.dtomapper.CalendarEventDTOMapper;
import com.bostoneo.bostoneosolutions.enumeration.CalendarEventStatus;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.UserService;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.ReminderQueueService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CalendarEventServiceImpl implements CalendarEventService {

    private final CalendarEventRepository calendarEventRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final EmailService emailService;
    private final UserService userService;
    private final NotificationService notificationService;
    private final ReminderQueueService reminderQueueService;

    @Override
    public CalendarEventDTO createEvent(CalendarEventDTO eventDTO) {
        log.info("Creating calendar event: {}", eventDTO.getTitle());
        
        // Validate that userId is set
        if (eventDTO.getUserId() == null) {
            log.error("Attempting to create event without user ID: {}", eventDTO.getTitle());
            throw new IllegalArgumentException("User ID must be provided when creating calendar events");
        }
        
        CalendarEvent event = new CalendarEvent();
        CalendarEventDTOMapper.updateCalendarEventFromDTO(eventDTO, event);
        
        // Set default values
        if (event.getStatus() == null) {
            event.setStatus("SCHEDULED");
        }
        if (event.getCreatedAt() == null) {
            event.setCreatedAt(LocalDateTime.now());
        }
        
        // Always set color based on event type to ensure consistent colors
        if (event.getEventType() != null) {
            event.setColor(getColorForEventType(event.getEventType()));
        }
        
        // Double-check user ID is still set after mapping (should never be null)
        if (event.getUserId() == null) {
            log.error("User ID lost during DTO mapping for event: {}", event.getTitle());
            event.setUserId(eventDTO.getUserId()); // Restore from DTO
        }
        
        // Link to legal case if caseId is provided
        if (eventDTO.getCaseId() != null) {
            LegalCase legalCase = legalCaseRepository.findById(eventDTO.getCaseId())
                    .orElseThrow(() -> new EntityNotFoundException("Case not found with ID: " + eventDTO.getCaseId()));
            event.setLegalCase(legalCase);
            event.setCaseId(legalCase.getId());
        }
        
        log.info("Saving event with userId: {}", event.getUserId());
        
        // Save the event
        CalendarEvent savedEvent = calendarEventRepository.save(event);
        
        // Enqueue reminder if reminder minutes are set
        if (savedEvent.getReminderMinutes() != null && savedEvent.getReminderMinutes() > 0) {
            reminderQueueService.enqueueReminder(savedEvent, savedEvent.getReminderMinutes(), "PRIMARY");
            
            // Also enqueue additional reminders if they exist
            if (savedEvent.getAdditionalRemindersList() != null) {
                for (Integer minutes : savedEvent.getAdditionalRemindersList()) {
                    reminderQueueService.enqueueReminder(savedEvent, minutes, "ADDITIONAL");
                }
            }
        }
        
        return CalendarEventDTOMapper.fromCalendarEvent(savedEvent);
    }

    @Override
    public CalendarEventDTO getEventById(Long id) {
        log.info("Fetching calendar event with ID: {}", id);
        
        CalendarEvent event = calendarEventRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Calendar event not found with ID: " + id));
        
        return CalendarEventDTOMapper.fromCalendarEvent(event);
    }

    @Override
    public Page<CalendarEventDTO> getAllEvents(int page, int size) {
        log.info("Fetching all calendar events, page: {}, size: {}", page, size);
        
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<CalendarEvent> eventsPage = calendarEventRepository.findAll(pageRequest);
        
        List<CalendarEventDTO> eventDTOs = eventsPage.getContent().stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
        
        return new PageImpl<>(eventDTOs, pageRequest, eventsPage.getTotalElements());
    }

    @Override
    public CalendarEventDTO updateEvent(Long id, CalendarEventDTO eventDTO) {
        log.info("Updating calendar event: {}", id);
        
        CalendarEvent event = calendarEventRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Calendar event not found with ID: " + id));
        
        // Store old reminder settings for comparison
        Integer oldReminderMinutes = event.getReminderMinutes();
        List<Integer> oldAdditionalReminders = event.getAdditionalRemindersList();
        
        // Store old event type for comparison
        String oldEventType = event.getEventType();
        
        // Update the event
        CalendarEventDTOMapper.updateCalendarEventFromDTO(eventDTO, event);
        
        // If event type changed, update the color
        if (!oldEventType.equals(event.getEventType())) {
            event.setColor(getColorForEventType(event.getEventType()));
        }
        
        // Ensure user ID is not null for events with reminders
        if (event.getUserId() == null && 
           (event.getReminderMinutes() != null && event.getReminderMinutes() > 0)) {
            log.warn("Updated event with reminder has null user ID, using default system user ID");
            event.setUserId(1L); // Set to default system user as fallback
        }
        
        CalendarEvent updatedEvent = calendarEventRepository.save(event);
        
        // If reminder settings have changed, update the reminder queue
        if (updatedEvent.getReminderMinutes() != null && updatedEvent.getReminderMinutes() > 0) {
            // Delete old reminders
            reminderQueueService.deleteRemindersForEvent(id);
            
            // Add new primary reminder
            reminderQueueService.enqueueReminder(updatedEvent, updatedEvent.getReminderMinutes(), "PRIMARY");
            
            // Add new additional reminders
            if (updatedEvent.getAdditionalRemindersList() != null) {
                for (Integer minutes : updatedEvent.getAdditionalRemindersList()) {
                    reminderQueueService.enqueueReminder(updatedEvent, minutes, "ADDITIONAL");
                }
            }
        } else if (oldReminderMinutes != null && oldReminderMinutes > 0) {
            // If reminders were removed, delete them from the queue
            reminderQueueService.deleteRemindersForEvent(id);
        }
        
        // Handle case reference update if needed
        if (eventDTO.getCaseId() != null && !eventDTO.getCaseId().equals(updatedEvent.getCaseId())) {
            LegalCase legalCase = legalCaseRepository.findById(eventDTO.getCaseId())
                    .orElseThrow(() -> new EntityNotFoundException("Case not found with ID: " + eventDTO.getCaseId()));
            updatedEvent.setLegalCase(legalCase);
            updatedEvent.setCaseId(legalCase.getId());
        }
        
        return CalendarEventDTOMapper.fromCalendarEvent(updatedEvent);
    }

    @Override
    public void deleteEvent(Long id) {
        log.info("Deleting calendar event with ID: {}", id);
        
        if (!calendarEventRepository.existsById(id)) {
            throw new EntityNotFoundException("Calendar event not found with ID: " + id);
        }
        
        calendarEventRepository.deleteById(id);
    }

    @Override
    public List<CalendarEventDTO> getEventsByCaseId(Long caseId) {
        log.info("Fetching calendar events for case ID: {}", caseId);
        
        return calendarEventRepository.findByCaseId(caseId).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getEventsByCaseIdAndDateRange(Long caseId, LocalDateTime startDate, LocalDateTime endDate) {
        log.info("Fetching calendar events for case ID: {} between {} and {}", caseId, startDate, endDate);
        
        return calendarEventRepository.findByCaseIdAndDateRange(caseId, startDate, endDate).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getEventsByUserId(Long userId) {
        log.info("Fetching calendar events for user ID: {}", userId);
        
        return calendarEventRepository.findByUserId(userId).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getEventsByUserIdAndDateRange(Long userId, LocalDateTime startDate, LocalDateTime endDate) {
        log.info("Fetching calendar events for user ID: {} between {} and {}", userId, startDate, endDate);
        
        return calendarEventRepository.findByUserIdAndDateRange(userId, startDate, endDate).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getEventsByDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        log.info("Fetching calendar events between {} and {}", startDate, endDate);
        
        return calendarEventRepository.findByDateRange(startDate, endDate).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getUpcomingEvents(int days) {
        log.info("Fetching upcoming calendar events for the next {} days", days);
        
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endDate = now.plusDays(days);
        
        return calendarEventRepository.findByDateRange(now, endDate).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getTodayEvents() {
        log.info("Fetching today's calendar events");
        
        LocalDateTime startOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        LocalDateTime endOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MAX);
        
        return calendarEventRepository.findByDateRange(startOfDay, endOfDay).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getEventsByStatus(String status) {
        log.info("Fetching calendar events with status: {}", status);
        
        return calendarEventRepository.findByStatus(status).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public List<CalendarEventDTO> getEventsByType(String eventType) {
        log.info("Fetching calendar events with type: {}", eventType);
        
        return calendarEventRepository.findByEventType(eventType).stream()
                .map(CalendarEventDTOMapper::fromCalendarEvent)
                .collect(Collectors.toList());
    }

    @Override
    public void processEventReminders() {
        log.info("Processing calendar event reminders");
        
        // Calculate reminder time threshold for each event based on its reminderMinutes
        LocalDateTime now = LocalDateTime.now();
        
        List<CalendarEvent> eventsRequiringReminders = calendarEventRepository.findEventsRequiringReminders(now);
        
        for (CalendarEvent event : eventsRequiringReminders) {
            // Process reminder for this event
            processEventReminder(event);
        }
        
        // Also process additional reminders for deadlines
        processAdditionalReminders();
    }
    
    /**
     * Process a single event's reminder, including email notification
     */
    private void processEventReminder(CalendarEvent event) {
        try {
            log.info("Processing reminder for event: {} (ID: {})", event.getTitle(), event.getId());
            
            // Skip if there's no reminder minutes set or reminder already sent
            if (event.getReminderMinutes() == null || event.getReminderMinutes() <= 0 || Boolean.TRUE.equals(event.getReminderSent())) {
                log.info("Skipping reminder for event {} - no reminder set or already sent", event.getId());
                return;
            }
            
            // Calculate when the reminder should be sent
            LocalDateTime eventTime = event.getStartTime();
            LocalDateTime reminderTime = eventTime.minusMinutes(event.getReminderMinutes());
            LocalDateTime now = LocalDateTime.now();
            
            // Skip if the event time has already passed
            if (eventTime.isBefore(now)) {
                log.info("Skipping reminder for event {} - event time already passed", event.getId());
                event.setReminderSent(true); // Mark as sent to prevent further processing
                calendarEventRepository.save(event);
                return;
            }
            
            // Check if it's time to send this reminder (within the last 5 minutes)
            if (reminderTime.isAfter(now)) {
                log.info("Not yet time to send reminder for event {} - reminder time is {}", 
                    event.getId(), reminderTime);
                return;
            }
            
            // Only send reminder if it's within the processing window (5 minutes)
            LocalDateTime fiveMinutesAgo = now.minusMinutes(5);
            if (reminderTime.isBefore(fiveMinutesAgo)) {
                log.info("Skipping reminder for event {} - reminder time {} is too far in the past", 
                    event.getId(), reminderTime);
                event.setReminderSent(true); // Mark as sent to prevent further processing
                calendarEventRepository.save(event);
                return;
            }
            
            // Get user information for notifications
            Long userId = event.getUserId();
            if (userId != null) {
                // Variables to track if notifications were sent
                boolean emailSent = false;
                boolean pushSent = false;
                
                // Get user information
                String userEmail = getUserEmailById(userId);
                String userName = getUserNameById(userId);
                
                // 1. Try to send email notification if email notification is enabled
                if (event.getEmailNotification() == null || Boolean.TRUE.equals(event.getEmailNotification())) {
                    if (userEmail != null && !userEmail.isEmpty()) {
                        try {
                            // Send email notification for any event type
                            emailService.sendDeadlineReminderEmail(
                                userEmail, 
                                userName, 
                                event, 
                                event.getReminderMinutes()
                            );
                            
                            log.info("Email reminder sent to user {} for event {}", userId, event.getId());
                            emailSent = true;
                        } catch (Exception e) {
                            log.error("Failed to send email reminder for event {}: {}", event.getId(), e.getMessage());
                        }
                    } else {
                        log.warn("Could not send email reminder for event {} - user email not found for user {}", 
                            event.getId(), userId);
                    }
                } else {
                    log.info("Email notifications disabled for event {}", event.getId());
                }
                
                // 2. Try to send push notification if push notification is enabled
                // This is now independent of email success
                if (event.getPushNotification() == null || Boolean.TRUE.equals(event.getPushNotification())) {
                    try {
                        // Send push notification
                        notificationService.sendEventReminderNotification(
                            event,
                            event.getReminderMinutes(),
                            userId
                        );
                        
                        log.info("Push notification sent to user {} for event {}", userId, event.getId());
                        pushSent = true;
                    } catch (Exception e) {
                        log.error("Failed to send push notification for event {}: {}", event.getId(), e.getMessage());
                    }
                } else {
                    log.info("Push notifications disabled for event {}", event.getId());
                }
                
                // If neither notification was sent, log a warning
                if (!emailSent && !pushSent) {
                    log.warn("No notifications sent for event {} - both email and push notification failed", event.getId());
                }
            } else {
                log.warn("Could not send any notifications for event {} - no userId assigned", event.getId());
            }
            
            // Mark reminder as sent regardless of notification success
            // This prevents repeated processing attempts
            event.setReminderSent(true);
            calendarEventRepository.save(event);
            
        } catch (Exception e) {
            log.error("Error processing reminder for event {}: {}", event.getId(), e.getMessage());
        }
    }
    
    /**
     * Process additional reminders for deadline events
     */
    private void processAdditionalReminders() {
        log.info("Processing additional reminders for deadline events");
        
        LocalDateTime now = LocalDateTime.now();
        
        // Get all deadline events with additional reminders
        List<CalendarEvent> deadlinesWithAdditionalReminders = calendarEventRepository.findByEventType("DEADLINE")
            .stream()
            .filter(e -> e.getAdditionalReminders() != null && !e.getAdditionalReminders().isEmpty())
            .toList();
        
        for (CalendarEvent deadline : deadlinesWithAdditionalReminders) {
            // Skip if the deadline has already passed
            if (deadline.getStartTime().isBefore(now)) {
                log.info("Skipping additional reminders for deadline {} - deadline already passed", deadline.getId());
                continue;
            }
            
            // Get the reminders that have already been sent
            List<Integer> remindersSent = deadline.getRemindersSentList();
            
            // Get all additional reminders
            List<Integer> additionalReminders = deadline.getAdditionalRemindersList();
            
            // Get the deadline time
            LocalDateTime deadlineTime = deadline.getStartTime();
            
            // Create a flag to track if any reminders were sent for this deadline
            boolean remindersSentInThisRun = false;
            
            // Define the processing window (last 5 minutes)
            LocalDateTime fiveMinutesAgo = now.minusMinutes(5);
            
            // Check each additional reminder
            for (Integer minutes : additionalReminders) {
                // Skip if this reminder has already been sent
                if (remindersSent.contains(minutes)) {
                    continue;
                }
                
                // Calculate when the reminder should be sent
                LocalDateTime reminderTime = deadlineTime.minusMinutes(minutes);
                
                // Check if it's time to send this reminder and it's within the processing window
                if (reminderTime.isBefore(now) && reminderTime.isAfter(fiveMinutesAgo)) {
                    log.info("Sending additional reminder ({} minutes) for deadline {}", 
                        minutes, deadline.getId());
                    
                    // Variables to track notification success
                    boolean emailSent = false;
                    boolean pushSent = false;
                    
                    // Try to send notifications
                    Long userId = deadline.getUserId();
                    if (userId != null) {
                        // 1. Try to send email notification if email notification is enabled
                        if (deadline.getEmailNotification() == null || Boolean.TRUE.equals(deadline.getEmailNotification())) {
                            String userEmail = getUserEmailById(userId);
                            String userName = getUserNameById(userId);
                            
                            if (userEmail != null && !userEmail.isEmpty()) {
                                try {
                                    // Send email for this additional reminder
                                    emailService.sendDeadlineReminderEmail(
                                        userEmail, 
                                        userName, 
                                        deadline, 
                                        minutes
                                    );
                                    
                                    log.info("Additional email reminder sent to user {} for deadline {}", 
                                        userId, deadline.getId());
                                    emailSent = true;
                                } catch (Exception e) {
                                    log.error("Error sending additional email reminder: {}", e.getMessage());
                                }
                            } else {
                                log.warn("Could not send additional email reminder for deadline {} - user email not found for user {}", 
                                    deadline.getId(), userId);
                            }
                        } else {
                            log.info("Email notifications disabled for deadline {}", deadline.getId());
                        }
                        
                        // 2. Try to send push notification if push notification is enabled
                        if (deadline.getPushNotification() == null || Boolean.TRUE.equals(deadline.getPushNotification())) {
                            try {
                                // Send push notification
                                notificationService.sendEventReminderNotification(
                                    deadline,
                                    minutes,
                                    userId
                                );
                                
                                log.info("Additional push notification sent to user {} for deadline {}", 
                                    userId, deadline.getId());
                                pushSent = true;
                            } catch (Exception e) {
                                log.error("Failed to send additional push notification for deadline {}: {}", 
                                    deadline.getId(), e.getMessage());
                            }
                        } else {
                            log.info("Push notifications disabled for deadline {}", deadline.getId());
                        }
                        
                        // If neither notification was sent, log a warning
                        if (!emailSent && !pushSent) {
                            log.warn("No additional notifications sent for deadline {} - both email and push notification failed", 
                                deadline.getId());
                        }
                    } else {
                        log.warn("Could not send any additional notifications for deadline {} - no userId assigned", 
                            deadline.getId());
                    }
                    
                    // Mark this reminder as sent regardless of success
                    remindersSent.add(minutes);
                    remindersSentInThisRun = true;
                } else if (reminderTime.isBefore(fiveMinutesAgo)) {
                    // If reminder time has passed the processing window, mark as sent without sending email
                    log.info("Marking past reminder ({} minutes) as sent without notification for deadline {}", 
                        minutes, deadline.getId());
                    remindersSent.add(minutes);
                    remindersSentInThisRun = true;
                }
            }
            
            // Update the event with the new list of sent reminders, but only if changes were made
            if (remindersSentInThisRun) {
                deadline.setRemindersSentList(remindersSent);
                calendarEventRepository.save(deadline);
            }
        }
    }
    
    /**
     * Get user's email by ID
     */
    private String getUserEmailById(Long userId) {
        try {
            // Use the UserService to get the real user information
            UserDTO user = userService.getUserById(userId);
            if (user != null && user.getEmail() != null) {
                return user.getEmail();
            }
        } catch (Exception e) {
            log.error("Error getting user email: {}", e.getMessage());
        }
        
        // Return null if user email not found
        log.warn("No email found for user ID: {}", userId);
        return null;
    }
    
    /**
     * Get user's name by ID
     */
    private String getUserNameById(Long userId) {
        try {
            // Use the UserService to get the real user information
            UserDTO user = userService.getUserById(userId);
            if (user != null) {
                return user.getFirstName() + " " + user.getLastName();
            }
        } catch (Exception e) {
            log.error("Error getting user name: {}", e.getMessage());
        }
        
        // Return null if user name not found
        log.warn("No user found for ID: {}", userId);
        return null;
    }

    @Override
    public void syncWithExternalCalendar(String calendarType, String userId) {
        log.info("Syncing with external calendar: {} for user: {}", calendarType, userId);
        
        // Implementation would depend on the external calendar API
        // For Google Calendar, would use Google Calendar API
        // For Microsoft Outlook, would use Microsoft Graph API
        
        // This would be implemented with an external calendar provider service
        // Just logging the intent for now
        log.info("External calendar sync would be performed here");
    }

    @Override
    public String generateICalendarData(List<CalendarEventDTO> events) {
        log.info("Generating iCalendar data for {} events", events.size());
        
        // Implement iCalendar format generation
        // This would generate an iCal (.ics) format string that can be
        // imported into various calendar applications
        
        StringBuilder iCalBuilder = new StringBuilder();
        iCalBuilder.append("BEGIN:VCALENDAR\n");
        iCalBuilder.append("VERSION:2.0\n");
        iCalBuilder.append("PRODID:-//BostonEO Solutions//Calendar//EN\n");
        
        for (CalendarEventDTO event : events) {
            iCalBuilder.append("BEGIN:VEVENT\n");
            iCalBuilder.append("UID:").append(event.getId()).append("@bostoneosolutions.com\n");
            iCalBuilder.append("SUMMARY:").append(event.getTitle()).append("\n");
            if (event.getDescription() != null) {
                iCalBuilder.append("DESCRIPTION:").append(event.getDescription()).append("\n");
            }
            
            // Format dates in iCal format (YYYYMMDDTHHmmssZ)
            String startDate = formatDateForICal(event.getStartTime());
            iCalBuilder.append("DTSTART:").append(startDate).append("\n");
            
            if (event.getEndTime() != null) {
                String endDate = formatDateForICal(event.getEndTime());
                iCalBuilder.append("DTEND:").append(endDate).append("\n");
            }
            
            if (event.getLocation() != null) {
                iCalBuilder.append("LOCATION:").append(event.getLocation()).append("\n");
            }
            
            // Add recurrence rule if available
            if (event.getRecurrenceRule() != null) {
                iCalBuilder.append("RRULE:").append(event.getRecurrenceRule()).append("\n");
            }
            
            iCalBuilder.append("END:VEVENT\n");
        }
        
        iCalBuilder.append("END:VCALENDAR");
        return iCalBuilder.toString();
    }
    
    // Helper method to format dates for iCalendar format
    private String formatDateForICal(LocalDateTime dateTime) {
        // Format as YYYYMMDDTHHMMSSZ (e.g., 20240515T123000Z)
        return dateTime.toString()
                .replace("-", "")
                .replace(":", "")
                .replace(".", "")
                .replace(" ", "T") + "Z";
    }

    @Override
    public void processReminderForEvent(Long eventId) {
        log.info("Processing reminder for specific event ID: {}", eventId);
        
        CalendarEvent event = calendarEventRepository.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Calendar event not found with ID: " + eventId));
        
        // Check if event has already passed
        LocalDateTime now = LocalDateTime.now();
        if (event.getStartTime().isBefore(now)) {
            log.info("Skipping reminder for event {} - event time already passed", eventId);
            return;
        }
        
        // Reset reminder flags for testing
        event.setReminderSent(false);
        event.setRemindersSent(null);
        calendarEventRepository.save(event);
        
        // Reload the event to get the updated version
        event = calendarEventRepository.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Calendar event not found with ID: " + eventId));
        
        // Process this specific event's reminder
        processEventReminder(event);
        
        // Also process additional reminders if it's a deadline
        if ("DEADLINE".equals(event.getEventType()) && 
            event.getAdditionalReminders() != null && 
            !event.getAdditionalReminders().isEmpty()) {
            
            // Get the reminders that have already been sent
            List<Integer> remindersSent = event.getRemindersSentList();
            
            // Get all additional reminders
            List<Integer> additionalReminders = event.getAdditionalRemindersList();
            
            // Create a flag to track if any reminders were sent
            boolean remindersSentInThisRun = false;
            
            // Process each additional reminder
            for (Integer minutes : additionalReminders) {
                // Skip if this reminder has already been sent
                if (remindersSent.contains(minutes)) {
                    continue;
                }
                
                log.info("Sending test additional reminder ({} minutes) for deadline {}", 
                    minutes, event.getId());
                
                // Variables to track notification success
                boolean emailSent = false;
                boolean pushSent = false;
                
                // Try to send notifications
                Long userId = event.getUserId();
                if (userId != null) {
                    // 1. Try to send email notification if enabled
                    if (event.getEmailNotification() == null || Boolean.TRUE.equals(event.getEmailNotification())) {
                        String userEmail = getUserEmailById(userId);
                        String userName = getUserNameById(userId);
                        
                        if (userEmail != null && !userEmail.isEmpty()) {
                            try {
                                // Send email for this additional reminder
                                emailService.sendDeadlineReminderEmail(
                                    userEmail, 
                                    userName, 
                                    event, 
                                    minutes
                                );
                                
                                log.info("Additional email reminder sent to user {} for deadline {}", 
                                    userId, event.getId());
                                emailSent = true;
                            } catch (Exception e) {
                                log.error("Error sending additional email reminder: {}", e.getMessage());
                            }
                        } else {
                            log.warn("Could not send additional email reminder for deadline {} - user email not found for user {}", 
                                event.getId(), userId);
                        }
                    } else {
                        log.info("Email notifications disabled for deadline {}", event.getId());
                    }
                    
                    // 2. Try to send push notification if enabled
                    if (event.getPushNotification() == null || Boolean.TRUE.equals(event.getPushNotification())) {
                        try {
                            // Send push notification
                            notificationService.sendEventReminderNotification(
                                event,
                                minutes,
                                userId
                            );
                            
                            log.info("Additional push notification sent to user {} for deadline {}", 
                                userId, event.getId());
                            pushSent = true;
                        } catch (Exception e) {
                            log.error("Failed to send additional push notification for deadline {}: {}", 
                                event.getId(), e.getMessage());
                        }
                    } else {
                        log.info("Push notifications disabled for deadline {}", event.getId());
                    }
                    
                    // If neither notification was sent, log a warning
                    if (!emailSent && !pushSent) {
                        log.warn("No additional test notifications sent for deadline {} - both email and push notification failed", 
                            event.getId());
                    }
                } else {
                    log.warn("Could not send any additional test notifications for deadline {} - no userId assigned", 
                        event.getId());
                }
                
                // Mark reminder as sent regardless of success
                remindersSent.add(minutes);
                remindersSentInThisRun = true;
            }
            
            // Update the event with the new list of sent reminders if changes were made
            if (remindersSentInThisRun) {
                event.setRemindersSentList(remindersSent);
                calendarEventRepository.save(event);
            }
        }
    }

    /**
     * Gets a consistent color for each event type
     */
    private String getColorForEventType(String eventType) {
        switch(eventType) {
            case "COURT_DATE": return "#d63939"; // red/danger
            case "DEADLINE": return "#f59f00"; // orange/warning
            case "CLIENT_MEETING": return "#3577f1"; // blue/primary
            case "TEAM_MEETING": return "#299cdb"; // light blue/info
            case "DEPOSITION": return "#405189"; // indigo/secondary
            case "MEDIATION": return "#0ab39c"; // teal/success
            case "CONSULTATION": return "#6559cc"; // purple
            case "REMINDER": return "#f06548"; // orange-red
            case "OTHER": return "#74788d"; // gray
            default: return "#74788d"; // gray
        }
    }
} 