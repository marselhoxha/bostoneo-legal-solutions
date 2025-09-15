package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.UserNotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for UserNotificationPreference entity
 * Provides data access methods for user notification preferences
 */
@Repository
public interface UserNotificationPreferenceRepository extends JpaRepository<UserNotificationPreference, Long> {
    
    /**
     * Find all notification preferences for a specific user
     * @param userId The user ID
     * @return List of notification preferences for the user
     */
    List<UserNotificationPreference> findByUserId(Long userId);
    
    /**
     * Find all notification preferences for a specific user, ordered by event type
     * @param userId The user ID
     * @return List of notification preferences ordered by event type
     */
    List<UserNotificationPreference> findByUserIdOrderByEventType(Long userId);
    
    /**
     * Find a specific notification preference for a user and event type
     * @param userId The user ID
     * @param eventType The event type
     * @return Optional containing the preference if found
     */
    Optional<UserNotificationPreference> findByUserIdAndEventType(Long userId, String eventType);
    
    /**
     * Find all enabled notification preferences for a user
     * @param userId The user ID
     * @return List of enabled notification preferences
     */
    List<UserNotificationPreference> findByUserIdAndEnabledTrue(Long userId);
    
    /**
     * Find all users who have enabled notifications for a specific event type
     * @param eventType The event type
     * @return List of notification preferences for users who have this event enabled
     */
    List<UserNotificationPreference> findByEventTypeAndEnabledTrue(String eventType);
    
    /**
     * Find all users who have enabled email notifications for a specific event type
     * @param eventType The event type
     * @return List of preferences for users who have email enabled for this event
     */
    List<UserNotificationPreference> findByEventTypeAndEnabledTrueAndEmailEnabledTrue(String eventType);
    
    /**
     * Find all users who have enabled push notifications for a specific event type
     * @param eventType The event type
     * @return List of preferences for users who have push enabled for this event
     */
    List<UserNotificationPreference> findByEventTypeAndEnabledTrueAndPushEnabledTrue(String eventType);
    
    /**
     * Find all users who have enabled in-app notifications for a specific event type
     * @param eventType The event type
     * @return List of preferences for users who have in-app enabled for this event
     */
    List<UserNotificationPreference> findByEventTypeAndEnabledTrueAndInAppEnabledTrue(String eventType);
    
    /**
     * Find users with high or critical priority notifications for an event type
     * @param eventType The event type
     * @return List of preferences for users with high/critical priority for this event
     */
    @Query("SELECT unp FROM UserNotificationPreference unp WHERE unp.eventType = :eventType " +
           "AND unp.enabled = true AND (unp.priority = 'HIGH' OR unp.priority = 'CRITICAL')")
    List<UserNotificationPreference> findHighPriorityByEventType(@Param("eventType") String eventType);
    
    /**
     * Find users by multiple event types (for bulk operations)
     * @param userId The user ID
     * @param eventTypes List of event types
     * @return List of notification preferences
     */
    List<UserNotificationPreference> findByUserIdAndEventTypeIn(Long userId, List<String> eventTypes);
    
    /**
     * Check if a user has any notification preferences set up
     * @param userId The user ID
     * @return true if user has any preferences, false otherwise
     */
    boolean existsByUserId(Long userId);
    
    /**
     * Delete all notification preferences for a user
     * @param userId The user ID
     */
    @Modifying
    @Transactional
    void deleteByUserId(Long userId);
    
    /**
     * Delete a specific notification preference for a user
     * @param userId The user ID
     * @param eventType The event type
     */
    @Modifying
    @Transactional
    void deleteByUserIdAndEventType(Long userId, String eventType);
    
    /**
     * Bulk update enabled status for multiple preferences
     * @param userId The user ID
     * @param eventTypes List of event types to update
     * @param enabled The new enabled status
     */
    @Modifying
    @Transactional
    @Query("UPDATE UserNotificationPreference unp SET unp.enabled = :enabled " +
           "WHERE unp.userId = :userId AND unp.eventType IN :eventTypes")
    void updateEnabledStatusBulk(@Param("userId") Long userId, 
                                @Param("eventTypes") List<String> eventTypes, 
                                @Param("enabled") Boolean enabled);
    
    /**
     * Bulk update email enabled status for multiple preferences
     * @param userId The user ID
     * @param eventTypes List of event types to update
     * @param emailEnabled The new email enabled status
     */
    @Modifying
    @Transactional
    @Query("UPDATE UserNotificationPreference unp SET unp.emailEnabled = :emailEnabled " +
           "WHERE unp.userId = :userId AND unp.eventType IN :eventTypes")
    void updateEmailEnabledBulk(@Param("userId") Long userId, 
                               @Param("eventTypes") List<String> eventTypes, 
                               @Param("emailEnabled") Boolean emailEnabled);
    
    /**
     * Get count of enabled notifications by user
     * @param userId The user ID
     * @return Count of enabled notifications
     */
    @Query("SELECT COUNT(unp) FROM UserNotificationPreference unp WHERE unp.userId = :userId AND unp.enabled = true")
    Long countEnabledByUserId(@Param("userId") Long userId);
    
    /**
     * Get count of total notifications by user
     * @param userId The user ID
     * @return Total count of notifications for user
     */
    Long countByUserId(Long userId);
    
    /**
     * Find all distinct event types in the system
     * @return List of distinct event types
     */
    @Query("SELECT DISTINCT unp.eventType FROM UserNotificationPreference unp ORDER BY unp.eventType")
    List<String> findDistinctEventTypes();
    
    /**
     * Find users who should receive a specific type of notification with filtering
     * This is the main method used by the notification system
     * @param eventType The event type
     * @param deliveryChannel The delivery channel (EMAIL, PUSH, IN_APP)
     * @return List of user IDs who should receive this notification
     */
    @Query("SELECT unp.userId FROM UserNotificationPreference unp WHERE unp.eventType = :eventType " +
           "AND unp.enabled = true " +
           "AND CASE " +
           "  WHEN :deliveryChannel = 'EMAIL' THEN unp.emailEnabled = true " +
           "  WHEN :deliveryChannel = 'PUSH' THEN unp.pushEnabled = true " +
           "  WHEN :deliveryChannel = 'IN_APP' THEN unp.inAppEnabled = true " +
           "  ELSE true " +
           "END")
    List<Long> findUserIdsByEventTypeAndDeliveryChannel(@Param("eventType") String eventType, 
                                                        @Param("deliveryChannel") String deliveryChannel);
}