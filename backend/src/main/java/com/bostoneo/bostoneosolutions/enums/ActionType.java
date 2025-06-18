package com.***REMOVED***.***REMOVED***solutions.enums;

/**
 * Represents the different action types that can be performed on resources
 * Used for defining permissions in the RBAC system
 */
public enum ActionType {
    // Basic CRUD Operations
    VIEW,
    CREATE,
    EDIT,
    DELETE,
    
    // Context-Specific Actions
    VIEW_OWN,      // View only own records
    EDIT_OWN,      // Edit only own records
    VIEW_TEAM,     // View team records
    VIEW_ALL,      // View all records
    
    // Administrative Actions
    ASSIGN,        // Assign resources to others
    APPROVE,       // Approve submissions
    MANAGE,        // Manage settings and configurations
    ADMIN,         // Full administrative access
    
    // Legacy Actions (for backward compatibility)
    READ,
    UPDATE,
    DEACTIVATE
} 