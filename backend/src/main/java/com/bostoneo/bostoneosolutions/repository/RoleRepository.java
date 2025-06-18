package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.model.Role;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface RoleRepository <T extends Role> {
    /* Basic CRUD Operations */
    T create(T data);
    Collection<T> list();
    T get(Long id);
    T update(T data);
    Boolean delete(Long id); //boolean to determine if the operation was successful

    /* More Complex Operations */
    void addRoleToUser(Long userId, String roleName);
    T getRoleByUserId(Long userId);
    T getRoleByEmail(String email);
    void updateUserRole(Long userId, String roleName);
    
    /* Enhanced RBAC Operations */
    T getRoleById(Long id);
    T getRoleByName(String name);
    Set<T> getRolesByUserId(Long userId);
    void removeRoleFromUser(Long userId, Long roleId);
    Set<Permission> getPermissionsByRoleId(Long roleId);
    void assignPermissionsToRole(Long roleId, List<Long> permissionIds);
    void removePermissionFromRole(Long roleId, Long permissionId);
    
    /* Role Hierarchy and Expiration */
    void setPrimaryRole(Long userId, Long roleId);
    void setRoleExpiration(Long userId, Long roleId, LocalDateTime expiresAt);
    
    /* Get users by role */
    java.util.List<com.***REMOVED***.***REMOVED***solutions.model.User> getUsersByRoleId(Long roleId);
    
    /* Permission Access Controls */
    Set<String> getUserPermissions(Long userId);
}
