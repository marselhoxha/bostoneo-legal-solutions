package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.service.implementation.RoleServiceImpl;
import com.***REMOVED***.***REMOVED***solutions.service.implementation.EnhancedRbacService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
@CrossOrigin(origins = "*")
public class RbacController {

    private final RoleServiceImpl roleService;
    private final EnhancedRbacService rbacService;

    /**
     * Get all roles
     */
    @GetMapping("/roles")
    public ResponseEntity<List<Role>> getAllRoles() {
        try {
            List<Role> roles = roleService.getRoles();
            log.info("Retrieved {} roles", roles.size());
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
            List<Permission> permissions = roleService.getPermissions();
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
            Map<String, Object> userPermissions = rbacService.getUserPermissions(userId);
            log.info("Retrieved permissions for user {}", userId);
            return ResponseEntity.ok(userPermissions);
        } catch (Exception e) {
            log.error("Error retrieving user permissions for user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get role by ID
     */
    @GetMapping("/roles/{roleId}")
    public ResponseEntity<Role> getRoleById(@PathVariable Long roleId) {
        try {
            Role role = roleService.getRoleById(roleId);
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
            roleService.addPermissionsToRole(roleId, permissionIds);
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
            
            roleService.addRoleToUser(userId, roleId);
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
} 
 
 