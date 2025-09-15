package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.UserNotificationPreference;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service interface for UserNotificationPreference operations
 * Defines business logic operations for managing user notification preferences
 */
public interface UserNotificationPreferenceService {
    
    /**
     * Get all notification preferences for a user
     * @param userId The user ID
     * @return List of notification preferences
     */
    List<UserNotificationPreference> getUserPreferences(Long userId);
    
    /**
     * Get all notification preferences for a user as a map (eventType -> preference)
     * @param userId The user ID
     * @return Map of event types to preferences
     */
    Map<String, UserNotificationPreference> getUserPreferencesMap(Long userId);
    
    /**
     * Get a specific notification preference for a user and event type
     * @param userId The user ID
     * @param eventType The event type
     * @return Optional containing the preference if found
     */
    Optional<UserNotificationPreference> getUserPreference(Long userId, String eventType);
    
    /**
     * Save or update a notification preference
     * @param preference The preference to save
     * @return The saved preference
     */
    UserNotificationPreference savePreference(UserNotificationPreference preference);
    
    /**
     * Save or update multiple notification preferences
     * @param preferences The list of preferences to save
     * @return List of saved preferences
     */
    List<UserNotificationPreference> savePreferences(List<UserNotificationPreference> preferences);
    
    /**
     * Update all notification preferences for a user
     * @param userId The user ID
     * @param preferences Map of event types to preferences
     * @return List of updated preferences
     */
    List<UserNotificationPreference> updateUserPreferences(Long userId, Map<String, UserNotificationPreference> preferences);
    
    /**
     * Update a specific preference for a user
     * @param userId The user ID
     * @param eventType The event type
     * @param enabled Whether notifications are enabled
     * @param emailEnabled Whether email notifications are enabled
     * @param pushEnabled Whether push notifications are enabled
     * @param inAppEnabled Whether in-app notifications are enabled
     * @param priority The notification priority
     * @return The updated preference
     */
    UserNotificationPreference updatePreference(Long userId, String eventType, Boolean enabled, 
                                               Boolean emailEnabled, Boolean pushEnabled, 
                                               Boolean inAppEnabled, UserNotificationPreference.NotificationPriority priority);
    
    /**
     * Enable or disable all notifications for a user
     * @param userId The user ID
     * @param enabled Whether to enable or disable all notifications
     * @return List of updated preferences
     */
    List<UserNotificationPreference> setAllNotificationsEnabled(Long userId, Boolean enabled);
    
    /**
     * Enable or disable email notifications for all preferences of a user
     * @param userId The user ID
     * @param emailEnabled Whether to enable or disable email notifications
     * @return List of updated preferences
     */
    List<UserNotificationPreference> setAllEmailNotificationsEnabled(Long userId, Boolean emailEnabled);
    
    /**
     * Enable or disable push notifications for all preferences of a user
     * @param userId The user ID
     * @param pushEnabled Whether to enable or disable push notifications
     * @return List of updated preferences
     */
    List<UserNotificationPreference> setAllPushNotificationsEnabled(Long userId, Boolean pushEnabled);
    
    /**
     * Reset user preferences to role-based defaults
     * @param userId The user ID
     * @param roleName The user's role name
     * @return List of reset preferences
     */
    List<UserNotificationPreference> resetToRoleDefaults(Long userId, String roleName);
    
    /**
     * Initialize default preferences for a new user
     * @param userId The user ID
     * @param roleName The user's role name
     * @return List of created preferences
     */
    List<UserNotificationPreference> initializeUserPreferences(Long userId, String roleName);
    
    /**
     * Delete all preferences for a user
     * @param userId The user ID
     */
    void deleteUserPreferences(Long userId);
    
    /**
     * Delete a specific preference for a user
     * @param userId The user ID
     * @param eventType The event type
     */
    void deletePreference(Long userId, String eventType);
    
    /**
     * Check if a user should receive a notification for a specific event
     * @param userId The user ID
     * @param eventType The event type
     * @return true if user should receive notification
     */
    boolean shouldReceiveNotification(Long userId, String eventType);
    
    /**
     * Check if a user should receive email notification for a specific event
     * @param userId The user ID
     * @param eventType The event type
     * @return true if user should receive email notification
     */
    boolean shouldReceiveEmailNotification(Long userId, String eventType);
    
    /**
     * Check if a user should receive push notification for a specific event
     * @param userId The user ID
     * @param eventType The event type
     * @return true if user should receive push notification
     */
    boolean shouldReceivePushNotification(Long userId, String eventType);
    
    /**
     * Check if a user should receive in-app notification for a specific event
     * @param userId The user ID
     * @param eventType The event type
     * @return true if user should receive in-app notification
     */
    boolean shouldReceiveInAppNotification(Long userId, String eventType);
    
    /**
     * Get all users who should receive notifications for a specific event type
     * @param eventType The event type
     * @param deliveryChannel The delivery channel (EMAIL, PUSH, IN_APP, null for any)
     * @return List of user IDs who should receive the notification
     */
    List<Long> getUsersForNotification(String eventType, String deliveryChannel);
    
    /**
     * Get notification statistics for a user
     * @param userId The user ID
     * @return Map containing statistics (total, enabled, disabled, etc.)
     */
    Map<String, Object> getUserNotificationStats(Long userId);
    
    /**
     * Get all available event types
     * @return List of all event types
     */
    List<String> getAllEventTypes();
    
    /**
     * Check if user has any preferences configured
     * @param userId The user ID
     * @return true if user has preferences
     */
    boolean hasUserPreferences(Long userId);
}