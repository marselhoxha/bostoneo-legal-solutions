package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for managing audit logs
 */
public interface AuditLogService {

    /**
     * Log an activity
     */
    AuditLog log(AuditLog.AuditAction action, AuditLog.EntityType entityType, Long entityId, String description);

    /**
     * Log an activity with metadata
     */
    AuditLog log(AuditLog.AuditAction action, AuditLog.EntityType entityType, Long entityId, String description, String metadata);

    /**
     * Log an activity with full details
     */
    AuditLog log(Long userId, Long organizationId, AuditLog.AuditAction action, AuditLog.EntityType entityType,
                 Long entityId, String description, String metadata, String ipAddress, String userAgent);

    /**
     * Get audit logs for current organization
     */
    Page<AuditLog> getAuditLogs(Pageable pageable);

    /**
     * Get audit logs by entity
     */
    List<AuditLog> getAuditLogsByEntity(AuditLog.EntityType entityType, Long entityId);

    /**
     * Get audit logs by user
     */
    Page<AuditLog> getAuditLogsByUser(Long userId, Pageable pageable);

    /**
     * Get audit logs by date range
     */
    Page<AuditLog> getAuditLogsByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    /**
     * Get recent activities for dashboard
     */
    List<AuditLog> getRecentActivities(int limit);
}
