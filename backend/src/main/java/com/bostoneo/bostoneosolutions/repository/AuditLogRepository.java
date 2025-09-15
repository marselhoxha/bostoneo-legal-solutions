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
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE DATE(a.timestamp) = CURRENT_DATE")
    long countTodayActivities();

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
    @Query("SELECT COUNT(DISTINCT a.userId) FROM AuditLog a WHERE DATE(a.timestamp) = CURRENT_DATE AND a.userId IS NOT NULL")
    long countUniqueActiveUsersToday();

    // Find recent activities for dashboard (with user info)
    @Query("SELECT a FROM AuditLog a WHERE a.timestamp >= :since ORDER BY a.timestamp DESC")
    List<AuditLog> findRecentActivitiesForDashboard(@Param("since") LocalDateTime since, Pageable pageable);
} 
 
 
 
 
 
 