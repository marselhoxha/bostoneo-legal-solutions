package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;
import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface RoleService {
    // Legacy methods
    Role getRoleByUserId(Long id);
    Collection<Role> getRoles();
    
    // Enhanced RBAC methods
    Role getRoleById(Long id);
    Role getRoleByName(String name);
    Role createRole(Role role);
    Role updateRole(Role role);
    void deleteRole(Long id);
    
    // User-Role methods
    Set<Role> getRolesByUserId(Long userId);
    void assignRoleToUser(Long userId, Long roleId);
    void removeRoleFromUser(Long userId, Long roleId);
    List<User> getUsersByRoleId(Long roleId);
    
    // Role hierarchy methods
    void setPrimaryRole(Long userId, Long roleId);
    void setRoleExpiration(Long userId, Long roleId, LocalDateTime expiresAt);
    
    // Permission methods
    List<Permission> getAllPermissions();
    Set<Permission> getPermissionsByRoleId(Long roleId);
    void assignPermissionsToRole(Long roleId, List<Long> permissionIds);
    void removePermissionFromRole(Long roleId, Long permissionId);
    
    // Case-specific role assignments
    Set<CaseRoleAssignment> getCaseRoleAssignments(Long userId);
    CaseRoleAssignment assignCaseRole(Long caseId, Long userId, Long roleId, LocalDateTime expiresAt);
    void removeCaseRole(Long assignmentId);
    
    // Get all active case roles for a specific case
    Set<CaseRoleAssignment> getCaseRoleAssignmentsByCase(Long caseId);
    
    // Add method to get case IDs for a user
    Set<Long> getUserCaseIds(Long userId);
}
