package com.bostoneo.bostoneosolutions.enums;

/**
 * Represents the different resource types in the system
 * Used for defining permissions in the RBAC system
 */
public enum ResourceType {
    // Core Legal Resources
    CASE,
    DOCUMENT,
    CLIENT,
    CALENDAR,
    
    // Business Operations
    TIME_TRACKING,
    BILLING,
    FINANCIAL,
    EXPENSE,
    
    // Team & Collaboration (NEW)
    TASK,
    PROJECT,
    TEAM,
    
    // Communication & Reporting (NEW)
    COMMUNICATION,
    REPORT,
    
    // System Administration
    USER,
    ROLE,
    PERMISSION,
    SYSTEM,
    ADMINISTRATIVE
}
