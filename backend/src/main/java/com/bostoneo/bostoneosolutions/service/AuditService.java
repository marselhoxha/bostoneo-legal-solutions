package com.***REMOVED***.***REMOVED***solutions.service;

/**
 * Service for auditing permission and role changes
 */
public interface AuditService {
    /**
     * Log a permission or role change
     * @param userId The user affected by the change (can be null for system-wide changes)
     * @param action The action taken (ASSIGNED, REMOVED, etc.)
     * @param targetType The type of target (ROLE, PERMISSION, CASE_ROLE)
     * @param targetId The ID of the target
     * @param details Additional details about the change
     */
    void logPermissionChange(Long userId, String action, String targetType, Long targetId, String details);
} 