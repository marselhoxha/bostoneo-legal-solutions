package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.UserNotificationPreference;
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

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<UserNotificationPreference> findByIdAndOrganizationId(Long id, Long organizationId);

    List<UserNotificationPreference> findByOrganizationIdAndUserId(Long organizationId, Long userId);

    List<UserNotificationPreference> findByOrganizationIdAndUserIdOrderByEventType(Long organizationId, Long userId);

    Optional<UserNotificationPreference> findByOrganizationIdAndUserIdAndEventType(Long organizationId, Long userId, String eventType);

    List<UserNotificationPreference> findByOrganizationIdAndUserIdAndEnabledTrue(Long organizationId, Long userId);

    boolean existsByOrganizationIdAndUserId(Long organizationId, Long userId);

    /**
     * SECURITY: Delete all notification preferences for a user within an organization
     */
    @Modifying
    @Transactional
    void deleteByOrganizationIdAndUserId(Long organizationId, Long userId);

    /**
     * SECURITY: Delete a specific notification preference for a user within an organization
     */
    @Modifying
    @Transactional
    void deleteByOrganizationIdAndUserIdAndEventType(Long organizationId, Long userId, String eventType);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: These methods bypass multi-tenant isolation.

    /**
     * @deprecated Use findByOrganizationIdAndUserId for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByUserId(Long userId);
    
    /**
     * @deprecated Use findByOrganizationIdAndUserIdOrderByEventType for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByUserIdOrderByEventType(Long userId);

    /**
     * @deprecated Use findByOrganizationIdAndUserIdAndEventType for tenant isolation
     */
    @Deprecated
    Optional<UserNotificationPreference> findByUserIdAndEventType(Long userId, String eventType);

    /**
     * @deprecated Use findByOrganizationIdAndUserIdAndEnabledTrue for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByUserIdAndEnabledTrue(Long userId);
    
    // ==================== ADDITIONAL TENANT-FILTERED METHODS ====================
    // SECURITY: Use these methods for proper multi-tenant isolation in notification system.

    /**
     * SECURITY: Find preferences by event type within organization
     * @deprecated Use findByOrganizationIdAndEventTypeAndEnabledTrue for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByEventTypeAndEnabledTrue(String eventType);

    /**
     * SECURITY: Tenant-filtered version - Find all users who have enabled notifications for a specific event type
     */
    List<UserNotificationPreference> findByOrganizationIdAndEventTypeAndEnabledTrue(Long organizationId, String eventType);

    /**
     * @deprecated Use findByOrganizationIdAndEventTypeAndEnabledTrueAndEmailEnabledTrue for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByEventTypeAndEnabledTrueAndEmailEnabledTrue(String eventType);

    /**
     * SECURITY: Tenant-filtered version - Find all users who have enabled email notifications
     */
    List<UserNotificationPreference> findByOrganizationIdAndEventTypeAndEnabledTrueAndEmailEnabledTrue(Long organizationId, String eventType);

    /**
     * @deprecated Use findByOrganizationIdAndEventTypeAndEnabledTrueAndPushEnabledTrue for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByEventTypeAndEnabledTrueAndPushEnabledTrue(String eventType);

    /**
     * SECURITY: Tenant-filtered version - Find all users who have enabled push notifications
     */
    List<UserNotificationPreference> findByOrganizationIdAndEventTypeAndEnabledTrueAndPushEnabledTrue(Long organizationId, String eventType);

    /**
     * @deprecated Use findByOrganizationIdAndEventTypeAndEnabledTrueAndInAppEnabledTrue for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByEventTypeAndEnabledTrueAndInAppEnabledTrue(String eventType);

    /**
     * SECURITY: Tenant-filtered version - Find all users who have enabled in-app notifications
     */
    List<UserNotificationPreference> findByOrganizationIdAndEventTypeAndEnabledTrueAndInAppEnabledTrue(Long organizationId, String eventType);

    /**
     * @deprecated Use findHighPriorityByEventTypeAndOrganizationId for tenant isolation
     */
    @Deprecated
    @Query("SELECT unp FROM UserNotificationPreference unp WHERE unp.eventType = :eventType " +
           "AND unp.enabled = true AND (unp.priority = 'HIGH' OR unp.priority = 'CRITICAL')")
    List<UserNotificationPreference> findHighPriorityByEventType(@Param("eventType") String eventType);

    /**
     * SECURITY: Tenant-filtered version - Find users with high or critical priority notifications
     */
    @Query("SELECT unp FROM UserNotificationPreference unp WHERE unp.organizationId = :orgId " +
           "AND unp.eventType = :eventType AND unp.enabled = true " +
           "AND (unp.priority = 'HIGH' OR unp.priority = 'CRITICAL')")
    List<UserNotificationPreference> findHighPriorityByEventTypeAndOrganizationId(
           @Param("eventType") String eventType, @Param("orgId") Long organizationId);

    /**
     * @deprecated Use findByOrganizationIdAndUserIdAndEventTypeIn for tenant isolation
     */
    @Deprecated
    List<UserNotificationPreference> findByUserIdAndEventTypeIn(Long userId, List<String> eventTypes);

    /**
     * SECURITY: Tenant-filtered version - Find users by multiple event types
     */
    List<UserNotificationPreference> findByOrganizationIdAndUserIdAndEventTypeIn(Long organizationId, Long userId, List<String> eventTypes);

    /**
     * @deprecated Use existsByOrganizationIdAndUserId for tenant isolation
     */
    @Deprecated
    boolean existsByUserId(Long userId);

    /**
     * @deprecated Use deleteByOrganizationIdAndUserId for tenant isolation
     */
    @Deprecated
    @Modifying
    @Transactional
    void deleteByUserId(Long userId);

    /**
     * @deprecated Use deleteByOrganizationIdAndUserIdAndEventType for tenant isolation
     */
    @Deprecated
    @Modifying
    @Transactional
    void deleteByUserIdAndEventType(Long userId, String eventType);

    /**
     * @deprecated Use updateEnabledStatusBulkByOrganization for tenant isolation
     */
    @Deprecated
    @Modifying
    @Transactional
    @Query("UPDATE UserNotificationPreference unp SET unp.enabled = :enabled " +
           "WHERE unp.userId = :userId AND unp.eventType IN :eventTypes")
    void updateEnabledStatusBulk(@Param("userId") Long userId,
                                @Param("eventTypes") List<String> eventTypes,
                                @Param("enabled") Boolean enabled);

    /**
     * SECURITY: Tenant-filtered version - Bulk update enabled status
     */
    @Modifying
    @Transactional
    @Query("UPDATE UserNotificationPreference unp SET unp.enabled = :enabled " +
           "WHERE unp.organizationId = :orgId AND unp.userId = :userId AND unp.eventType IN :eventTypes")
    void updateEnabledStatusBulkByOrganization(@Param("orgId") Long organizationId,
                                               @Param("userId") Long userId,
                                               @Param("eventTypes") List<String> eventTypes,
                                               @Param("enabled") Boolean enabled);

    /**
     * @deprecated Use updateEmailEnabledBulkByOrganization for tenant isolation
     */
    @Deprecated
    @Modifying
    @Transactional
    @Query("UPDATE UserNotificationPreference unp SET unp.emailEnabled = :emailEnabled " +
           "WHERE unp.userId = :userId AND unp.eventType IN :eventTypes")
    void updateEmailEnabledBulk(@Param("userId") Long userId,
                               @Param("eventTypes") List<String> eventTypes,
                               @Param("emailEnabled") Boolean emailEnabled);

    /**
     * SECURITY: Tenant-filtered version - Bulk update email enabled status
     */
    @Modifying
    @Transactional
    @Query("UPDATE UserNotificationPreference unp SET unp.emailEnabled = :emailEnabled " +
           "WHERE unp.organizationId = :orgId AND unp.userId = :userId AND unp.eventType IN :eventTypes")
    void updateEmailEnabledBulkByOrganization(@Param("orgId") Long organizationId,
                                              @Param("userId") Long userId,
                                              @Param("eventTypes") List<String> eventTypes,
                                              @Param("emailEnabled") Boolean emailEnabled);

    /**
     * @deprecated Use countEnabledByOrganizationIdAndUserId for tenant isolation
     */
    @Deprecated
    @Query("SELECT COUNT(unp) FROM UserNotificationPreference unp WHERE unp.userId = :userId AND unp.enabled = true")
    Long countEnabledByUserId(@Param("userId") Long userId);

    /**
     * SECURITY: Tenant-filtered version - Get count of enabled notifications
     */
    @Query("SELECT COUNT(unp) FROM UserNotificationPreference unp " +
           "WHERE unp.organizationId = :orgId AND unp.userId = :userId AND unp.enabled = true")
    Long countEnabledByOrganizationIdAndUserId(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    /**
     * @deprecated Use countByOrganizationIdAndUserId for tenant isolation
     */
    @Deprecated
    Long countByUserId(Long userId);

    /**
     * SECURITY: Tenant-filtered version - Get count of total notifications by user
     */
    Long countByOrganizationIdAndUserId(Long organizationId, Long userId);

    /**
     * @deprecated Use findDistinctEventTypesByOrganizationId for tenant isolation
     */
    @Deprecated
    @Query("SELECT DISTINCT unp.eventType FROM UserNotificationPreference unp ORDER BY unp.eventType")
    List<String> findDistinctEventTypes();

    /**
     * SECURITY: Tenant-filtered version - Find all distinct event types within organization
     */
    @Query("SELECT DISTINCT unp.eventType FROM UserNotificationPreference unp " +
           "WHERE unp.organizationId = :orgId ORDER BY unp.eventType")
    List<String> findDistinctEventTypesByOrganizationId(@Param("orgId") Long organizationId);

    /**
     * @deprecated Use findUserIdsByEventTypeAndDeliveryChannelAndOrganizationId for tenant isolation
     */
    @Deprecated
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

    /**
     * Find users who should receive a specific type of notification within an organization
     * SECURITY: Filters users by organization to prevent cross-tenant notification leakage
     */
    @Query("SELECT unp.userId FROM UserNotificationPreference unp " +
           "JOIN User u ON unp.userId = u.id " +
           "WHERE unp.eventType = :eventType " +
           "AND unp.enabled = true " +
           "AND u.organizationId = :organizationId " +
           "AND CASE " +
           "  WHEN :deliveryChannel = 'EMAIL' THEN unp.emailEnabled = true " +
           "  WHEN :deliveryChannel = 'PUSH' THEN unp.pushEnabled = true " +
           "  WHEN :deliveryChannel = 'IN_APP' THEN unp.inAppEnabled = true " +
           "  ELSE true " +
           "END")
    List<Long> findUserIdsByEventTypeAndDeliveryChannelAndOrganizationId(
           @Param("eventType") String eventType,
           @Param("deliveryChannel") String deliveryChannel,
           @Param("organizationId") Long organizationId);
}