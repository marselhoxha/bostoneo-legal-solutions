package com.***REMOVED***.***REMOVED***solutions.security;

import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.repository.CaseRoleAssignmentRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.RoleRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.util.Set;

/**
 * Custom permission evaluator for Spring Security to work with our RBAC system
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CustomPermissionEvaluator implements PermissionEvaluator {

    private final RoleRepository<Role> roleRepository;
    private final UserRepository<User> userRepository;
    private final CaseRoleAssignmentRepository<?> caseRoleRepository;
    
    // Updated role constants to match database values
    private static final String ADMIN_ROLE = "ROLE_ADMIN";
    private static final String SYSADMIN_ROLE = "ROLE_SYSADMIN";
    private static final String MANAGER_ROLE = "ROLE_MANAGER";

    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject, Object permission) {
        if ((authentication == null) || (targetDomainObject == null) || !(permission instanceof String)) {
            return false;
        }
        
        Long userId = getUserIdFromAuthentication(authentication);
        if (userId == null) {
            return false;
        }
        
        // Check if user has administrator role (always grant access)
        if (hasAdministratorRole(userId)) {
            log.debug("Granting access to admin user for permission: {}", permission);
            return true;
        }
        
        // Get specific resource type and action from the permission string
        String permissionString = (String) permission;
        String[] parts = permissionString.split(":");
        if (parts.length != 2) {
            return false;
        }
        
        String resourceType = parts[0];
        String actionType = parts[1];
        
        // Check if user has direct permission
        if (hasPermission(userId, resourceType, actionType)) {
            return true;
        }
        
        // Check role hierarchy - SysAdmins and Managers can override in most cases
        if ((hasSysAdminRole(userId) || hasManagerRole(userId)) && !"ADMIN".equals(actionType)) {
            return true;
        }
        
        return false;
    }

    @Override
    public boolean hasPermission(Authentication authentication, Serializable targetId, String targetType, Object permission) {
        if ((authentication == null) || (targetId == null) || (targetType == null) || !(permission instanceof String)) {
            return false;
        }
        
        Long userId = getUserIdFromAuthentication(authentication);
        if (userId == null) {
            return false;
        }
        
        // Check if user has administrator role (always grant access)
        if (hasAdministratorRole(userId)) {
            log.debug("Granting access to admin user for permission: {} on {}: {}", permission, targetType, targetId);
            return true;
        }
        
        // Check if it's a case-specific permission
        if ("CASE".equals(targetType)) {
            Long caseId = Long.valueOf(targetId.toString());
            return hasCasePermission(userId, caseId, (String) permission);
        }
        
        // Get specific resource type and action from the permission string
        String permissionString = (String) permission;
        String[] parts = permissionString.split(":");
        if (parts.length != 2) {
            return false;
        }
        
        String resourceType = parts[0];
        String actionType = parts[1];
        
        // Check if user has the permission
        if (hasPermission(userId, resourceType, actionType)) {
            return true;
        }
        
        // Check role hierarchy for certain user types
        if ((hasSysAdminRole(userId) || hasManagerRole(userId)) && !"ADMIN".equals(actionType)) {
            return true;
        }
        
        return false;
    }
    
    private Long getUserIdFromAuthentication(Authentication authentication) {
        try {
            Object principal = authentication.getPrincipal();
            if (principal instanceof org.springframework.security.core.userdetails.User) {
                org.springframework.security.core.userdetails.User userDetails = 
                    (org.springframework.security.core.userdetails.User) principal;
                User user = userRepository.getUserByEmail(userDetails.getUsername());
                return user.getId();
            }
            return null;
        } catch (Exception e) {
            log.error("Error getting user ID from authentication", e);
            return null;
        }
    }
    
    private boolean hasPermission(Long userId, String resourceType, String actionType) {
        try {
            // Get user's permissions
            Set<String> permissions = roleRepository.getUserPermissions(userId);
            
            // Check for specific permission
            String permissionToCheck = resourceType + ":" + actionType;
            
            // Check for admin permission for this resource
            String adminPermission = resourceType + ":ADMIN";
            
            return permissions.contains(permissionToCheck) || permissions.contains(adminPermission);
        } catch (Exception e) {
            log.error("Error checking permission", e);
            return false;
        }
    }
    
    private boolean hasCasePermission(Long userId, Long caseId, String permission) {
        try {
            // Check if user has global permission
            if (hasPermission(userId, "CASE", permission.split(":")[1])) {
                return true;
            }
            
            // Check if user has role on this specific case
            return caseRoleRepository.userHasCaseAccess(userId, caseId);
        } catch (Exception e) {
            log.error("Error checking case permission", e);
            return false;
        }
    }
    
    private boolean hasAdministratorRole(Long userId) {
        Set<Role> roles = roleRepository.getRolesByUserId(userId);
        return roles.stream().anyMatch(role -> ADMIN_ROLE.equals(role.getName()));
    }
    
    private boolean hasSysAdminRole(Long userId) {
        Set<Role> roles = roleRepository.getRolesByUserId(userId);
        return roles.stream().anyMatch(role -> SYSADMIN_ROLE.equals(role.getName()));
    }
    
    private boolean hasManagerRole(Long userId) {
        Set<Role> roles = roleRepository.getRolesByUserId(userId);
        return roles.stream().anyMatch(role -> MANAGER_ROLE.equals(role.getName()));
    }
} 