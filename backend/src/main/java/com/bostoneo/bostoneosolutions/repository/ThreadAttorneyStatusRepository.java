package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ThreadAttorneyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for per-attorney thread status tracking.
 * Supports multi-attorney scenarios where each attorney has their own unread count.
 */
@Repository
public interface ThreadAttorneyStatusRepository extends JpaRepository<ThreadAttorneyStatus, Long> {

    /**
     * Find status for a specific attorney and thread
     */
    Optional<ThreadAttorneyStatus> findByThreadIdAndAttorneyUserId(Long threadId, Long attorneyUserId);

    /**
     * Find all statuses for a specific thread (all attorneys)
     */
    List<ThreadAttorneyStatus> findByThreadId(Long threadId);

    /**
     * Find all statuses for a specific attorney (all their threads)
     */
    List<ThreadAttorneyStatus> findByAttorneyUserId(Long attorneyUserId);

    /**
     * Get total unread count for an attorney across all threads
     */
    @Query("SELECT COALESCE(SUM(s.unreadCount), 0) FROM ThreadAttorneyStatus s WHERE s.attorneyUserId = :attorneyUserId")
    Integer getTotalUnreadCountForAttorney(@Param("attorneyUserId") Long attorneyUserId);

    /**
     * Mark thread as read for a specific attorney
     */
    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = 0, s.lastReadAt = :readAt, s.updatedAt = :readAt " +
           "WHERE s.threadId = :threadId AND s.attorneyUserId = :attorneyUserId")
    int markAsReadForAttorney(@Param("threadId") Long threadId,
                               @Param("attorneyUserId") Long attorneyUserId,
                               @Param("readAt") LocalDateTime readAt);

    /**
     * Increment unread count for all attorneys on a thread EXCEPT the sender
     */
    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.threadId = :threadId AND s.attorneyUserId != :excludeAttorneyUserId")
    int incrementUnreadForOtherAttorneys(@Param("threadId") Long threadId,
                                          @Param("excludeAttorneyUserId") Long excludeAttorneyUserId);

    /**
     * Increment unread count for ALL attorneys on a thread (when client sends message)
     */
    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.threadId = :threadId")
    int incrementUnreadForAllAttorneys(@Param("threadId") Long threadId);

    /**
     * Delete all statuses for a thread (when thread is deleted)
     */
    void deleteByThreadId(Long threadId);

    /**
     * Check if status exists for attorney and thread
     */
    boolean existsByThreadIdAndAttorneyUserId(Long threadId, Long attorneyUserId);
}
