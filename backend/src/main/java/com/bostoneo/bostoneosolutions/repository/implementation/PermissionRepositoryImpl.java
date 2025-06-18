package com.***REMOVED***.***REMOVED***solutions.repository.implementation;

import com.***REMOVED***.***REMOVED***solutions.enums.ResourceType;
import com.***REMOVED***.***REMOVED***solutions.exception.ApiException;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.repository.PermissionRepository;
import com.***REMOVED***.***REMOVED***solutions.rowmapper.PermissionRowMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static java.util.Map.of;

@Repository
@RequiredArgsConstructor
@Slf4j
public class PermissionRepositoryImpl implements PermissionRepository<Permission> {

    private final NamedParameterJdbcTemplate jdbc;

    // SQL queries
    private static final String SAVE_PERMISSION_QUERY = 
        "INSERT INTO permissions (name, description, resource_type, action_type) VALUES (:name, :description, :resourceType, :actionType)";
    private static final String UPDATE_PERMISSION_QUERY = 
        "UPDATE permissions SET name = :name, description = :description, resource_type = :resourceType, action_type = :actionType WHERE id = :id";
    private static final String FIND_BY_ID_QUERY = 
        "SELECT * FROM permissions WHERE id = :id";
    private static final String FIND_ALL_QUERY = 
        "SELECT * FROM permissions ORDER BY resource_type, action_type";
    private static final String FIND_BY_RESOURCE_TYPE_QUERY = 
        "SELECT * FROM permissions WHERE resource_type = :resourceType";
    private static final String FIND_BY_NAME_QUERY = 
        "SELECT * FROM permissions WHERE name = :name";
    private static final String DELETE_BY_ID_QUERY = 
        "DELETE FROM permissions WHERE id = :id";

    @Override
    public Permission save(Permission permission) {
        try {
            if (permission.getId() == null) {
                // Create new permission
                KeyHolder keyHolder = new GeneratedKeyHolder();
                MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("name", permission.getName())
                    .addValue("description", permission.getDescription())
                    .addValue("resourceType", permission.getResourceType().name())
                    .addValue("actionType", permission.getActionType().name());

                jdbc.update(SAVE_PERMISSION_QUERY, params, keyHolder, new String[]{"id"});
                permission.setId(keyHolder.getKey().longValue());
            } else {
                // Update existing permission
                MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("id", permission.getId())
                    .addValue("name", permission.getName())
                    .addValue("description", permission.getDescription())
                    .addValue("resourceType", permission.getResourceType().name())
                    .addValue("actionType", permission.getActionType().name());

                jdbc.update(UPDATE_PERMISSION_QUERY, params);
            }
            return permission;
        } catch (Exception e) {
            log.error("Error saving permission: {}", e.getMessage());
            throw new ApiException("Error saving permission");
        }
    }

    @Override
    public Optional<Permission> findById(Long id) {
        try {
            Permission permission = jdbc.queryForObject(FIND_BY_ID_QUERY, 
                of("id", id), 
                new PermissionRowMapper());
            return Optional.ofNullable(permission);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        } catch (Exception e) {
            log.error("Error finding permission by id: {}", e.getMessage());
            throw new ApiException("Error finding permission");
        }
    }

    @Override
    public Collection<Permission> findAll() {
        try {
            return jdbc.query(FIND_ALL_QUERY, new PermissionRowMapper());
        } catch (Exception e) {
            log.error("Error finding all permissions: {}", e.getMessage());
            throw new ApiException("Error finding permissions");
        }
    }

    @Override
    public void deleteById(Long id) {
        try {
            jdbc.update(DELETE_BY_ID_QUERY, of("id", id));
        } catch (Exception e) {
            log.error("Error deleting permission: {}", e.getMessage());
            throw new ApiException("Error deleting permission");
        }
    }

    @Override
    public Set<Permission> findByResourceType(ResourceType resourceType) {
        try {
            return new HashSet<>(jdbc.query(FIND_BY_RESOURCE_TYPE_QUERY, 
                of("resourceType", resourceType.name()), 
                new PermissionRowMapper()));
        } catch (Exception e) {
            log.error("Error finding permissions by resource type: {}", e.getMessage());
            throw new ApiException("Error finding permissions");
        }
    }

    @Override
    public Optional<Permission> findByName(String name) {
        try {
            Permission permission = jdbc.queryForObject(FIND_BY_NAME_QUERY, 
                of("name", name), 
                new PermissionRowMapper());
            return Optional.ofNullable(permission);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        } catch (Exception e) {
            log.error("Error finding permission by name: {}", e.getMessage());
            throw new ApiException("Error finding permission");
        }
    }
} 