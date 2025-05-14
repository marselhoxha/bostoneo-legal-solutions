package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.dto.NotificationTokenDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.NotificationTokenDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;
import com.***REMOVED***.***REMOVED***solutions.model.NotificationToken;
import com.***REMOVED***.***REMOVED***solutions.repository.NotificationTokenRepository;
import com.***REMOVED***.***REMOVED***solutions.service.NotificationService;
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
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationTokenRepository tokenRepository;
    private final FirebaseMessaging firebaseMessaging;
    
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
        
        // Format event time
        String eventTime = event.getStartTime().format(DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a"));
        
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
} 
 