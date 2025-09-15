package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;

import java.util.List;

/**
 * Service for auditing permission changes in the RBAC system
 */
public interface PermissionAuditService {
    /**
     * Log a permission change
     *
     * @param userId User ID affected by the change
     * @param action Action performed (ASSIGNED, REVOKED, etc.)
     * @param targetType Type of target (USER, ROLE, PERMISSION)
     * @param targetId ID of the target
     * @param details Details about the change
     * @return The created audit log entry
     */
    PermissionAuditLog logPermissionChange(Long userId, String action, String targetType, 
                                          Long targetId, String details);
    
    /**
     * Get audit logs for a specific user
     * 
     * @param userId User ID
     * @return List of audit logs
     */
    List<PermissionAuditLog> getAuditLogsByUserId(Long userId);
    
    /**
     * Get the most recent audit logs
     * 
     * @param limit Maximum number of logs to retrieve
     * @return List of recent audit logs
     */
    List<PermissionAuditLog> getRecentAuditLogs(int limit);
    
    /**
     * Search audit logs by criteria
     * 
     * @param userId Optional user ID
     * @param action Optional action
     * @param targetType Optional target type
     * @param startDate Optional start date
     * @param endDate Optional end date
     * @param limit Maximum number of logs to retrieve
     * @return List of matching audit logs
     */
    List<PermissionAuditLog> searchAuditLogs(Long userId, String action, String targetType, 
                                           String startDate, String endDate, int limit);
} 