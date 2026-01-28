package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.CaseRoleAssignmentDTO;
import com.bostoneo.bostoneosolutions.dto.PermissionDTO;
import com.bostoneo.bostoneosolutions.dto.RoleDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.UserRoleDTO;
import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.service.AuditService;
import com.bostoneo.bostoneosolutions.service.RoleService;
import com.bostoneo.bostoneosolutions.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

/**
 * REST controller for managing roles and permissions
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RoleResource {
    
    private final RoleService roleService;
    private final UserService userService;
    private final AuditService auditService;
    
    /**
     * Get all roles with complete information
     */
    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getRoles() {
        Collection<Role> roles = roleService.getRoles();
        
        // Convert to DTOs with complete information
        List<RoleDTO> roleDTOs = roles.stream().map(role -> {
            RoleDTO roleDTO = convertToRoleDTO(role);
            
            // Get permissions for this role
            Set<Permission> permissions = roleService.getPermissionsByRoleId(role.getId());
            roleDTO.setPermissions(convertToPermissionDTOs(permissions));
            
            // Get user count for this role
            List<User> users = roleService.getUsersByRoleId(role.getId());
            roleDTO.setUserCount(users.size());
            
            return roleDTO;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("roles", roleDTOs))
                .message("Roles retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get role by ID
     */
    @GetMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getRoleById(@PathVariable("id") Long id) {
        Role role = roleService.getRoleById(id);
        Set<Permission> permissions = roleService.getPermissionsByRoleId(id);
        
        RoleDTO roleDTO = convertToRoleDTO(role);
        roleDTO.setPermissions(convertToPermissionDTOs(permissions));
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("role", roleDTO))
                .message("Role retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Create new role
     */
    @PostMapping("/roles")
    @AuditLog(action = "CREATE", entityType = "ROLE", description = "Created new role")
    @PreAuthorize("hasAuthority('ROLE:ADMIN')")
    public ResponseEntity<HttpResponse> createRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @RequestBody RoleDTO roleDTO) {
        
        Role role = Role.builder()
            .name(roleDTO.getName())
            .description(roleDTO.getDescription())
            .hierarchyLevel(roleDTO.getHierarchyLevel())
            .isSystemRole(false) // System roles can only be created by system
            .build();
        
        Role createdRole = roleService.createRole(role);
        
        // Assign permissions if provided
        if (roleDTO.getPermissions() != null && !roleDTO.getPermissions().isEmpty()) {
            List<Long> permissionIds = roleDTO.getPermissions().stream()
                .map(PermissionDTO::getId)
                .collect(Collectors.toList());
            
            roleService.assignPermissionsToRole(createdRole.getId(), permissionIds);
        }
        
        // Audit the action
        auditService.logPermissionChange(
            null,
            "CREATED",
            "ROLE",
            createdRole.getId(),
            "Role created"
        );
        
        return ResponseEntity.status(CREATED).body(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("role", convertToRoleDTO(createdRole)))
                .message("Role created successfully")
                .status(CREATED)
                .statusCode(CREATED.value())
                .build()
        );
    }
    
    /**
     * Update existing role
     */
    @PutMapping("/roles/{id}")
    @AuditLog(action = "UPDATE", entityType = "ROLE", description = "Updated role information")
    @PreAuthorize("hasAuthority('ROLE:ADMIN')")
    public ResponseEntity<HttpResponse> updateRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("id") Long id,
            @RequestBody RoleDTO roleDTO) {
        
        Role existingRole = roleService.getRoleById(id);
        
        // Don't allow updating system roles for security reasons
        if (existingRole.isSystemRole()) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("System roles cannot be modified")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
        
        existingRole.setName(roleDTO.getName());
        existingRole.setDescription(roleDTO.getDescription());
        existingRole.setHierarchyLevel(roleDTO.getHierarchyLevel());
        
        Role updatedRole = roleService.updateRole(existingRole);
        
        // Audit the action
        auditService.logPermissionChange(
            null,
            "UPDATED",
            "ROLE",
            updatedRole.getId(),
            "Role updated"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("role", convertToRoleDTO(updatedRole)))
                .message("Role updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Delete role
     */
    @DeleteMapping("/roles/{id}")
    @AuditLog(action = "DELETE", entityType = "ROLE", description = "Deleted role")
    @PreAuthorize("hasAuthority('ROLE:ADMIN')")
    public ResponseEntity<HttpResponse> deleteRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("id") Long id) {
        
        Role role = roleService.getRoleById(id);
        
        // Don't allow deleting system roles for security reasons
        if (role.isSystemRole()) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("System roles cannot be deleted")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
        
        roleService.deleteRole(id);
        
        // Audit the action
        auditService.logPermissionChange(
            null,
            "DELETED",
            "ROLE",
            id,
            "Role deleted"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Role deleted successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get all permissions
     */
    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('ROLE:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getPermissions() {
        List<Permission> permissions = roleService.getAllPermissions();
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("permissions", convertToPermissionDTOs(permissions)))
                .message("Permissions retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Assign permissions to role
     */
    @PostMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasAuthority('ROLE:ADMIN')")
    public ResponseEntity<HttpResponse> assignPermissionsToRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("roleId") Long roleId,
            @RequestBody List<Long> permissionIds) {
        
        roleService.assignPermissionsToRole(roleId, permissionIds);
        
        // Audit the action
        auditService.logPermissionChange(
            null,
            "ASSIGNED",
            "PERMISSION",
            roleId,
            "Permissions assigned to role"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Permissions assigned to role successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Remove permission from role
     */
    @DeleteMapping("/roles/{roleId}/permissions/{permissionId}")
    @AuditLog(action = "REVOKE", entityType = "PERMISSION", description = "Removed permission from role")
    @PreAuthorize("hasAuthority('ROLE:ADMIN')")
    public ResponseEntity<HttpResponse> removePermissionFromRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("roleId") Long roleId,
            @PathVariable("permissionId") Long permissionId) {
        
        roleService.removePermissionFromRole(roleId, permissionId);
        
        // Audit the action
        auditService.logPermissionChange(
            null,
            "REMOVED",
            "PERMISSION",
            roleId,
            "Permission removed from role"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Permission removed from role successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get all users
     */
    @GetMapping("/users")
    @PreAuthorize("hasAuthority('USER:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getAllUsers() {
        // Get users via the repository
        Collection<User> users = userService.getUsers(0, 1000);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("users", users))
                .message("Users retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get users assigned to role
     */
    @GetMapping("/roles/{roleId}/users")
    @PreAuthorize("hasAuthority('ROLE:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getUsersByRoleId(@PathVariable("roleId") Long roleId) {
        List<User> users = roleService.getUsersByRoleId(roleId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("users", users))
                .message("Users retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get roles assigned to user
     */
    @GetMapping("/users/{userId}/roles")
    @PreAuthorize("hasAuthority('ROLE:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getRolesByUserId(@PathVariable("userId") Long userId) {
        Set<Role> roles = roleService.getRolesByUserId(userId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("roles", roles))
                .message("User roles retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Assign role to user
     */
    @PostMapping("/users/{userId}/roles")
    @AuditLog(action = "ASSIGN", entityType = "ROLE", description = "Assigned role to user")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    public ResponseEntity<HttpResponse> assignRolesToUser(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("userId") Long userId,
            @RequestBody UserRoleDTO userRoleDTO) {
        
        userRoleDTO.setUserId(userId); // Ensure userId is set correctly
        
        roleService.assignRoleToUser(userId, userRoleDTO.getRoleId());
        
        // If this is the primary role, update the user's primary role
        if (userRoleDTO.isPrimary()) {
            roleService.setPrimaryRole(userId, userRoleDTO.getRoleId());
        }
        
        // If role has expiration, set it
        if (userRoleDTO.getExpiresAt() != null) {
            roleService.setRoleExpiration(userId, userRoleDTO.getRoleId(), userRoleDTO.getExpiresAt());
        }
        
        // Audit the action
        auditService.logPermissionChange(
            userId,
            "ASSIGNED",
            "ROLE",
            userRoleDTO.getRoleId(),
            "Role assigned to user"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Role assigned to user successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Remove role from user
     */
    @DeleteMapping("/users/{userId}/roles/{roleId}")
    @AuditLog(action = "REVOKE", entityType = "ROLE", description = "Removed role from user")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    public ResponseEntity<HttpResponse> removeRoleFromUser(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("userId") Long userId,
            @PathVariable("roleId") Long roleId) {
        
        roleService.removeRoleFromUser(userId, roleId);
        
        // Audit the action
        auditService.logPermissionChange(
            userId,
            "REMOVED",
            "ROLE",
            roleId,
            "Role removed from user"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Role removed from user successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Assign case-specific role
     */
    @PostMapping("/cases/{caseId}/roles")
    @AuditLog(action = "ASSIGN", entityType = "CASE_ROLE", description = "Assigned case-specific role")
    @PreAuthorize("hasAuthority('CASE:ASSIGN')")
    public ResponseEntity<HttpResponse> assignCaseRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("caseId") Long caseId,
            @RequestBody CaseRoleAssignmentDTO caseRoleDTO) {
        
        caseRoleDTO.setCaseId(caseId); // Ensure caseId is set correctly
        
        CaseRoleAssignment assignment = roleService.assignCaseRole(
            caseId,
            caseRoleDTO.getUserId(),
            caseRoleDTO.getRoleId(),
            caseRoleDTO.getExpiresAt()
        );
        
        // Audit the action
        auditService.logPermissionChange(
            caseRoleDTO.getUserId(),
            "ASSIGNED",
            "CASE_ROLE",
            caseId,
            "Case-specific role assigned"
        );
        
        return ResponseEntity.status(CREATED).body(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("assignment", assignment))
                .message("Case role assigned successfully")
                .status(CREATED)
                .statusCode(CREATED.value())
                .build()
        );
    }
    
    /**
     * Remove case-specific role
     */
    @DeleteMapping("/cases/roles/{assignmentId}")
    @AuditLog(action = "REVOKE", entityType = "CASE_ROLE", description = "Removed case-specific role")
    @PreAuthorize("hasAuthority('CASE:ADMIN')")
    public ResponseEntity<HttpResponse> removeCaseRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("assignmentId") Long assignmentId) {
        
        roleService.removeCaseRole(assignmentId);
        
        // Audit the action
        auditService.logPermissionChange(
            null,
            "REMOVED",
            "CASE_ROLE",
            assignmentId,
            "Case role assignment removed"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Case role assignment removed successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get case-specific roles by case ID
     */
    @GetMapping("/cases/{caseId}/roles")
    @PreAuthorize("hasAuthority('CASE:VIEW')")
    public ResponseEntity<HttpResponse> getCaseRolesByCaseId(@PathVariable("caseId") Long caseId) {
        Set<CaseRoleAssignment> assignments = roleService.getCaseRoleAssignmentsByCase(caseId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("assignments", assignments))
                .message("Case roles retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Get case roles assigned to user
     */
    @GetMapping("/users/{userId}/case-roles")
    @PreAuthorize("hasAuthority('ROLE:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> getCaseRolesByUserId(@PathVariable("userId") Long userId) {
        Set<CaseRoleAssignment> caseRoles = roleService.getCaseRoleAssignments(userId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("caseRoles", caseRoles))
                .message("User case roles retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    /**
     * Set a role as primary for a user
     */
    @PutMapping("/users/{userId}/roles/{roleId}/primary")
    @AuditLog(action = "UPDATE", entityType = "ROLE", description = "Set role as primary for user")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> setPrimaryRole(
            @AuthenticationPrincipal UserDTO currentUser,
            @PathVariable("userId") Long userId,
            @PathVariable("roleId") Long roleId) {
        
        roleService.setPrimaryRole(userId, roleId);
        
        // Audit the action
        auditService.logPermissionChange(
            userId,
            "UPDATED",
            "ROLE",
            roleId,
            "Set as primary role"
        );
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Primary role set successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
    
    // Helper methods
    private RoleDTO convertToRoleDTO(Role role) {
        return RoleDTO.builder()
            .id(role.getId())
            .name(role.getName())
            .description(role.getDescription())
            .hierarchyLevel(role.getHierarchyLevel())
            .systemRole(role.isSystemRole())
            .build();
    }
    
    private Set<PermissionDTO> convertToPermissionDTOs(Collection<Permission> permissions) {
        return permissions.stream()
            .map(permission -> {
                return PermissionDTO.builder()
                    .id(permission.getId())
                    .name(permission.getName())
                    .description(permission.getDescription())
                    .resourceType(permission.getResourceType().toString())
                    .actionType(permission.getActionType().toString())
                    .build();
            })
            .collect(Collectors.toSet());
    }
} 