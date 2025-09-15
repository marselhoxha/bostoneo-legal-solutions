package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.enums.ResourceType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.repository.PermissionRepository;
import com.bostoneo.bostoneosolutions.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Set;

/**
 * Implementation of the PermissionService interface
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository<Permission> permissionRepository;

    @Override
    public Permission getPermissionById(Long id) {
        log.info("Fetching permission by id: {}", id);
        return permissionRepository.findById(id)
                .orElseThrow(() -> new ApiException("Permission not found with id: " + id));
    }

    @Override
    public Collection<Permission> getAllPermissions() {
        log.info("Fetching all permissions");
        return permissionRepository.findAll();
    }

    @Override
    public Set<Permission> getPermissionsByResourceType(ResourceType resourceType) {
        log.info("Fetching permissions for resource type: {}", resourceType);
        return permissionRepository.findByResourceType(resourceType);
    }

    @Override
    public Permission createPermission(Permission permission) {
        log.info("Creating new permission: {}", permission.getName());
        return permissionRepository.save(permission);
    }

    @Override
    public Permission updatePermission(Permission permission) {
        log.info("Updating permission: {}", permission.getName());
        return permissionRepository.save(permission);
    }

    @Override
    public void deletePermission(Long id) {
        log.info("Deleting permission with id: {}", id);
        permissionRepository.deleteById(id);
    }
} 