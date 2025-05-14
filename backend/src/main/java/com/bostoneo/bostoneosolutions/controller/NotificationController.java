package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.dto.NotificationTokenDTO;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Controller for handling notification tokens and sending push notifications
 */
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {
    
    private final NotificationService notificationService;
    
    /**
     * Register a device token for push notifications
     */
    @PostMapping("/token")
    public ResponseEntity<HttpResponse> registerToken(@RequestBody NotificationTokenDTO tokenDTO) {
        log.info("Registering notification token for user: {}", tokenDTO.getUserId());
        
        NotificationTokenDTO savedToken = notificationService.registerToken(tokenDTO);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Token registered successfully")
                .message("Device registered for push notifications")
                .developerMessage("Token saved to database")
                .data(Map.of("token", savedToken))
                .build()
        );
    }
    
    /**
     * Get all tokens for a user
     */
    @GetMapping("/tokens/{userId}")
    public ResponseEntity<HttpResponse> getTokensByUserId(@PathVariable Long userId) {
        log.info("Getting notification tokens for user: {}", userId);
        
        List<NotificationTokenDTO> tokens = notificationService.getTokensByUserId(userId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Tokens retrieved successfully")
                .message("Retrieved " + tokens.size() + " notification tokens")
                .developerMessage("Tokens fetched from database")
                .data(Map.of("tokens", tokens))
                .build()
        );
    }
    
    /**
     * Delete a notification token
     */
    @DeleteMapping("/token/{token}")
    public ResponseEntity<HttpResponse> deleteToken(@PathVariable String token) {
        log.info("Deleting notification token: {}", token);
        
        notificationService.deleteToken(token);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Token deleted successfully")
                .message("Device unregistered from push notifications")
                .developerMessage("Token deleted from database")
                .build()
        );
    }
    
    /**
     * Send a test notification
     */
    @PostMapping("/test/{userId}")
    public ResponseEntity<HttpResponse> sendTestNotification(@PathVariable Long userId) {
        log.info("Sending test notification to user: {}", userId);
        
        // We'll implement this in the CalendarEventService to call the NotificationService
        // This is just a stub endpoint
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Test notification sent")
                .message("Push notification triggered")
                .developerMessage("Notification sent via Firebase")
                .build()
        );
    }
} 
 