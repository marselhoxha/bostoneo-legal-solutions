package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enums.ResourceType;
import com.bostoneo.bostoneosolutions.model.Permission;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;

public interface PermissionRepository<T extends Permission> {
    T save(T permission);
    Optional<T> findById(Long id);
    Collection<T> findAll();
    void deleteById(Long id);
    Set<T> findByResourceType(ResourceType resourceType);
    Optional<T> findByName(String name);
} 