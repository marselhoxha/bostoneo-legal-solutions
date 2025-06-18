package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.PermissionAuditLog;

import java.util.List;

public interface PermissionAuditRepository<T extends PermissionAuditLog> {
    /**
     * Create a new audit log entry
     * @param log The audit log entry to create
     * @return The created audit log entry
     */
    T create(T log);
    
    /**
     * Get recent audit logs
     * @param limit Maximum number of logs to return
     * @return List of recent audit logs
     */
    List<T> getRecentLogs(int limit);
    
    /**
     * Get audit logs for a specific user
     * @param userId The user ID
     * @param limit Maximum number of logs to return
     * @return List of audit logs for the user
     */
    List<T> getLogsByUserId(Long userId, int limit);
} 