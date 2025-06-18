package com.***REMOVED***.***REMOVED***solutions.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Audit log for tracking permission changes in the system
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionAuditLog {
    private Long id;
    private Long userId; // The user affected by the change (can be null)
    private String action; // ASSIGNED, REMOVED, etc.
    private String targetType; // ROLE, PERMISSION, CASE_ROLE
    private Long targetId; // ID of the target
    private String details; // Additional details
    private Long performedBy; // The user who performed the action
    private LocalDateTime timestamp; // When the action was performed
} 