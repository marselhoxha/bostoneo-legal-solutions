package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.NotificationTokenDTO;
import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;

import java.util.List;

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
} 
 