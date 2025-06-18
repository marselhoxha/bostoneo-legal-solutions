package com.***REMOVED***.***REMOVED***solutions.query;

public class RoleQuery {

    // User-Role queries
    public static final String INSERT_ROLE_TO_USER_QUERY= "INSERT INTO user_roles_new (user_id, role_id) VALUES (:userId, :roleId)";
    public static final String SELECT_ROLE_BY_NAME_QUERY  = "SELECT * FROM roles_new WHERE name= :name";
    public static final String SELECT_ROLE_BY_ID_QUERY = "SELECT * FROM roles_new WHERE id = :id";
    public static final String SELECT_ROLE_BY_USER_ID_QUERY = "SELECT r.id, r.name, r.permission, r.description, r.hierarchy_level, r.is_system_role FROM roles_new r JOIN user_roles_new ur ON ur.role_id = r.id JOIN users u ON u.id = ur.user_id WHERE u.id = :id";
    public static final String SELECT_ROLES_QUERY = "SELECT * FROM roles_new ORDER BY id";
    public static final String UPDATE_USER_ROLE_QUERY = "UPDATE user_roles_new SET role_id = :roleId WHERE user_id = :userId";
    public static final String REMOVE_ROLE_FROM_USER_QUERY = "DELETE FROM user_roles_new WHERE user_id = :userId AND role_id = :roleId";
    
    // Role-Permission queries
    public static final String ASSIGN_PERMISSION_TO_ROLE_QUERY = "INSERT INTO role_permissions_new (role_id, permission_id) VALUES (:roleId, :permissionId)";
    public static final String REMOVE_PERMISSION_FROM_ROLE_QUERY = "DELETE FROM role_permissions_new WHERE role_id = :roleId AND permission_id = :permissionId";
    public static final String REMOVE_ALL_PERMISSIONS_FROM_ROLE_QUERY = "DELETE FROM role_permissions_new WHERE role_id = :roleId";
    public static final String SELECT_PERMISSIONS_BY_ROLE_ID_QUERY = "SELECT p.* FROM permissions_new p JOIN role_permissions_new rp ON p.id = rp.permission_id WHERE rp.role_id = :roleId";
    public static final String SELECT_ROLES_BY_USER_ID_QUERY = "SELECT r.* FROM roles_new r JOIN user_roles_new ur ON r.id = ur.role_id WHERE ur.user_id = :userId";
    
    // Role CRUD queries
    public static final String INSERT_ROLE_QUERY = "INSERT INTO roles_new (name, permission, description, hierarchy_level, is_system_role) VALUES (:name, :permission, :description, :hierarchyLevel, :isSystemRole)";
    public static final String UPDATE_ROLE_QUERY = "UPDATE roles_new SET name = :name, permission = :permission, description = :description, hierarchy_level = :hierarchyLevel, is_system_role = :isSystemRole WHERE id = :id";
    public static final String DELETE_ROLE_QUERY = "DELETE FROM roles_new WHERE id = :id";
    
    // Case Role Assignment queries
    public static final String INSERT_CASE_ROLE_ASSIGNMENT_QUERY = "INSERT INTO case_role_assignments (case_id, user_id, role_id, expires_at) VALUES (:caseId, :userId, :roleId, :expiresAt)";
    public static final String SELECT_CASE_ROLE_ASSIGNMENTS_BY_USER_QUERY = "SELECT * FROM case_role_assignments WHERE user_id = :userId";
    public static final String SELECT_CASE_ROLE_ASSIGNMENTS_BY_CASE_QUERY = "SELECT * FROM case_role_assignments WHERE case_id = :caseId";
    public static final String DELETE_CASE_ROLE_ASSIGNMENT_QUERY = "DELETE FROM case_role_assignments WHERE id = :id";
    
    // Role Hierarchy and Expiration queries
    public static final String SET_PRIMARY_ROLE_QUERY = "UPDATE user_roles_new SET is_primary = (CASE WHEN role_id = :roleId THEN TRUE ELSE FALSE END) WHERE user_id = :userId";
    public static final String SET_ROLE_EXPIRATION_QUERY = "UPDATE user_roles_new SET expires_at = :expiresAt WHERE user_id = :userId AND role_id = :roleId";
    public static final String SELECT_USERS_BY_ROLE_ID_QUERY = "SELECT u.* FROM users u JOIN user_roles_new ur ON u.id = ur.user_id WHERE ur.role_id = :roleId";
    
    // Permission queries
    public static final String GET_USER_PERMISSIONS_QUERY = "SELECT DISTINCT p.name FROM permissions_new p " +
            "JOIN role_permissions_new rp ON p.id = rp.permission_id " +
            "JOIN user_roles_new ur ON rp.role_id = ur.role_id " +
            "WHERE ur.user_id = :userId";
}
