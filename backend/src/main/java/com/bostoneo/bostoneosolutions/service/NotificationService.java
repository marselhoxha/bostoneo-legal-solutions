package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.NotificationTokenDTO;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.UserNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

public interface NotificationService {
    
    /**
     * Register a new device token for push notifications
     */
    NotificationTokenDTO registerToken(NotificationTokenDTO tokenDTO);
    
    /**
     * Send a push notification for a calendar event reminder
     */
    void sendEventReminderNotification(CalendarEvent event, int minutesBefore, Long userId);
    
    /**
     * Get all tokens for a specific user
     */
    List<NotificationTokenDTO> getTokensByUserId(Long userId);
    
    /**
     * Delete a notification token
     */
    void deleteToken(String token);
    
    /**
     * Send a push notification for CRM events (lead status changes, assignments, etc.)
     */
    void sendCrmNotification(String title, String body, Long userId, String type, Object data);
    
    /**
     * Send a push notification to all users (for broadcast events)
     */
    void sendBroadcastNotification(String title, String body, String type, Object data);
    
    // User Notification Management Methods
    
    /**
     * Create and persist a user notification
     */
    UserNotification createUserNotification(Map<String, Object> notificationData);
    
    /**
     * Get notifications for a user with pagination
     */
    Page<UserNotification> getUserNotifications(Long userId, Pageable pageable);
    
    /**
     * Get unread notifications for a user
     */
    List<UserNotification> getUnreadNotifications(Long userId);
    
    /**
     * Mark notification as read
     */
    void markNotificationAsRead(Long notificationId);
    
    /**
     * Mark all notifications as read for a user
     */
    void markAllNotificationsAsRead(Long userId);
    
    /**
     * Delete a notification
     */
    void deleteNotification(Long notificationId);
    
    /**
     * Get notification count for a user
     */
    long getUnreadNotificationCount(Long userId);
} 
 