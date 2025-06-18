package com.***REMOVED***.***REMOVED***solutions.model;

import com.***REMOVED***.***REMOVED***solutions.enums.ActionType;
import com.***REMOVED***.***REMOVED***solutions.enums.ResourceType;
import com.***REMOVED***.***REMOVED***solutions.enums.PermissionCategory;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Enhanced Permission entity for the RBAC system
 * Supports categorized permissions with contextual awareness
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class Permission {

    private Long id;
    
    private String name;
    
    private ResourceType resourceType;
    
    private ActionType actionType;
    
    private String description;
    
    private Boolean isContextual;
    
    private PermissionCategory permissionCategory;
    
    private LocalDateTime createdAt;
    
    /**
     * Get the permission string in the format "RESOURCE:ACTION"
     * This is used for JWT claims and Spring Security authorization
     */
    public String getAuthority() {
        // Return the actual permission name from the database (e.g., "BILLING:EDIT")
        // rather than concatenating enum values
        return name;
    }
    
    /**
     * Check if this permission requires context (case, project, etc.)
     */
    public boolean requiresContext() {
        return Boolean.TRUE.equals(isContextual);
    }
    
    /**
     * Check if this permission is administrative level
     */
    public boolean isAdministrative() {
        return PermissionCategory.ADMINISTRATIVE.equals(permissionCategory) ||
               PermissionCategory.SYSTEM.equals(permissionCategory);
    }
    
    /**
     * Check if this permission involves financial data
     */
    public boolean isFinancial() {
        return PermissionCategory.FINANCIAL.equals(permissionCategory);
    }
    
    /**
     * Check if this permission involves confidential information
     */
    public boolean isConfidential() {
        return PermissionCategory.CONFIDENTIAL.equals(permissionCategory);
    }
} 