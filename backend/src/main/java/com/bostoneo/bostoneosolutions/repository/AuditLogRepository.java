package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    // ==================== TENANT-FILTERED METHODS (PRIMARY) ====================

    /**
     * SECURITY: Find all audit logs for an organization (tenant isolation)
     */
    List<AuditLog> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find audit log by ID and organization (tenant isolation)
     */
    java.util.Optional<AuditLog> findByIdAndOrganizationId(Long id, Long organizationId);

    // Find activities by organization
    Page<AuditLog> findByOrganizationIdOrderByTimestampDesc(Long organizationId, Pageable pageable);

    // Find activities by organization and user
    Page<AuditLog> findByOrganizationIdAndUserIdOrderByTimestampDesc(Long organizationId, Long userId, Pageable pageable);

    // Find activities by organization and entity type
    Page<AuditLog> findByOrganizationIdAndEntityTypeOrderByTimestampDesc(Long organizationId, AuditLog.EntityType entityType, Pageable pageable);

    // Find activities by organization and action
    Page<AuditLog> findByOrganizationIdAndActionOrderByTimestampDesc(Long organizationId, AuditLog.AuditAction action, Pageable pageable);

    // Find activities by organization and date range
    Page<AuditLog> findByOrganizationIdAndTimestampBetweenOrderByTimestampDesc(Long organizationId, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    // Find activities by organization, user and date range
    Page<AuditLog> findByOrganizationIdAndUserIdAndTimestampBetweenOrderByTimestampDesc(Long organizationId, Long userId, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    // Find activities by organization, entity and entity ID
    List<AuditLog> findByOrganizationIdAndEntityTypeAndEntityIdOrderByTimestampDesc(Long organizationId, AuditLog.EntityType entityType, Long entityId);

    // Count activities by organization and date range
    long countByOrganizationIdAndTimestampBetween(Long organizationId, LocalDateTime startDate, LocalDateTime endDate);

    // Count today's activities for organization
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :startOfDay AND a.timestamp < :endOfDay")
    long countTodayActivitiesByOrganization(@Param("organizationId") Long organizationId, @Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay);

    // Count this week's activities for organization
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :weekStart")
    long countWeekActivitiesByOrganization(@Param("organizationId") Long organizationId, @Param("weekStart") LocalDateTime weekStart);

    // Get most active users for organization
    @Query("SELECT a.userId, COUNT(a) as activityCount FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :startDate GROUP BY a.userId ORDER BY activityCount DESC")
    List<Object[]> findMostActiveUsersByOrganization(@Param("organizationId") Long organizationId, @Param("startDate") LocalDateTime startDate, Pageable pageable);

    // Get most common actions for organization
    @Query("SELECT a.action, COUNT(a) as actionCount FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :startDate GROUP BY a.action ORDER BY actionCount DESC")
    List<Object[]> findMostCommonActionsByOrganization(@Param("organizationId") Long organizationId, @Param("startDate") LocalDateTime startDate, Pageable pageable);

    // Get most accessed entities for organization
    @Query("SELECT a.entityType, COUNT(a) as accessCount FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :startDate GROUP BY a.entityType ORDER BY accessCount DESC")
    List<Object[]> findMostAccessedEntitiesByOrganization(@Param("organizationId") Long organizationId, @Param("startDate") LocalDateTime startDate, Pageable pageable);

    // Count unique active users today for organization
    @Query("SELECT COUNT(DISTINCT a.userId) FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :startOfDay AND a.timestamp < :endOfDay AND a.userId IS NOT NULL")
    long countUniqueActiveUsersTodayByOrganization(@Param("organizationId") Long organizationId, @Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay);

    // Find recent activities for dashboard by organization
    @Query("SELECT a FROM AuditLog a WHERE a.organizationId = :organizationId AND a.timestamp >= :since ORDER BY a.timestamp DESC")
    List<AuditLog> findRecentActivitiesForDashboardByOrganization(@Param("organizationId") Long organizationId, @Param("since") LocalDateTime since, Pageable pageable);

    // ==================== LEGACY METHODS (KEPT FOR BACKWARD COMPATIBILITY) ====================

    // Find activities by user
    Page<AuditLog> findByUserIdOrderByTimestampDesc(Long userId, Pageable pageable);

    // Find recent activities
    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    // Find activities by entity type
    Page<AuditLog> findByEntityTypeOrderByTimestampDesc(AuditLog.EntityType entityType, Pageable pageable);

    // Find activities by action
    Page<AuditLog> findByActionOrderByTimestampDesc(AuditLog.AuditAction action, Pageable pageable);

    // Find activities by date range
    Page<AuditLog> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    // Count activities by date range
    long countByTimestampBetween(LocalDateTime startDate, LocalDateTime endDate);

    // Count today's activities
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.timestamp >= :startOfDay AND a.timestamp < :endOfDay")
    long countTodayActivities(@Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay);

    // Count this week's activities
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.timestamp >= :weekStart")
    long countWeekActivities(@Param("weekStart") LocalDateTime weekStart);

    // Get most active users
    @Query("SELECT a.userId, COUNT(a) as activityCount FROM AuditLog a WHERE a.timestamp >= :startDate GROUP BY a.userId ORDER BY activityCount DESC")
    List<Object[]> findMostActiveUsers(@Param("startDate") LocalDateTime startDate, Pageable pageable);

    // Get most common actions
    @Query("SELECT a.action, COUNT(a) as actionCount FROM AuditLog a WHERE a.timestamp >= :startDate GROUP BY a.action ORDER BY actionCount DESC")
    List<Object[]> findMostCommonActions(@Param("startDate") LocalDateTime startDate, Pageable pageable);

    // Get most accessed entities
    @Query("SELECT a.entityType, COUNT(a) as accessCount FROM AuditLog a WHERE a.timestamp >= :startDate GROUP BY a.entityType ORDER BY accessCount DESC")
    List<Object[]> findMostAccessedEntities(@Param("startDate") LocalDateTime startDate, Pageable pageable);

    // Find activities by user and date range
    Page<AuditLog> findByUserIdAndTimestampBetweenOrderByTimestampDesc(Long userId, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    // Find activities by entity and entity ID
    List<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(AuditLog.EntityType entityType, Long entityId);

    // Count unique active users today
    @Query("SELECT COUNT(DISTINCT a.userId) FROM AuditLog a WHERE a.timestamp >= :startOfDay AND a.timestamp < :endOfDay AND a.userId IS NOT NULL")
    long countUniqueActiveUsersToday(@Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay);

    // Find recent activities for dashboard (with user info)
    @Query("SELECT a FROM AuditLog a WHERE a.timestamp >= :since ORDER BY a.timestamp DESC")
    List<AuditLog> findRecentActivitiesForDashboard(@Param("since") LocalDateTime since, Pageable pageable);
} 
 
 
 
 
 
 