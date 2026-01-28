package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.UserNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {

    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /**
     * @deprecated Use findByUserIdAndOrganizationIdOrderByCreatedAtDesc instead for tenant isolation
     */
    @Deprecated
    Page<UserNotification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /**
     * @deprecated Use findByUserIdAndOrganizationIdAndReadFalseOrderByCreatedAtDesc instead for tenant isolation
     */
    @Deprecated
    List<UserNotification> findByUserIdAndReadFalseOrderByCreatedAtDesc(Long userId);

    /**
     * @deprecated Use countByUserIdAndOrganizationIdAndReadFalse instead for tenant isolation
     */
    @Deprecated
    long countByUserIdAndReadFalse(Long userId);

    /**
     * @deprecated Use findByUserIdAndOrganizationIdAndCreatedAtAfterOrderByCreatedAtDesc instead for tenant isolation
     */
    @Deprecated
    List<UserNotification> findByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(Long userId, LocalDateTime after);

    /**
     * @deprecated Use markAllAsReadByUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true, n.readAt = :readAt WHERE n.userId = :userId AND n.read = false")
    int markAllAsReadByUserId(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);

    /**
     * @deprecated Use markAsReadByIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true, n.readAt = :readAt WHERE n.id = :id")
    int markAsReadById(@Param("id") Long id, @Param("readAt") LocalDateTime readAt);

    /**
     * @deprecated Use deleteNotificationsOlderThanByOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.createdAt < :before")
    int deleteNotificationsOlderThan(@Param("before") LocalDateTime before);

    /**
     * @deprecated Use existsByIdAndUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    boolean existsByIdAndUserId(Long id, Long userId);

    /**
     * @deprecated Use deleteByIdAndUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.id = :id AND n.userId = :userId")
    int deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * SECURITY: Find all notifications for a specific user within organization, paginated
     */
    Page<UserNotification> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
        Long userId, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find unread notifications for a specific user within organization
     */
    List<UserNotification> findByUserIdAndOrganizationIdAndReadFalseOrderByCreatedAtDesc(
        Long userId, Long organizationId);

    /**
     * SECURITY: Count unread notifications for a specific user within organization
     */
    long countByUserIdAndOrganizationIdAndReadFalse(Long userId, Long organizationId);

    /**
     * SECURITY: Find notifications for a user created after a specific time within organization
     */
    List<UserNotification> findByUserIdAndOrganizationIdAndCreatedAtAfterOrderByCreatedAtDesc(
        Long userId, Long organizationId, LocalDateTime after);

    /**
     * SECURITY: Mark all notifications as read for a specific user within organization
     */
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true, n.readAt = :readAt " +
           "WHERE n.userId = :userId AND n.organizationId = :organizationId AND n.read = false")
    int markAllAsReadByUserIdAndOrganizationId(
        @Param("userId") Long userId,
        @Param("organizationId") Long organizationId,
        @Param("readAt") LocalDateTime readAt);

    /**
     * SECURITY: Mark a specific notification as read with organization verification
     */
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true, n.readAt = :readAt " +
           "WHERE n.id = :id AND n.organizationId = :organizationId")
    int markAsReadByIdAndOrganizationId(
        @Param("id") Long id,
        @Param("organizationId") Long organizationId,
        @Param("readAt") LocalDateTime readAt);

    /**
     * SECURITY: Delete notifications older than a specific date within organization
     */
    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.createdAt < :before AND n.organizationId = :organizationId")
    int deleteNotificationsOlderThanByOrganizationId(
        @Param("before") LocalDateTime before,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Check if notification exists and belongs to user within organization
     */
    boolean existsByIdAndUserIdAndOrganizationId(Long id, Long userId, Long organizationId);

    /**
     * SECURITY: Delete notification by id if it belongs to user within organization
     */
    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.id = :id AND n.userId = :userId AND n.organizationId = :organizationId")
    int deleteByIdAndUserIdAndOrganizationId(
        @Param("id") Long id,
        @Param("userId") Long userId,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find notification by ID with organization verification
     */
    Optional<UserNotification> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find all notifications for an organization (tenant isolation)
     */
    List<UserNotification> findByOrganizationId(Long organizationId);
}