package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.NotificationTokenDTO;
import com.bostoneo.bostoneosolutions.dtomapper.NotificationTokenDTOMapper;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.NotificationToken;
import com.bostoneo.bostoneosolutions.model.UserNotification;
import com.bostoneo.bostoneosolutions.repository.NotificationTokenRepository;
import com.bostoneo.bostoneosolutions.repository.UserNotificationRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.UserNotificationPreferenceService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationTokenRepository tokenRepository;
    private final UserNotificationRepository userNotificationRepository;
    private final FirebaseMessaging firebaseMessaging;
    private final EmailService emailService;
    private final UserNotificationPreferenceService userNotificationPreferenceService;
    private final UserRepository<User> userRepository;
    
    @Value("${firebase.config.path}")
    private String firebaseConfigPath;
    
    /**
     * Initialize Firebase when the service starts
     */
    @PostConstruct
    private void initialize() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(
                                new ClassPathResource(firebaseConfigPath).getInputStream()))
                        .build();
                FirebaseApp.initializeApp(options);
                log.info("Firebase application has been initialized");
            }
        } catch (IOException e) {
            log.error("Error initializing Firebase: {}", e.getMessage());
        }
    }

    @Override
    public NotificationTokenDTO registerToken(NotificationTokenDTO tokenDTO) {
        log.info("Registering notification token for user: {}", tokenDTO.getUserId());
        
        // First check if the token already exists
        Optional<NotificationToken> existingToken = tokenRepository.findByToken(tokenDTO.getToken());
        
        if (existingToken.isPresent()) {
            // Update existing token record
            NotificationToken token = existingToken.get();
            token.setUserId(tokenDTO.getUserId());
            token.setPlatform(tokenDTO.getPlatform());
            token.setLastUsed(LocalDateTime.now());
            
            NotificationToken savedToken = tokenRepository.save(token);
            return NotificationTokenDTOMapper.fromNotificationToken(savedToken);
        } else {
            // Create new token record
            NotificationToken token = NotificationTokenDTOMapper.toNotificationToken(tokenDTO);
            NotificationToken savedToken = tokenRepository.save(token);
            return NotificationTokenDTOMapper.fromNotificationToken(savedToken);
        }
    }

    @Override
    public void sendEventReminderNotification(CalendarEvent event, int minutesBefore, Long userId) {
        log.info("Sending reminder notification for event: {} to user: {}", event.getId(), userId);
        
        // Get tokens for the user
        List<NotificationToken> tokens = tokenRepository.findByUserId(userId);
        
        if (tokens.isEmpty()) {
            log.info("No notification tokens found for user: {}", userId);
            return;
        }
        
        // Create data map for template placeholders
        Map<String, String> templateData = new HashMap<>();
        templateData.put("eventTitle", event.getTitle());
        templateData.put("eventDate", event.getStartTime().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")));
        templateData.put("eventTime", event.getStartTime().format(DateTimeFormatter.ofPattern("hh:mm a")));
        templateData.put("eventLocation", event.getLocation() != null ? event.getLocation() : "N/A");
        templateData.put("minutesBefore", String.valueOf(minutesBefore));
        
        // Format the reminder time for the notification body
        String reminderTime;
        if (minutesBefore < 60) {
            reminderTime = minutesBefore + " minute" + (minutesBefore != 1 ? "s" : "");
        } else if (minutesBefore < 1440) {
            int hours = minutesBefore / 60;
            reminderTime = hours + " hour" + (hours != 1 ? "s" : "");
        } else {
            int days = minutesBefore / 1440;
            reminderTime = days + " day" + (days != 1 ? "s" : "");
        }
        templateData.put("reminderTimeText", reminderTime);
        
        // Add high priority indicator if applicable
        String title = "Reminder: {{eventTitle}}";
        if (Boolean.TRUE.equals(event.getHighPriority())) {
            title = "HIGH PRIORITY: " + title;
        }
        
        
        // Create message body
        String body = "Event {{reminderTimeText}} before: {{eventDate}} at {{eventTime}}";
        if (event.getLocation() != null && !event.getLocation().isEmpty()) {
            body += " at {{eventLocation}}";
        }
        
        // Process the template placeholders
        for (Map.Entry<String, String> entry : templateData.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = entry.getValue();
            title = title.replace(placeholder, value);
            body = body.replace(placeholder, value);
        }
        
        // Create notification message
        Notification notification = Notification.builder()
                .setTitle(title)
                .setBody(body)
                .build();
        
        // Send to each token
        for (NotificationToken token : tokens) {
            try {
                Message message = Message.builder()
                        .setNotification(notification)
                        .setToken(token.getToken())
                        .putData("eventId", event.getId().toString())
                        .putData("eventType", event.getEventType())
                        .putData("minutesBefore", String.valueOf(minutesBefore))
                        .build();
                
                String response = firebaseMessaging.send(message);
                log.info("Successfully sent notification to token {}: {}", token.getToken(), response);
            } catch (FirebaseMessagingException e) {
                log.error("Failed to send notification to token {}: {}", token.getToken(), e.getMessage());
                
                // Check if the token is no longer valid
                if ("UNREGISTERED".equals(e.getMessagingErrorCode().name())) {
                    // Token is no longer valid, remove it
                    tokenRepository.delete(token);
                    log.info("Removed invalid token: {}", token.getToken());
                }
            }
        }
    }

    @Override
    public List<NotificationTokenDTO> getTokensByUserId(Long userId) {
        log.info("Getting notification tokens for user: {}", userId);
        
        List<NotificationToken> tokens = tokenRepository.findByUserId(userId);
        return tokens.stream()
                .map(NotificationTokenDTOMapper::fromNotificationToken)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteToken(String token) {
        log.info("Deleting notification token: {}", token);
        
        Optional<NotificationToken> existingToken = tokenRepository.findByToken(token);
        existingToken.ifPresent(tokenRepository::delete);
    }
    
    @Override
    public void sendCrmNotification(String title, String body, Long userId, String type, Object data) {
        log.info("🔔 NOTIFICATION SERVICE: Sending CRM notification to user {}: '{}' - '{}' [type: {}]", userId, title, body, type);
        
        // Check user's notification preferences
        boolean shouldReceiveNotification = userNotificationPreferenceService.shouldReceiveNotification(userId, type);
        boolean shouldReceiveEmailNotification = userNotificationPreferenceService.shouldReceiveEmailNotification(userId, type);
        boolean shouldReceiveInAppNotification = userNotificationPreferenceService.shouldReceiveInAppNotification(userId, type);
        
        log.info("🔔 Notification preferences for user {}: general={}, email={}, inApp={}", 
            userId, shouldReceiveNotification, shouldReceiveEmailNotification, shouldReceiveInAppNotification);
        
        if (!shouldReceiveNotification) {
            log.warn("⚠️ User {} has disabled notifications for type: {}", userId, type);
            return;
        }
        
        // Send email notification if enabled
        if (shouldReceiveEmailNotification) {
            try {
                log.info("📧 Attempting to send email notification to user {}", userId);
                var user = userRepository.get(userId);
                if (user != null) {
                    String email = user.getEmail();
                    String firstName = user.getFirstName();
                    log.info("📧 User found - Email: {}, FirstName: {}", email, firstName);
                    emailService.sendNotificationEmail(email, firstName, title, body, type);
                    log.info("✅ Email notification sent successfully to user {}: {}", userId, email);
                } else {
                    log.warn("⚠️ User {} not found for email notification", userId);
                }
            } catch (Exception e) {
                log.error("❌ Failed to send email notification to user {}: {}", userId, e.getMessage(), e);
            }
        } else {
            log.info("📧 Email notifications disabled for user {} and type {}", userId, type);
        }
        
        // Send push notification if enabled (separate from in-app)
        boolean shouldReceivePushNotification = userNotificationPreferenceService.shouldReceivePushNotification(userId, type);
        
        log.info("🔔 Push notification preference for user {}: push={}", userId, shouldReceivePushNotification);
        
        if (shouldReceivePushNotification) {
            // Get tokens for the user
            List<NotificationToken> tokens = tokenRepository.findByUserId(userId);
            
            if (tokens.isEmpty()) {
                log.info("No notification tokens found for user: {}", userId);
            } else {
                // Send to each token
                for (NotificationToken token : tokens) {
                    try {
                        Message message = Message.builder()
                                .setToken(token.getToken())
                                .setNotification(Notification.builder()
                                        .setTitle(title)
                                        .setBody(body)
                                        .build())
                                .putData("type", type)
                                .putData("userId", String.valueOf(userId))
                                .putData("timestamp", String.valueOf(System.currentTimeMillis()))
                                .putData("data", data != null ? data.toString() : "")
                                .setWebpushConfig(WebpushConfig.builder()
                                        .setNotification(WebpushNotification.builder()
                                                .setIcon("/assets/images/logo-sm.png")
                                                .setBadge("/assets/images/badge.png")
                                                .setRequireInteraction(true)
                                                .setSilent(false)
                                                .build())
                                        .build())
                                .build();
                        
                        String response = firebaseMessaging.send(message);
                        log.info("Successfully sent CRM notification to token {}: {}", token.getToken(), response);
                    } catch (FirebaseMessagingException e) {
                        log.error("Failed to send CRM notification to token {}: {}", token.getToken(), e.getMessage());
                        
                        // Check if the token is no longer valid
                        if ("UNREGISTERED".equals(e.getMessagingErrorCode().name())) {
                            // Token is no longer valid, remove it
                            tokenRepository.delete(token);
                            log.info("Removed invalid token: {}", token.getToken());
                        }
                    }
                }
            }
        } else {
            log.info("📱 Push notifications disabled for user {} and type {}", userId, type);
        }
        
        // Create in-app notification if enabled
        if (shouldReceiveInAppNotification) {
            try {
                log.info("📱 Creating in-app notification for user {}", userId);
                Map<String, Object> notificationData = new HashMap<>();
                notificationData.put("userId", userId);
                notificationData.put("title", title);
                notificationData.put("message", body);
                notificationData.put("type", type);
                notificationData.put("priority", "NORMAL");
                
                // Add additional data if provided
                if (data instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> dataMap = (Map<String, Object>) data;
                    if (dataMap.containsKey("documentId")) {
                        notificationData.put("entityId", dataMap.get("documentId"));
                        notificationData.put("entityType", "document");
                    } else if (dataMap.containsKey("caseId")) {
                        notificationData.put("entityId", dataMap.get("caseId"));
                        notificationData.put("entityType", "case");
                    }
                    // Include the URL if provided
                    if (dataMap.containsKey("url")) {
                        notificationData.put("url", dataMap.get("url"));
                    }
                }
                
                UserNotification inAppNotification = createUserNotification(notificationData);
                log.info("✅ In-app notification created successfully for user {}: ID {}", userId, inAppNotification.getId());
            } catch (Exception e) {
                log.error("❌ Failed to create in-app notification for user {}: {}", userId, e.getMessage(), e);
            }
        } else {
            log.info("📱 In-app notifications disabled for user {} and type {}", userId, type);
        }
    }
    
    @Override
    public void sendBroadcastNotification(String title, String body, String type, Object data) {
        log.info("Sending broadcast notification: {} - {}", title, body);
        
        // Get all tokens
        List<NotificationToken> allTokens = tokenRepository.findAll();
        
        if (allTokens.isEmpty()) {
            log.info("No notification tokens found for broadcast");
            return;
        }
        
        // Send to each token
        for (NotificationToken token : allTokens) {
            try {
                Message message = Message.builder()
                        .setToken(token.getToken())
                        .setNotification(Notification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .build())
                        .putData("type", type)
                        .putData("timestamp", String.valueOf(System.currentTimeMillis()))
                        .putData("data", data != null ? data.toString() : "")
                        .setWebpushConfig(WebpushConfig.builder()
                                .setNotification(WebpushNotification.builder()
                                        .setIcon("/assets/images/logo-sm.png")
                                        .setBadge("/assets/images/badge.png")
                                        .build())
                                .build())
                        .build();
                
                String response = firebaseMessaging.send(message);
                log.info("Successfully sent broadcast notification to token {}: {}", token.getToken(), response);
            } catch (FirebaseMessagingException e) {
                log.error("Failed to send broadcast notification to token {}: {}", token.getToken(), e.getMessage());
                
                // Check if the token is no longer valid
                if ("UNREGISTERED".equals(e.getMessagingErrorCode().name())) {
                    // Token is no longer valid, remove it
                    tokenRepository.delete(token);
                    log.info("Removed invalid token during broadcast: {}", token.getToken());
                }
            }
        }
    }
    
    // ==================== User Notification Management ====================
    
    @Override
    public UserNotification createUserNotification(Map<String, Object> notificationData) {
        log.info("Creating user notification: {}", notificationData);
        
        UserNotification notification = new UserNotification();
        notification.setUserId(getLongValue(notificationData, "userId"));
        notification.setTitle((String) notificationData.get("title"));
        notification.setMessage((String) notificationData.get("message"));
        notification.setType((String) notificationData.getOrDefault("type", "SYSTEM"));
        notification.setPriority((String) notificationData.getOrDefault("priority", "MEDIUM"));
        notification.setRead(false);
        
        // Optional fields
        if (notificationData.containsKey("triggeredBy")) {
            notification.setTriggeredByUserId(getLongValue(notificationData, "triggeredBy"));
        }
        if (notificationData.containsKey("triggeredByName")) {
            notification.setTriggeredByName((String) notificationData.get("triggeredByName"));
        }
        if (notificationData.containsKey("entityId")) {
            notification.setEntityId(getLongValue(notificationData, "entityId"));
        }
        if (notificationData.containsKey("entityType")) {
            notification.setEntityType((String) notificationData.get("entityType"));
        }
        if (notificationData.containsKey("url")) {
            notification.setUrl((String) notificationData.get("url"));
        }
        
        UserNotification savedNotification = userNotificationRepository.save(notification);
        log.info("User notification created with ID: {}", savedNotification.getId());
        
        return savedNotification;
    }
    
    @Override
    public Page<UserNotification> getUserNotifications(Long userId, Pageable pageable) {
        log.info("Getting notifications for user: {} with pagination: {}", userId, pageable);
        return userNotificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }
    
    @Override
    public List<UserNotification> getUnreadNotifications(Long userId) {
        log.info("Getting unread notifications for user: {}", userId);
        return userNotificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
    }
    
    @Override
    public void markNotificationAsRead(Long notificationId) {
        log.info("Marking notification {} as read", notificationId);
        userNotificationRepository.markAsReadById(notificationId, LocalDateTime.now());
    }
    
    @Override
    public void markAllNotificationsAsRead(Long userId) {
        log.info("Marking all notifications as read for user: {}", userId);
        int updated = userNotificationRepository.markAllAsReadByUserId(userId, LocalDateTime.now());
        log.info("Marked {} notifications as read for user: {}", updated, userId);
    }
    
    @Override
    public void deleteNotification(Long notificationId) {
        log.info("Deleting notification: {}", notificationId);
        userNotificationRepository.deleteById(notificationId);
    }
    
    @Override
    public long getUnreadNotificationCount(Long userId) {
        long count = userNotificationRepository.countByUserIdAndReadFalse(userId);
        log.info("User {} has {} unread notifications", userId, count);
        return count;
    }
    
    // Helper method to safely extract Long values from Map
    private Long getLongValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Long) {
            return (Long) value;
        }
        if (value instanceof Integer) {
            return ((Integer) value).longValue();
        }
        if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException e) {
                log.warn("Could not parse Long value from string: {}", value);
                return null;
            }
        }
        log.warn("Unexpected type for Long field {}: {}", key, value.getClass().getSimpleName());
        return null;
    }
} 
 