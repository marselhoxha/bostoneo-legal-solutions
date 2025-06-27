package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.service.implementation.RoleServiceImpl;
import com.***REMOVED***.***REMOVED***solutions.service.EnhancedRbacService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.ArrayList;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Collection;
import java.util.HashMap;
import java.util.Set;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.OK;

/**
 * RBAC REST Controller
 * Provides endpoints for role and permission management
 */
@RestController
@RequestMapping("/api/rbac")
@RequiredArgsConstructor
@Slf4j
// @CrossOrigin removed - using global CORS config
public class RbacController {

    private final RoleServiceImpl roleService;
    private final EnhancedRbacService rbacService;

    /**
     * Get all roles
     */
    @GetMapping("/roles")
    public ResponseEntity<List<Role>> getAllRoles() {
        try {
            List<Role> roles = new ArrayList<>(roleService.getRoles());
            
            // Load permissions and user count for each role
            for (Role role : roles) {
                // Load permissions
                Set<Permission> permissions = roleService.getPermissionsByRoleId(role.getId());
                role.setPermissions(permissions);
                
                // Load user count
                List<com.***REMOVED***.***REMOVED***solutions.model.User> users = roleService.getUsersByRoleId(role.getId());
                role.setUserCount(users.size());
            }
            
            log.info("Retrieved {} roles with permissions and user counts", roles.size());
            return ResponseEntity.ok(roles);
        } catch (Exception e) {
            log.error("Error retrieving roles: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get all permissions
     */
    @GetMapping("/permissions")
    public ResponseEntity<List<Permission>> getAllPermissions() {
        try {
            List<Permission> permissions = roleService.getAllPermissions();
            log.info("Retrieved {} permissions", permissions.size());
            return ResponseEntity.ok(permissions);
        } catch (Exception e) {
            log.error("Error retrieving permissions: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get user permissions and roles
     */
    @GetMapping("/user/{userId}/permissions")
    public ResponseEntity<Map<String, Object>> getUserPermissions(@PathVariable Long userId) {
        try {
            // Use enhanced RBAC service now that database fields have been added
            Map<String, Object> userPermissions = rbacService.getUserPermissions(userId);
            log.info("Retrieved enhanced permissions for user {}", userId);
            return ResponseEntity.ok(userPermissions);
        } catch (Exception e) {
            log.error("Enhanced RBAC failed for user {}: {}", userId, e.getMessage(), e);
            
            // Fallback to basic role service if enhanced RBAC fails
            try {
                Map<String, Object> fallbackPermissions = new HashMap<>();
                Collection<Role> userRoles = roleService.getRolesByUserId(userId);
                List<Permission> allPermissions = new ArrayList<>();
                
                for (Role role : userRoles) {
                    Collection<Permission> rolePermissions = roleService.getPermissionsByRoleId(role.getId());
                    allPermissions.addAll(rolePermissions);
                }
                
                fallbackPermissions.put("userId", userId);
                fallbackPermissions.put("roles", userRoles);
                fallbackPermissions.put("effectivePermissions", allPermissions);
                fallbackPermissions.put("hierarchyLevel", 1);
                fallbackPermissions.put("hasFinancialAccess", false);
                fallbackPermissions.put("hasAdministrativeAccess", false);
                
                log.info("Using fallback permissions for user {} - {} roles, {} permissions", 
                    userId, userRoles.size(), allPermissions.size());
                return ResponseEntity.ok(fallbackPermissions);
            } catch (Exception fallbackError) {
                log.error("Both enhanced and fallback RBAC failed for user {}", userId);
                return ResponseEntity.internalServerError().build();
            }
        }
    }

    /**
     * Get role by ID
     */
    @GetMapping("/roles/{roleId}")
    public ResponseEntity<Role> getRoleById(@PathVariable Long roleId) {
        try {
            Role role = roleService.getRoleById(roleId);
            
            // Load permissions for this role
            Set<Permission> permissions = roleService.getPermissionsByRoleId(roleId);
            role.setPermissions(permissions);
            
            // Load user count
            List<com.***REMOVED***.***REMOVED***solutions.model.User> users = roleService.getUsersByRoleId(roleId);
            role.setUserCount(users.size());
            
            return ResponseEntity.ok(role);
        } catch (Exception e) {
            log.error("Error retrieving role {}: {}", roleId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Create new role
     */
    @PostMapping("/roles")
    public ResponseEntity<Role> createRole(@RequestBody Role role) {
        try {
            Role createdRole = roleService.createRole(role);
            log.info("Created new role: {}", createdRole.getName());
            return ResponseEntity.ok(createdRole);
        } catch (Exception e) {
            log.error("Error creating role: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Update role
     */
    @PutMapping("/roles/{roleId}")
    public ResponseEntity<Role> updateRole(@PathVariable Long roleId, @RequestBody Role role) {
        try {
            role.setId(roleId);
            Role updatedRole = roleService.updateRole(role);
            log.info("Updated role: {}", updatedRole.getName());
            return ResponseEntity.ok(updatedRole);
        } catch (Exception e) {
            log.error("Error updating role {}: {}", roleId, e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Delete role
     */
    @DeleteMapping("/roles/{roleId}")
    public ResponseEntity<Boolean> deleteRole(@PathVariable Long roleId) {
        try {
            roleService.deleteRole(roleId);
            log.info("Deleted role {}", roleId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error deleting role {}: {}", roleId, e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Assign permissions to role
     */
    @PostMapping("/roles/{roleId}/permissions")
    public ResponseEntity<Boolean> assignPermissionsToRole(
            @PathVariable Long roleId, 
            @RequestBody Map<String, List<Long>> request) {
        try {
            List<Long> permissionIds = request.get("permissionIds");
            roleService.assignPermissionsToRole(roleId, permissionIds);
            log.info("Assigned {} permissions to role {}", permissionIds.size(), roleId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error assigning permissions to role {}: {}", roleId, e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Assign role to user
     */
    @PostMapping("/assign-role")
    public ResponseEntity<Boolean> assignRoleToUser(@RequestBody Map<String, Object> request) {
        try {
            Long userId = ((Number) request.get("userId")).longValue();
            Long roleId = ((Number) request.get("roleId")).longValue();
            
            roleService.assignRoleToUser(userId, roleId);
            log.info("Assigned role {} to user {}", roleId, userId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error assigning role to user: {}", e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Remove role from user
     */
    @DeleteMapping("/remove-role/{userId}/{roleId}")
    public ResponseEntity<Boolean> removeRoleFromUser(
            @PathVariable Long userId, 
            @PathVariable Long roleId) {
        try {
            roleService.removeRoleFromUser(userId, roleId);
            log.info("Removed role {} from user {}", roleId, userId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error removing role from user: {}", e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Check context permission
     */
    @PostMapping("/check-context-permission")
    public ResponseEntity<Boolean> checkContextPermission(@RequestBody Map<String, Object> request) {
        try {
            Long userId = ((Number) request.get("userId")).longValue();
            String resource = (String) request.get("resource");
            String action = (String) request.get("action");
            String contextType = (String) request.get("contextType");
            Long contextId = ((Number) request.get("contextId")).longValue();
            
            boolean hasPermission = rbacService.hasContextPermission(userId, resource, action, contextType, contextId);
            return ResponseEntity.ok(hasPermission);
        } catch (Exception e) {
            log.error("Error checking context permission: {}", e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Get user roles
     */
    @GetMapping("/users/{userId}/roles")
    public ResponseEntity<List<Map<String, Object>>> getUserRoles(@PathVariable Long userId) {
        try {
            List<Map<String, Object>> userRoles = rbacService.getUserRoles(userId);
            return ResponseEntity.ok(userRoles);
        } catch (Exception e) {
            log.error("Error retrieving user roles for user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get user case roles
     */
    @GetMapping("/users/{userId}/case-roles")
    public ResponseEntity<List<Map<String, Object>>> getUserCaseRoles(@PathVariable Long userId) {
        try {
            List<Map<String, Object>> caseRoles = rbacService.getUserCaseRoles(userId);
            return ResponseEntity.ok(caseRoles);
        } catch (Exception e) {
            log.error("Error retrieving case roles for user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Set primary role for user
     */
    @PostMapping("/set-primary-role")
    public ResponseEntity<Boolean> setPrimaryRole(@RequestBody Map<String, Object> request) {
        try {
            Long userId = ((Number) request.get("userId")).longValue();
            Long roleId = ((Number) request.get("roleId")).longValue();
            
            roleService.setPrimaryRole(userId, roleId);
            log.info("Set primary role {} for user {}", roleId, userId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error setting primary role: {}", e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Assign case role to user
     */
    @PostMapping("/assign-case-role")
    public ResponseEntity<Boolean> assignCaseRole(@RequestBody Map<String, Object> request) {
        try {
            Long caseId = ((Number) request.get("caseId")).longValue();
            Long userId = ((Number) request.get("userId")).longValue();
            Long roleId = ((Number) request.get("roleId")).longValue();
            
            // Handle optional expiration date
            java.time.LocalDateTime expiresAt = null;
            if (request.get("expiresAt") != null) {
                String expiresAtStr = (String) request.get("expiresAt");
                expiresAt = java.time.LocalDateTime.parse(expiresAtStr);
            }
            
            roleService.assignCaseRole(caseId, userId, roleId, expiresAt);
            log.info("Assigned case role {} to user {} for case {}", roleId, userId, caseId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error assigning case role: {}", e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }

    /**
     * Remove case role assignment
     */
    @DeleteMapping("/case-roles/{assignmentId}")
    public ResponseEntity<Boolean> removeCaseRole(@PathVariable Long assignmentId) {
        try {
            roleService.removeCaseRole(assignmentId);
            log.info("Removed case role assignment {}", assignmentId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            log.error("Error removing case role assignment: {}", e.getMessage());
            return ResponseEntity.badRequest().body(false);
        }
    }
} 