package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.enums.ResourceType;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;

import java.util.Collection;
import java.util.Set;

/**
 * Service for managing permissions in the RBAC system
 */
public interface PermissionService {
    Permission getPermissionById(Long id);
    Collection<Permission> getAllPermissions();
    Set<Permission> getPermissionsByResourceType(ResourceType resourceType);
    Permission createPermission(Permission permission);
    Permission updatePermission(Permission permission);
    void deletePermission(Long id);
} 