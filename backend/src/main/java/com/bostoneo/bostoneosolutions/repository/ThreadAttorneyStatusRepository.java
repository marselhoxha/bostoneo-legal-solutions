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
 * Repository for per-attorney thread status tracking with multi-tenant support.
 * Supports multi-attorney scenarios where each attorney has their own unread count.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface ThreadAttorneyStatusRepository extends JpaRepository<ThreadAttorneyStatus, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<ThreadAttorneyStatus> findByIdAndOrganizationId(Long id, Long organizationId);

    Optional<ThreadAttorneyStatus> findByOrganizationIdAndThreadIdAndAttorneyUserId(Long organizationId, Long threadId, Long attorneyUserId);

    List<ThreadAttorneyStatus> findByOrganizationIdAndThreadId(Long organizationId, Long threadId);

    List<ThreadAttorneyStatus> findByOrganizationIdAndAttorneyUserId(Long organizationId, Long attorneyUserId);

    @Query("SELECT COALESCE(SUM(s.unreadCount), 0) FROM ThreadAttorneyStatus s " +
           "WHERE s.organizationId = :orgId AND s.attorneyUserId = :attorneyUserId")
    Integer getTotalUnreadCountForAttorneyByOrganizationId(@Param("orgId") Long organizationId, @Param("attorneyUserId") Long attorneyUserId);

    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = 0, s.lastReadAt = :readAt, s.updatedAt = :readAt " +
           "WHERE s.organizationId = :orgId AND s.threadId = :threadId AND s.attorneyUserId = :attorneyUserId")
    int markAsReadForAttorneyByOrganizationId(@Param("orgId") Long organizationId,
                                               @Param("threadId") Long threadId,
                                               @Param("attorneyUserId") Long attorneyUserId,
                                               @Param("readAt") LocalDateTime readAt);

    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.organizationId = :orgId AND s.threadId = :threadId AND s.attorneyUserId != :excludeAttorneyUserId")
    int incrementUnreadForOtherAttorneysByOrganizationId(@Param("orgId") Long organizationId,
                                                          @Param("threadId") Long threadId,
                                                          @Param("excludeAttorneyUserId") Long excludeAttorneyUserId);

    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.organizationId = :orgId AND s.threadId = :threadId")
    int incrementUnreadForAllAttorneysByOrganizationId(@Param("orgId") Long organizationId, @Param("threadId") Long threadId);

    @Modifying
    @Query("DELETE FROM ThreadAttorneyStatus s WHERE s.organizationId = :orgId AND s.threadId = :threadId")
    void deleteByOrganizationIdAndThreadId(@Param("orgId") Long organizationId, @Param("threadId") Long threadId);

    boolean existsByOrganizationIdAndThreadIdAndAttorneyUserId(Long organizationId, Long threadId, Long attorneyUserId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Verify thread ownership through MessageThread.organizationId before calling.

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    Optional<ThreadAttorneyStatus> findByThreadIdAndAttorneyUserId(Long threadId, Long attorneyUserId);

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    List<ThreadAttorneyStatus> findByThreadId(Long threadId);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    List<ThreadAttorneyStatus> findByAttorneyUserId(Long attorneyUserId);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    @Query("SELECT COALESCE(SUM(s.unreadCount), 0) FROM ThreadAttorneyStatus s WHERE s.attorneyUserId = :attorneyUserId")
    Integer getTotalUnreadCountForAttorney(@Param("attorneyUserId") Long attorneyUserId);

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = 0, s.lastReadAt = :readAt, s.updatedAt = :readAt " +
           "WHERE s.threadId = :threadId AND s.attorneyUserId = :attorneyUserId")
    int markAsReadForAttorney(@Param("threadId") Long threadId,
                               @Param("attorneyUserId") Long attorneyUserId,
                               @Param("readAt") LocalDateTime readAt);

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.threadId = :threadId AND s.attorneyUserId != :excludeAttorneyUserId")
    int incrementUnreadForOtherAttorneys(@Param("threadId") Long threadId,
                                          @Param("excludeAttorneyUserId") Long excludeAttorneyUserId);

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    @Modifying
    @Query("UPDATE ThreadAttorneyStatus s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.threadId = :threadId")
    int incrementUnreadForAllAttorneys(@Param("threadId") Long threadId);

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    void deleteByThreadId(Long threadId);

    /** @deprecated Verify thread ownership through MessageThread.organizationId before calling */
    @Deprecated
    boolean existsByThreadIdAndAttorneyUserId(Long threadId, Long attorneyUserId);
}
