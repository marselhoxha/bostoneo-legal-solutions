package com.***REMOVED***.***REMOVED***solutions.query;

public class UserQuery {

    public static final String INSERT_USER_QUERY = "INSERT INTO users (first_name, last_name, email, password) VALUES (:firstName, :lastName, :email, :password)";
    public static final String COUNT_USER_EMAIL_QUERY = "SELECT COUNT(*) FROM users WHERE email = :email";
    public static final String INSERT_ACCOUNT_VERIFICATION_URL_QUERY = "INSERT INTO accountverifications (user_id, url) VALUES (:userId, :url)";
    public static final String SELECT_USER_BY_EMAIL_QUERY = "SELECT * FROM users WHERE email = :email";
    public static final String DELETE_VERIFICATION_CODE_BY_USER_ID = "DELETE FROM twofactorverifications WHERE user_id = :id";
    public static final String INSERT_VERIFICATION_CODE_QUERY = "INSERT INTO twofactorverifications (user_id, code, expiration_date) VALUES (:userId, :code, :expirationDate)";
    public static final String SELECT_USER_BY_USER_CODE_QUERY = "SELECT * FROM users WHERE id = (SELECT user_id FROM twofactorverifications WHERE code = :code)";
    public static final String DELETE_CODE = "DELETE FROM twofactorverifications WHERE code = :code";
    public static final String SELECT_CODE_EXPIRATION_QUERY = "SELECT expiration_date < NOW() AS is_expired FROM twofactorverifications WHERE code = :code";
    public static final String DELETE_PASSWORD_VERIFICATION_BY_USER_ID_QUERY = "DELETE FROM resetpasswordverifications WHERE user_id = :userId";
    public static final String INSERT_PASSWORD_VERIFICATION_QUERY = "INSERT INTO resetpasswordverifications (user_id, url, expiration_date) VALUES (:userId, :url, :expirationDate)";
    public static final String SELECT_EXPIRATION_BY_URL = "SELECT expiration_date < NOW() AS is_expired FROM resetpasswordverifications WHERE url = :url";
    public static final String SELECT_USER_BY_PASSWORD_URL_QUERY = "SELECT * FROM users WHERE id = (SELECT user_id FROM resetpasswordverifications WHERE url = :url)";
    public static final String UPDATE_USER_PASSWORD_BY_URL_QUERY = "UPDATE users SET password = :password WHERE id = (SELECT user_id FROM resetpasswordverifications WHERE url = :url)";
    public static final String DELETE_VERIFICATION_BY_URL_QUERY = "DELETE FROM resetpasswordverifications WHERE url = :url";
    public static final String SELECT_USER_BY_ACCOUNT_URL_QUERY = "SELECT * FROM users WHERE id = (SELECT user_id FROM accountverifications WHERE url = :url)";
    public static final String UPDATE_USER_ENABLED_QUERY = "UPDATE users SET enabled = :enabled WHERE id = :id";
    public static final String UPDATE_USER_DETAILS_QUERY = "UPDATE users SET first_name = :firstName, last_name = :lastName, email = :email, phone = :phone, address = :address, title = :title, bio = :bio WHERE id = :id";
    public static final String SELECT_USER_BY_ID_QUERY = "SELECT * FROM users WHERE id = :id";
    public static final String UPDATE_USER_PASSWORD_BY_ID_QUERY = "UPDATE users SET password = :password WHERE id = :userId";
    public static final String UPDATE_USER_SETTINGS_QUERY = "UPDATE users SET enabled = :enabled, non_locked = :notLocked WHERE id = :userId";
    public static final String TOGGLE_USER_MFA_QUERY = "UPDATE users SET using_mfa = :isUsingMfa WHERE email = :email";
    public static final String UPDATE_USER_IMAGE_QUERY = "UPDATE users SET image_url = :imageUrl WHERE id = :id";
    public static final String UPDATE_USER_PASSWORD_BY_USER_ID_QUERY = "UPDATE users SET password = :password WHERE id = :id";
    public static final String SELECT_ALL_USERS_QUERY = "SELECT * FROM users ORDER BY id LIMIT :pageSize OFFSET :offset";
    public static final String COUNT_ALL_USERS_QUERY = "SELECT COUNT(*) FROM users";
    
    // Delete user and related data
    public static final String DELETE_USER_ROLES_QUERY = "DELETE FROM user_roles WHERE user_id = :userId";
    public static final String DELETE_USER_EVENTS_QUERY = "DELETE FROM userevents WHERE user_id = :userId";
    public static final String DELETE_USER_QUERY = "DELETE FROM users WHERE id = :userId";

}
