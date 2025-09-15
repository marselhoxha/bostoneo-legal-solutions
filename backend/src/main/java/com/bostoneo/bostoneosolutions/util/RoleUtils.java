package com.bostoneo.bostoneosolutions.util;

import java.util.Collection;
import java.util.Set;

/**
 * Utility class for role-based authorization checks
 */
public class RoleUtils {
    
    // Comprehensive admin roles including all leadership positions
    public static final Set<String> ADMIN_ROLES = Set.of(
        "ROLE_ADMIN", 
        "ROLE_ATTORNEY", 
        "ROLE_MANAGING_PARTNER", 
        "ROLE_SENIOR_PARTNER", 
        "ROLE_EQUITY_PARTNER", 
        "ROLE_OF_COUNSEL",
        "ROLE_SYSADMIN",
        "MANAGING_PARTNER", 
        "SENIOR_PARTNER", 
        "EQUITY_PARTNER", 
        "OF_COUNSEL",
        "ADMINISTRATOR"
    );
    
    // Management roles with elevated permissions but not full admin
    public static final Set<String> MANAGEMENT_ROLES = Set.of(
        "ROLE_MANAGER",
        "ROLE_PARALEGAL_SUPERVISOR",
        "ROLE_DEPARTMENT_HEAD",
        "MANAGER",
        "PARALEGAL_SUPERVISOR",
        "DEPARTMENT_HEAD"
    );
    
    // Attorney-level roles with case management permissions
    public static final Set<String> ATTORNEY_ROLES = Set.of(
        "ROLE_ATTORNEY",
        "ROLE_MANAGING_PARTNER",
        "ROLE_SENIOR_PARTNER", 
        "ROLE_EQUITY_PARTNER",
        "ROLE_OF_COUNSEL",
        "MANAGING_PARTNER",
        "SENIOR_PARTNER",
        "EQUITY_PARTNER", 
        "OF_COUNSEL",
        "ATTORNEY"
    );
    
    // Support staff roles
    public static final Set<String> SUPPORT_ROLES = Set.of(
        "ROLE_PARALEGAL",
        "ROLE_SECRETARY", 
        "ROLE_LEGAL_ASSISTANT",
        "PARALEGAL",
        "SECRETARY",
        "LEGAL_ASSISTANT"
    );
    
    // Client roles
    public static final Set<String> CLIENT_ROLES = Set.of(
        "ROLE_CLIENT",
        "CLIENT"
    );
    
    /**
     * Check if user has any admin role
     */
    public static boolean isAdmin(String userRole) {
        return userRole != null && ADMIN_ROLES.contains(userRole);
    }
    
    /**
     * Check if user has any admin role from collection
     */
    public static boolean isAdmin(Collection<String> userRoles) {
        return userRoles != null && userRoles.stream().anyMatch(ADMIN_ROLES::contains);
    }
    
    /**
     * Check if user has admin or management role
     */
    public static boolean isAdminOrManager(String userRole, Collection<String> userRoles) {
        return isAdmin(userRole) || isAdmin(userRoles) || 
               (userRole != null && MANAGEMENT_ROLES.contains(userRole)) ||
               (userRoles != null && userRoles.stream().anyMatch(MANAGEMENT_ROLES::contains));
    }
    
    /**
     * Check if user has attorney-level permissions
     */
    public static boolean isAttorneyLevel(String userRole, Collection<String> userRoles) {
        return (userRole != null && ATTORNEY_ROLES.contains(userRole)) ||
               (userRoles != null && userRoles.stream().anyMatch(ATTORNEY_ROLES::contains));
    }
    
    /**
     * Check if user is client
     */
    public static boolean isClient(String userRole, Collection<String> userRoles) {
        return (userRole != null && CLIENT_ROLES.contains(userRole)) ||
               (userRoles != null && userRoles.stream().anyMatch(CLIENT_ROLES::contains));
    }
    
    /**
     * Check if user can view all cases (management level access)
     */
    public static boolean canViewAllCases(Collection<String> userRoles) {
        return isAdmin(userRoles) || isAdminOrManager(null, userRoles) || 
               (userRoles != null && (userRoles.contains("OF_COUNSEL") || 
                                     userRoles.contains("SENIOR_ASSOCIATE") ||
                                     userRoles.contains("ROLE_OF_COUNSEL") ||
                                     userRoles.contains("ROLE_SENIOR_ASSOCIATE")));
    }
    
    /**
     * Check if user can manage cases (legal practice access)
     */
    public static boolean canManageCases(Collection<String> userRoles) {
        return isAttorneyLevel(null, userRoles) && !userRoles.contains("SECRETARY");
    }
    
    /**
     * Check if user has management level access
     */
    public static boolean hasManagementAccess(Collection<String> userRoles) {
        return isAdmin(userRoles) || 
               (userRoles != null && userRoles.stream().anyMatch(MANAGEMENT_ROLES::contains));
    }
    
    /**
     * Check if user can manage billing and financial data
     */
    public static boolean canManageBilling(Collection<String> userRoles) {
        return isAdmin(userRoles) || hasManagementAccess(userRoles) ||
               (userRoles != null && (userRoles.contains("CFO") || 
                                     userRoles.contains("FINANCE_MANAGER")));
    }
} 