package com.bostoneo.bostoneosolutions.repository.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.repository.RoleRepository;
import com.bostoneo.bostoneosolutions.rowmapper.PermissionRowMapper;
import com.bostoneo.bostoneosolutions.rowmapper.RoleRowMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static com.bostoneo.bostoneosolutions.enumeration.RoleType.ROLE_USER;
import static com.bostoneo.bostoneosolutions.query.RoleQuery.*;
import static java.util.Map.of;
import static java.util.Objects.requireNonNull;

@Repository
@RequiredArgsConstructor
@Slf4j
public class RoleRepositoryImpl implements RoleRepository<Role> {


    private final NamedParameterJdbcTemplate jdbc;
    
    // SQL query for fetching user permissions
    private static final String GET_USER_PERMISSIONS_QUERY = 
        "SELECT DISTINCT p.name FROM permissions p " +
        "JOIN role_permissions rp ON p.id = rp.permission_id " +
        "JOIN roles r ON r.id = rp.role_id " +
        "JOIN user_roles ur ON r.id = ur.role_id " +
        "WHERE ur.user_id = :userId";

    @Override
    public Role create(Role data) {
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("name", data.getName())
                .addValue("description", data.getDescription())
                .addValue("hierarchyLevel", data.getHierarchyLevel())
                .addValue("isSystemRole", data.isSystemRole());
            
            jdbc.update(INSERT_ROLE_QUERY, parameters, keyHolder, new String[]{"id"});
            data.setId(keyHolder.getKey().longValue());
            return data;
        } catch (Exception exception) {
            log.error("Error creating role: {}", exception.getMessage());
            throw new ApiException("An error occurred while creating the role");
        }
    }

    @Override
    public Collection<Role> list() {
        try{
            return jdbc.query(SELECT_ROLES_QUERY,  new RoleRowMapper());
        }catch (Exception exception) {
            throw new ApiException("An error occurred. Please try again");
        }
    }

    @Override
    public Role get(Long id) {
        try {
            return jdbc.queryForObject(SELECT_ROLE_BY_ID_QUERY, of("id", id), new RoleRowMapper());
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No role found with id: " + id);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public Role update(Role data) {
        try {
            MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("id", data.getId())
                .addValue("name", data.getName())
                .addValue("description", data.getDescription())
                .addValue("hierarchyLevel", data.getHierarchyLevel())
                .addValue("isSystemRole", data.isSystemRole());
            
            jdbc.update(UPDATE_ROLE_QUERY, parameters);
            return data;
        } catch (Exception exception) {
            log.error("Error updating role: {}", exception.getMessage());
            throw new ApiException("An error occurred while updating the role");
        }
    }

    @Override
    public Boolean delete(Long id) {
        try {
            int result = jdbc.update(DELETE_ROLE_QUERY, of("id", id));
            return result > 0;
        } catch (Exception exception) {
            log.error("Error deleting role: {}", exception.getMessage());
            throw new ApiException("An error occurred while deleting the role");
        }
    }

    @Override
    public void addRoleToUser(Long userId, String roleName) {
        try{
            Role role =jdbc.queryForObject(SELECT_ROLE_BY_NAME_QUERY, Map.of("name", roleName), new RoleRowMapper());
            jdbc.update(INSERT_ROLE_TO_USER_QUERY, Map.of("userId", userId, "roleId", requireNonNull(role).getId()));

        }catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No role found by name:" + ROLE_USER.name());

        }catch (Exception exception) {
            throw new ApiException("An error occurred. Please try again");

        }

    }

    @Override
    public Role getRoleByUserId(Long userId) {
        try {
            return jdbc.queryForObject(SELECT_ROLE_BY_USER_ID_QUERY, of("id", userId), new RoleRowMapper());
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No role found for user with id: " + userId);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public Role getRoleByEmail(String email) {
        return null;
    }

    @Override
    public void updateUserRole(Long userId, String roleName) {
        try {
            Role role = jdbc.queryForObject(SELECT_ROLE_BY_NAME_QUERY, of("name", roleName), new RoleRowMapper());
            jdbc.update(UPDATE_USER_ROLE_QUERY, of("userId", userId, "roleId",role.getId()));
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No role found by name: " + roleName);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    // Implementing the missing methods
    @Override
    public Role getRoleById(Long id) {
        try {
            return jdbc.queryForObject(SELECT_ROLE_BY_ID_QUERY, of("id", id), new RoleRowMapper());
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No role found with id: " + id);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public Role getRoleByName(String name) {
        try {
            return jdbc.queryForObject(SELECT_ROLE_BY_NAME_QUERY, of("name", name), new RoleRowMapper());
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No role found with name: " + name);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public Set<Role> getRolesByUserId(Long userId) {
        try {
            List<Role> roles = jdbc.query(SELECT_ROLES_BY_USER_ID_QUERY, of("userId", userId), new RoleRowMapper());
            return new HashSet<>(roles);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void removeRoleFromUser(Long userId, Long roleId) {
        try {
            jdbc.update(REMOVE_ROLE_FROM_USER_QUERY, of("userId", userId, "roleId", roleId));
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public Set<Permission> getPermissionsByRoleId(Long roleId) {
        try {
            List<Permission> permissions = jdbc.query(SELECT_PERMISSIONS_BY_ROLE_ID_QUERY, of("roleId", roleId), new PermissionRowMapper());
            return new HashSet<>(permissions);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void assignPermissionsToRole(Long roleId, List<Long> permissionIds) {
        try {
            // First, remove all existing permissions for this role
            jdbc.update(REMOVE_ALL_PERMISSIONS_FROM_ROLE_QUERY, of("roleId", roleId));
            
            // Then assign the new permissions
            for (Long permissionId : permissionIds) {
                jdbc.update(ASSIGN_PERMISSION_TO_ROLE_QUERY, of("roleId", roleId, "permissionId", permissionId));
            }
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void removePermissionFromRole(Long roleId, Long permissionId) {
        try {
            jdbc.update(REMOVE_PERMISSION_FROM_ROLE_QUERY, of("roleId", roleId, "permissionId", permissionId));
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void setPrimaryRole(Long userId, Long roleId) {
        try {
            jdbc.update(SET_PRIMARY_ROLE_QUERY, of("userId", userId, "roleId", roleId));
        } catch (Exception exception) {
            log.error("Error setting primary role: {}", exception.getMessage());
            throw new ApiException("An error occurred while setting primary role");
        }
    }
    
    @Override
    public void setRoleExpiration(Long userId, Long roleId, LocalDateTime expiresAt) {
        try {
            jdbc.update(SET_ROLE_EXPIRATION_QUERY, of("userId", userId, "roleId", roleId, "expiresAt", expiresAt));
        } catch (Exception exception) {
            log.error("Error setting role expiration: {}", exception.getMessage());
            throw new ApiException("An error occurred while setting role expiration");
        }
    }
    
    @Override
    public Set<String> getUserPermissions(Long userId) {
        try {
            List<String> permissionNames = jdbc.queryForList(
                GET_USER_PERMISSIONS_QUERY, 
                of("userId", userId), 
                String.class
            );
            return new HashSet<>(permissionNames);
        } catch (Exception exception) {
            log.error("Error getting user permissions: {}", exception.getMessage());
            throw new ApiException("An error occurred while fetching user permissions");
        }
    }
    
    // Add missing method for getting users by role ID
    public List<com.bostoneo.bostoneosolutions.model.User> getUsersByRoleId(Long roleId) {
        try {
            return jdbc.query(SELECT_USERS_BY_ROLE_ID_QUERY, of("roleId", roleId), new com.bostoneo.bostoneosolutions.rowmapper.UserRowMapper());
        } catch (Exception exception) {
            log.error("Error getting users by role: {}", exception.getMessage());
            throw new ApiException("An error occurred while fetching users by role");
        }
    }
}
