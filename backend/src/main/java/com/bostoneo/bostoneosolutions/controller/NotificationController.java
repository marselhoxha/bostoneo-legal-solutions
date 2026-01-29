package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.dto.NotificationTokenDTO;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

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
    @PreAuthorize("isAuthenticated()")
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
    @PreAuthorize("hasRole('ROLE_ADMIN') or principal.id == #userId")
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
    @PreAuthorize("isAuthenticated()")
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
    @PreAuthorize("hasRole('ROLE_ADMIN')")
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
    
    // ==================== User Notifications ====================
    
    /**
     * Get notifications for a specific user
     */
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or principal.id == #userId")
    public ResponseEntity<HttpResponse> getUserNotifications(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        log.info("Getting notifications for user: {}", userId);
        
        try {
            // Create pageable request
            Pageable pageable = PageRequest.of(page, size);
            
            // Get notifications from service
            Page<Object> notificationPage = notificationService.getUserNotifications(userId, pageable)
                .map(notification -> {
                    Map<String, Object> notificationMap = new HashMap<>();
                    notificationMap.put("id", notification.getId());
                    notificationMap.put("title", notification.getTitle());
                    notificationMap.put("message", notification.getMessage());
                    notificationMap.put("type", notification.getType());
                    notificationMap.put("priority", notification.getPriority());
                    notificationMap.put("read", notification.getRead());
                    notificationMap.put("createdAt", notification.getCreatedAt());
                    notificationMap.put("readAt", notification.getReadAt());
                    notificationMap.put("triggeredByUserId", notification.getTriggeredByUserId());
                    notificationMap.put("triggeredByName", notification.getTriggeredByName());
                    notificationMap.put("entityId", notification.getEntityId());
                    notificationMap.put("entityType", notification.getEntityType());
                    notificationMap.put("url", notification.getUrl());
                    return notificationMap;
                });
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.OK.value())
                    .status(HttpStatus.OK)
                    .reason("Notifications retrieved successfully")
                    .message("Retrieved " + notificationPage.getContent().size() + " notifications")
                    .data(Map.of(
                        "notifications", notificationPage.getContent(), 
                        "totalElements", notificationPage.getTotalElements(), 
                        "totalPages", notificationPage.getTotalPages(),
                        "currentPage", page,
                        "pageSize", size
                    ))
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting notifications for user {}", userId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .reason("Error retrieving notifications")
                    .message("Error: " + e.getMessage())
                    .build()
            );
        }
    }
    
    /**
     * Get notification preferences for a user
     */
    @GetMapping("/preferences/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or principal.id == #userId")
    public ResponseEntity<HttpResponse> getNotificationPreferences(@PathVariable Long userId) {
        log.info("Getting notification preferences for user: {}", userId);
        
        // Return default preferences - will be implemented with proper NotificationPreferences entity
        Map<String, Object> preferences = Map.of(
            "userId", userId,
            "inApp", true,
            "email", true,
            "sms", false,
            "push", true,
            "types", Map.of(
                "ASSIGNMENT", Map.of("enabled", true, "channels", List.of("inApp", "email"), "threshold", "MEDIUM"),
                "TASK", Map.of("enabled", true, "channels", List.of("inApp"), "threshold", "MEDIUM"),
                "DEADLINE", Map.of("enabled", true, "channels", List.of("inApp", "email"), "threshold", "HIGH"),
                "WORKLOAD", Map.of("enabled", true, "channels", List.of("inApp"), "threshold", "HIGH"),
                "SYSTEM", Map.of("enabled", true, "channels", List.of("inApp"), "threshold", "LOW"),
                "CASE_UPDATE", Map.of("enabled", true, "channels", List.of("inApp"), "threshold", "MEDIUM")
            )
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Preferences retrieved successfully")
                .message("Notification preferences retrieved")
                .data(Map.of("preferences", preferences))
                .build()
        );
    }
    
    /**
     * Update notification preferences for a user
     */
    @PutMapping("/preferences/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or principal.id == #userId")
    public ResponseEntity<HttpResponse> updateNotificationPreferences(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> preferences) {
        log.info("Updating notification preferences for user: {}", userId);
        
        // For now, just return the received preferences - will be implemented with proper persistence
        preferences.put("userId", userId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Preferences updated successfully")
                .message("Notification preferences updated")
                .data(Map.of("preferences", preferences))
                .build()
        );
    }
    
    /**
     * Send notification to user(s)
     */
    @PostMapping("/send")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> sendNotification(@RequestBody Map<String, Object> notificationData) {
        log.info("Sending notification: {}", notificationData);
        
        try {
            // Create and persist the in-app notification ONLY
            // Email notifications should be triggered by backend services, not frontend
            var savedNotification = notificationService.createUserNotification(notificationData);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.OK.value())
                    .status(HttpStatus.OK)
                    .reason("Notification sent successfully")
                    .message("Notification has been sent and persisted")
                    .data(Map.of("notification", savedNotification))
                    .build()
            );
        } catch (Exception e) {
            log.error("Error sending notification", e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.BAD_REQUEST.value())
                    .status(HttpStatus.BAD_REQUEST)
                    .reason("Failed to send notification")
                    .message("Error: " + e.getMessage())
                    .build()
            );
        }
    }
    
    /**
     * Send bulk notifications
     */
    @PostMapping("/send-bulk")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> sendBulkNotifications(@RequestBody Map<String, Object> bulkData) {
        log.info("Sending bulk notifications: {}", bulkData);
        
        // Create mock notifications response - will be implemented with proper UserNotification entity
        List<Object> notifications = new ArrayList<>();
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(LocalDateTime.now().toString())
                .statusCode(HttpStatus.OK.value())
                .status(HttpStatus.OK)
                .reason("Bulk notifications sent successfully")
                .message("All notifications have been sent")
                .data(Map.of("notifications", notifications))
                .build()
        );
    }
    
    /**
     * Mark notification as read
     */
    @PutMapping("/{notificationId}/read")
    @PreAuthorize("hasRole('ROLE_USER')")
    public ResponseEntity<HttpResponse> markAsRead(@PathVariable Long notificationId) {
        log.info("Marking notification as read: {}", notificationId);
        
        try {
            notificationService.markNotificationAsRead(notificationId);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.OK.value())
                    .status(HttpStatus.OK)
                    .reason("Notification marked as read")
                    .message("Notification status updated")
                    .build()
            );
        } catch (Exception e) {
            log.error("Error marking notification {} as read", notificationId, e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.BAD_REQUEST.value())
                    .status(HttpStatus.BAD_REQUEST)
                    .reason("Failed to mark notification as read")
                    .message("Error: " + e.getMessage())
                    .build()
            );
        }
    }
    
    /**
     * Mark all notifications as read for a user
     */
    @PutMapping("/user/{userId}/read-all")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or principal.id == #userId")
    public ResponseEntity<HttpResponse> markAllAsRead(@PathVariable Long userId) {
        log.info("Marking all notifications as read for user: {}", userId);

        try {
            notificationService.markAllNotificationsAsRead(userId);

            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.OK.value())
                    .status(HttpStatus.OK)
                    .reason("All notifications marked as read")
                    .message("All notifications status updated")
                    .build()
            );
        } catch (Exception e) {
            log.error("Error marking all notifications as read for user {}", userId, e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.BAD_REQUEST.value())
                    .status(HttpStatus.BAD_REQUEST)
                    .reason("Failed to mark all notifications as read")
                    .message("Error: " + e.getMessage())
                    .build()
            );
        }
    }
    
    /**
     * Delete notification
     */
    @DeleteMapping("/{notificationId}")
    @PreAuthorize("hasRole('ROLE_USER')")
    public ResponseEntity<HttpResponse> deleteNotification(@PathVariable Long notificationId) {
        log.info("Deleting notification: {}", notificationId);

        try {
            notificationService.deleteNotification(notificationId);

            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.OK.value())
                    .status(HttpStatus.OK)
                    .reason("Notification deleted successfully")
                    .message("Notification has been removed")
                    .build()
            );
        } catch (Exception e) {
            log.error("Error deleting notification {}", notificationId, e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(LocalDateTime.now().toString())
                    .statusCode(HttpStatus.BAD_REQUEST.value())
                    .status(HttpStatus.BAD_REQUEST)
                    .reason("Failed to delete notification")
                    .message("Error: " + e.getMessage())
                    .build()
            );
        }
    }
} 
 