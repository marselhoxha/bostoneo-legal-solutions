package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enums.ResourceType;
import com.bostoneo.bostoneosolutions.model.Permission;

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