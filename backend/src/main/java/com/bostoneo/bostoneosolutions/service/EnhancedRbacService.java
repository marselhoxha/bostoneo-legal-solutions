package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;
import com.bostoneo.bostoneosolutions.enums.PermissionCategory;
import com.bostoneo.bostoneosolutions.enums.RoleCategory;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.RoleRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Enhanced RBAC Service for comprehensive permission management
 * Supports hierarchical roles, context-aware permissions, and team assignments
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class EnhancedRbacService {

    private final RoleRepository<Role> roleRepository;
    private final UserRepository<User> userRepository;
    private final RoleService roleService;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID
     */
    private Long getCurrentOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    /**
     * Verify user belongs to the current organization
     */
    private boolean isUserInCurrentOrganization(User user) {
        Long currentOrgId = getCurrentOrganizationId();
        if (currentOrgId == null) {
            return true; // No org context, allow (backward compatibility)
        }
        return currentOrgId.equals(user.getOrganizationId());
    }

    /**
     * Check if user has a specific permission
     */
    public boolean hasPermission(Long userId, String resource, String action) {
        User user = getUserWithRoles(userId);
        if (user == null) return false;

        String permissionName = resource + ":" + action;
        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(permission -> permissionName.equals(permission.getName()));
    }

    /**
     * Check if user has permission with context (case, project, etc.)
     */
    public boolean hasContextPermission(Long userId, String resource, String action, 
                                      String contextType, Long contextId) {
        // First check basic permission
        if (hasPermission(userId, resource, action)) {
            return true;
        }

        // Then check context-specific permissions
        return hasContextSpecificPermission(userId, resource, action, contextType, contextId);
    }

    /**
     * Check if user has role with minimum hierarchy level
     */
    public boolean hasRoleLevel(Long userId, int minimumLevel) {
        User user = getUserWithRoles(userId);
        if (user == null) return false;

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .anyMatch(role -> role.getHierarchyLevel() != null && 
                                role.getHierarchyLevel() >= minimumLevel);
    }

    /**
     * Check if user has specific role
     */
    public boolean hasRole(Long userId, String roleName) {
        User user = getUserWithRoles(userId);
        if (user == null) return false;

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .anyMatch(role -> roleName.equals(role.getName()));
    }

    /**
     * Check if user can access financial information
     */
    public boolean hasFinancialAccess(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) return false;

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .anyMatch(Role::hasFinancialAccess);
    }

    /**
     * Check if user has administrative privileges
     */
    public boolean hasAdministrativeAccess(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) return false;

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .anyMatch(Role::isAdministrative);
    }

    /**
     * Get user's highest hierarchy level
     */
    public int getUserHierarchyLevel(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) return 0;

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .mapToInt(role -> role.getHierarchyLevel() != null ? role.getHierarchyLevel() : 0)
                .max()
                .orElse(0);
    }

    /**
     * Get user's effective permissions (all permissions from all roles)
     */
    public Set<Permission> getEffectivePermissions(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) return Collections.emptySet();

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream())
                .collect(Collectors.toSet());
    }

    /**
     * Get user's effective permissions for specific context
     */
    public Set<Permission> getEffectivePermissions(Long userId, String contextType, Long contextId) {
        Set<Permission> basePermissions = getEffectivePermissions(userId);
        Set<Permission> contextPermissions = getContextPermissions(userId, contextType, contextId);
        
        Set<Permission> combined = new HashSet<>(basePermissions);
        combined.addAll(contextPermissions);
        
        return combined;
    }

    /**
     * Check if user can edit a specific resource (ownership-based)
     */
    public boolean canEditResource(Long userId, String resourceType, Long resourceOwnerId) {
        // Users can always edit their own resources
        if (userId.equals(resourceOwnerId)) {
            return hasPermission(userId, resourceType, "EDIT_OWN");
        }

        // Check if user has team or admin edit permissions
        return hasPermission(userId, resourceType, "EDIT") ||
               hasPermission(userId, resourceType, "ADMIN");
    }

    /**
     * Check if user can approve resources
     */
    public boolean canApprove(Long userId, String resourceType) {
        return hasPermission(userId, resourceType, "APPROVE") ||
               hasAdministrativeAccess(userId);
    }

    /**
     * Get user's role in specific context (case, project, etc.)
     */
    public Optional<String> getContextualRole(Long userId, String contextType, Long contextId) {
        switch (contextType.toUpperCase()) {
            case "CASE":
                return getCaseRole(userId, contextId);
            case "PROJECT":
                return getProjectRole(userId, contextId);
            default:
                return Optional.empty();
        }
    }

    /**
     * Check if user can assign resources to others
     */
    public boolean canAssignResources(Long userId, String resourceType) {
        return hasPermission(userId, resourceType, "ASSIGN") ||
               hasAdministrativeAccess(userId);
    }

    /**
     * Get user permissions and roles for frontend
     */
    public Map<String, Object> getUserPermissions(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) {
            return Map.of("userId", userId, "roles", List.of(), "effectivePermissions", List.of());
        }

        Set<Permission> effectivePermissions = getEffectivePermissions(userId);
        
        Map<String, Object> result = new HashMap<>();
        result.put("userId", userId);
        result.put("roles", user.getRoles());
        result.put("effectivePermissions", effectivePermissions);
        result.put("hierarchyLevel", getUserHierarchyLevel(userId));
        result.put("hasFinancialAccess", hasFinancialAccess(userId));
        result.put("hasAdministrativeAccess", hasAdministrativeAccess(userId));
        
        return result;
    }

    /**
     * Get user roles for frontend
     */
    public List<Map<String, Object>> getUserRoles(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) return List.of();

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .map(role -> {
                    Map<String, Object> roleData = new HashMap<>();
                    roleData.put("id", role.getId());
                    roleData.put("name", role.getName());
                    roleData.put("displayName", role.getDisplayName());
                    roleData.put("hierarchyLevel", role.getHierarchyLevel());
                    roleData.put("isPrimary", false); // TODO: Implement primary role logic
                    return roleData;
                })
                .collect(Collectors.toList());
    }

    /**
     * Get user case roles for frontend
     */
    public List<Map<String, Object>> getUserCaseRoles(Long userId) {
        try {
            log.info("Getting case roles for user: {}", userId);
            Set<CaseRoleAssignment> caseRoleAssignments = roleService.getCaseRoleAssignments(userId);
            
            return caseRoleAssignments.stream()
                .filter(CaseRoleAssignment::isActive) // Only return active assignments
                .map(assignment -> {
                    Map<String, Object> caseRoleData = new HashMap<>();
                    caseRoleData.put("id", assignment.getId());
                    caseRoleData.put("caseId", assignment.getLegalCase().getId());
                    caseRoleData.put("userId", assignment.getUser().getId());
                    caseRoleData.put("roleId", assignment.getRole().getId());
                    caseRoleData.put("roleName", assignment.getRole().getName());
                    caseRoleData.put("roleDisplayName", assignment.getRole().getDisplayName());
                    
                    // Add case information if available
                    if (assignment.getLegalCase() != null) {
                        caseRoleData.put("caseName", assignment.getLegalCase().getTitle());
                        caseRoleData.put("caseNumber", assignment.getLegalCase().getCaseNumber());
                    }
                    
                    // Add expiration information
                    if (assignment.getExpiresAt() != null) {
                        caseRoleData.put("expiresAt", assignment.getExpiresAt());
                    }
                    
                    log.debug("Mapped case role assignment: {}", caseRoleData);
                    return caseRoleData;
                })
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error getting case roles for user {}: {}", userId, e.getMessage(), e);
            return List.of();
        }
    }

    /**
     * Get user's maximum billing rate based on roles
     */
    public Optional<Double> getMaxBillingRate(Long userId) {
        User user = getUserWithRoles(userId);
        if (user == null) return Optional.empty();

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .filter(role -> role.getMaxBillingRate() != null)
                .map(role -> role.getMaxBillingRate().doubleValue())
                .max(Double::compare);
    }

    // Private helper methods

    private User getUserWithRoles(Long userId) {
        try {
            User user = userRepository.findByIdWithRoles(userId);
            if (user != null && !isUserInCurrentOrganization(user)) {
                log.warn("User {} does not belong to current organization", userId);
                return null;
            }
            return user;
        } catch (Exception e) {
            log.error("Error fetching user with roles for userId: {}", userId, e);
            return null;
        }
    }

    private boolean hasContextSpecificPermission(Long userId, String resource, String action,
                                                String contextType, Long contextId) {
        // Implementation for context-specific permissions
        // This would query case_team_assignments, department_role_assignments, etc.
        // For now, return false - this would be implemented based on specific requirements
        return false;
    }

    private Set<Permission> getContextPermissions(Long userId, String contextType, Long contextId) {
        // Implementation for getting context-specific permissions
        // This would merge permissions from case teams, project assignments, etc.
        return Collections.emptySet();
    }

    private Optional<String> getCaseRole(Long userId, Long caseId) {
        // Implementation for getting user's role in a specific case
        // This would query case_team_assignments table
        return Optional.empty();
    }

    private Optional<String> getProjectRole(Long userId, Long projectId) {
        // Implementation for getting user's role in a specific project
        return Optional.empty();
    }
} 

