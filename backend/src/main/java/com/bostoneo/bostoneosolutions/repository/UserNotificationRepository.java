package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.UserNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {
    
    /**
     * Find all notifications for a specific user, paginated
     */
    Page<UserNotification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    
    /**
     * Find unread notifications for a specific user
     */
    List<UserNotification> findByUserIdAndReadFalseOrderByCreatedAtDesc(Long userId);
    
    /**
     * Count unread notifications for a specific user
     */
    long countByUserIdAndReadFalse(Long userId);
    
    /**
     * Find notifications for a user created after a specific time
     */
    List<UserNotification> findByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(Long userId, LocalDateTime after);
    
    /**
     * Mark all notifications as read for a specific user
     */
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true, n.readAt = :readAt WHERE n.userId = :userId AND n.read = false")
    int markAllAsReadByUserId(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);
    
    /**
     * Mark a specific notification as read
     */
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true, n.readAt = :readAt WHERE n.id = :id")
    int markAsReadById(@Param("id") Long id, @Param("readAt") LocalDateTime readAt);
    
    /**
     * Delete notifications older than a specific date
     */
    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.createdAt < :before")
    int deleteNotificationsOlderThan(@Param("before") LocalDateTime before);
}