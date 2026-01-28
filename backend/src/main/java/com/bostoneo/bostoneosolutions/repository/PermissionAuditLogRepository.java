package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;

import java.time.LocalDateTime;
import java.util.List;

public interface PermissionAuditLogRepository<T extends PermissionAuditLog> {
    T save(T log);

    /**
     * @deprecated Use findByUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    List<T> findByUserId(Long userId);

    /**
     * @deprecated Use findRecentLogsByOrganizationId instead for tenant isolation
     */
    @Deprecated
    List<T> findRecentLogs(int limit);

    /**
     * @deprecated Use searchLogsByOrganizationId instead for tenant isolation
     */
    @Deprecated
    List<T> searchLogs(Long userId, String action, String targetType,
                     LocalDateTime startDate, LocalDateTime endDate, int limit);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find audit logs by user ID within organization (SECURITY: tenant isolation)
     */
    List<T> findByUserIdAndOrganizationId(Long userId, Long organizationId);

    /**
     * Find recent audit logs for an organization (SECURITY: tenant isolation)
     */
    List<T> findRecentLogsByOrganizationId(Long organizationId, int limit);

    /**
     * Search audit logs within an organization (SECURITY: tenant isolation)
     */
    List<T> searchLogsByOrganizationId(Long organizationId, Long userId, String action, String targetType,
                                       LocalDateTime startDate, LocalDateTime endDate, int limit);

    /**
     * SECURITY: Find all audit logs for an organization (tenant isolation)
     */
    List<T> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find audit log by ID and organization (tenant isolation)
     */
    java.util.Optional<T> findByIdAndOrganizationId(Long id, Long organizationId);
} 