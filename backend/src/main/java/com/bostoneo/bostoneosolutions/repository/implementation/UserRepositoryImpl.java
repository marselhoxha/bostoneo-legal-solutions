package com.bostoneo.bostoneosolutions.repository.implementation;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.form.UpdateForm;
import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;
import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.query.RoleQuery;
import com.bostoneo.bostoneosolutions.repository.RoleRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.rowmapper.UserRowMapper;
import com.bostoneo.bostoneosolutions.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Repository;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.List;
import java.util.Map;

import static com.bostoneo.bostoneosolutions.enumeration.RoleType.ROLE_USER;
import static com.bostoneo.bostoneosolutions.enumeration.VerificationType.ACCOUNT;
import static com.bostoneo.bostoneosolutions.enumeration.VerificationType.PASSWORD;
import static com.bostoneo.bostoneosolutions.query.UserQuery.*;
import static java.nio.file.StandardCopyOption.REPLACE_EXISTING;
import static java.util.Map.of;
import static java.util.Objects.requireNonNull;
import static org.apache.commons.lang3.RandomStringUtils.randomAlphabetic;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.time.DateFormatUtils.format;
import static org.apache.commons.lang3.time.DateUtils.addDays;
import static org.springframework.web.servlet.support.ServletUriComponentsBuilder.fromCurrentContextPath;

@Repository
@RequiredArgsConstructor
@Slf4j
public class UserRepositoryImpl implements UserRepository<User>, UserDetailsService {
    private final NamedParameterJdbcTemplate jdbc;
    private final RoleRepository<Role> roleRepository;
    private final BCryptPasswordEncoder encoder;
    private final EmailService emailService;

    @Override
    public User create(User user) {
        if(getEmailCount(user.getEmail().trim().toLowerCase()) > 0) throw new ApiException("Email already in use. Please use a different email and try again.");
        try {
            KeyHolder holder = new GeneratedKeyHolder();
            SqlParameterSource parameters = getSqlParameterSource(user);
            jdbc.update(INSERT_USER_QUERY, parameters, holder);
            user.setId(requireNonNull(holder.getKey()).longValue());
            roleRepository.addRoleToUser(user.getId(), ROLE_USER.name());
            String verificationUrl = getVerificationUrl(UUID.randomUUID().toString(), ACCOUNT.getType());
            jdbc.update(INSERT_ACCOUNT_VERIFICATION_URL_QUERY, of("userId", user.getId(), "url", verificationUrl));
            sendEmail(user.getFirstName(), user.getEmail(), verificationUrl, ACCOUNT);
            user.setEnabled(false);
            user.setNotLocked(true);
            log.debug("Verification URL: {}", verificationUrl);
            return user;
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public Collection<User> list(int page, int pageSize) {
        try {
            log.info("Fetching users with pagination: page={}, pageSize={}", page, pageSize);
            
            if (pageSize <= 0) pageSize = 20; // Default page size
            if (page < 0) page = 0; // Default page
            
            int offset = page * pageSize;
            
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("pageSize", pageSize)
                .addValue("offset", offset);
            
            return jdbc.query(SELECT_ALL_USERS_QUERY, params, new UserRowMapper());
        } catch (Exception exception) {
            log.error("Error fetching users: {}", exception.getMessage(), exception);
            throw new ApiException("An error occurred while fetching users: " + exception.getMessage());
        }
    }

    @Override
    public User get(Long id) {
        try {
            return jdbc.queryForObject(SELECT_USER_BY_ID_QUERY, of("id", id), new UserRowMapper());
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No User found by id: " + id);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public User update(User data) {
        return null;
    }

    @Override
    public Boolean delete(Long id) {
        try {
            // Check if user exists
            User user = get(id);
            if (user == null) {
                throw new ApiException("User not found with ID: " + id);
            }
            
            // DELETE ALL FOREIGN KEY REFERENCES - BASED ON ACTUAL DATABASE SCHEMA
            
            // Delete verifications
            jdbc.update("DELETE FROM TwoFactorVerifications WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM ResetPasswordVerifications WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM AccountVerifications WHERE user_id = :userId", of("userId", id));
            
            // Delete user events and activities
            jdbc.update("DELETE FROM UserEvents WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM activity_summary WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM audit_log WHERE user_id = :userId", of("userId", id));
            
            // Delete attorney expertise
            jdbc.update("DELETE FROM attorney_expertise WHERE user_id = :userId", of("userId", id));
            
            // Delete timer and time tracking
            jdbc.update("DELETE FROM active_timers WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM timer_sessions WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM mobile_time_entries WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM time_entry_approvals WHERE approver_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM time_reports_cache WHERE user_id = :userId", of("userId", id));
            
            // Delete billing
            jdbc.update("DELETE FROM billing_rates WHERE user_id = :userId", of("userId", id));
            
            // Delete calendar
            jdbc.update("DELETE FROM calendar_event_participants WHERE user_id = :userId OR added_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM calendar_events WHERE user_id = :userId", of("userId", id));
            
            // Delete case related - handle foreign keys in correct order
            jdbc.update("DELETE FROM case_timeline WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM case_reminders WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM case_activities WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM case_access_requests WHERE requested_by = :userId OR reviewed_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM case_notes WHERE user_id = :userId OR updated_by = :userId", of("userId", id));
            
            // Delete case transfers
            jdbc.update("DELETE FROM case_transfer_requests WHERE from_user_id = :userId OR to_user_id = :userId OR requested_by = :userId OR approved_by = :userId", of("userId", id));
            
            // Delete case team assignments
            jdbc.update("DELETE FROM case_team_assignments WHERE user_id = :userId OR assigned_by = :userId", of("userId", id));
            
            // Delete case assignment history BEFORE case_assignments
            jdbc.update("DELETE FROM case_assignment_history WHERE user_id = :userId OR previous_user_id = :userId OR new_user_id = :userId OR performed_by = :userId", of("userId", id));
            
            // Delete case assignments
            jdbc.update("DELETE FROM case_assignments WHERE user_id = :userId OR assigned_by = :userId", of("userId", id));
            
            // Handle case_tasks self-referencing parent_task_id
            jdbc.update("UPDATE case_tasks ct1 INNER JOIN case_tasks ct2 ON ct1.parent_task_id = ct2.id SET ct1.parent_task_id = NULL WHERE ct2.assigned_to = :userId OR ct2.assigned_by = :userId", of("userId", id));
            
            // Delete task comments BEFORE case_tasks
            jdbc.update("DELETE FROM task_comments WHERE user_id = :userId", of("userId", id));
            
            // Delete case tasks
            jdbc.update("DELETE FROM case_tasks WHERE assigned_to = :userId OR assigned_by = :userId", of("userId", id));
            
            // Delete department role assignments
            jdbc.update("DELETE FROM department_role_assignments WHERE user_id = :userId", of("userId", id));
            
            // Delete document/file related
            jdbc.update("DELETE FROM document_access_log WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM document_versions WHERE uploaded_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM document_visibility_overrides WHERE user_id = :userId OR granted_by = :userId", of("userId", id));
            jdbc.update("UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = :userId", of("userId", id));
            
            // Delete file system related
            jdbc.update("DELETE FROM file_access_logs WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM file_comments WHERE created_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM file_items WHERE created_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM file_permissions WHERE user_id = :userId OR granted_by = :userId OR revoked_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM file_shares WHERE shared_by = :userId OR shared_with = :userId", of("userId", id));
            jdbc.update("DELETE FROM file_tags WHERE created_by = :userId", of("userId", id));
            jdbc.update("DELETE FROM file_versions WHERE uploaded_by = :userId", of("userId", id));
            jdbc.update("UPDATE folders SET created_by = NULL WHERE created_by = :userId", of("userId", id));
            
            // Delete financial
            jdbc.update("DELETE FROM financial_access_permissions WHERE user_id = :userId OR granted_by = :userId", of("userId", id));
            jdbc.update("UPDATE expenses SET created_by_user_id = NULL WHERE created_by_user_id = :userId", of("userId", id));
            jdbc.update("UPDATE invoice_templates SET created_by = NULL WHERE created_by = :userId", of("userId", id));
            jdbc.update("UPDATE invoice_workflow_rules SET created_by = NULL WHERE created_by = :userId", of("userId", id));
            jdbc.update("UPDATE invoices SET created_by = NULL WHERE created_by = :userId", of("userId", id));
            jdbc.update("UPDATE payment_transactions SET created_by = NULL WHERE created_by = :userId", of("userId", id));
            
            // Delete legal documents
            jdbc.update("UPDATE legaldocument SET uploadedBy = NULL WHERE uploadedBy = :userId", of("userId", id));
            
            // Delete workload
            jdbc.update("DELETE FROM user_workload WHERE user_id = :userId", of("userId", id));
            jdbc.update("DELETE FROM workload_calculations WHERE user_id = :userId", of("userId", id));
            
            // Delete user roles (appears twice in FK list, but delete once)
            jdbc.update(DELETE_USER_ROLES_QUERY, of("userId", id));
            
            // NOTE: We're NOT deleting time_entries as they are needed for billing/audit
            
            // FINALLY, delete the user
            int rowsAffected = jdbc.update(DELETE_USER_QUERY, of("userId", id));
            
            return rowsAffected > 0;
            
        } catch (Exception exception) {
            log.error("Error deleting user with ID: " + id, exception);
            throw new ApiException("An error occurred while deleting the user. Error: " + exception.getMessage());
        }
    }

    private Integer getEmailCount(String email) {
        return jdbc.queryForObject(COUNT_USER_EMAIL_QUERY, of("email", email), Integer.class);
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = getUserByEmail(email);
        if(user == null) {
            log.error("User not found in the database");
            throw new UsernameNotFoundException("User not found in the database");
        } else {
            log.info("User found in the database: {}", email);
            
            // Get all roles for the user
            Set<Role> roles = roleRepository.getRolesByUserId(user.getId());
            
            // Get permissions for all the user's roles
            Set<Permission> permissions = new HashSet<>();
            for (Role role : roles) {
                permissions.addAll(roleRepository.getPermissionsByRoleId(role.getId()));
            }
            
            log.info("User has {} roles and {} permissions", roles.size(), permissions.size());
            log.info("Roles: {}", roles.stream().map(Role::getName).collect(java.util.stream.Collectors.toList()));
            log.info("Permissions: {}", permissions.stream().map(Permission::getName).collect(java.util.stream.Collectors.toList()));
            
            // Create UserPrincipal with full RBAC information
            UserPrincipal principal = new UserPrincipal(user, roles, permissions, new HashSet<>());
            log.info("UserPrincipal authorities: {}", principal.getAuthorities().stream().map(org.springframework.security.core.GrantedAuthority::getAuthority).collect(java.util.stream.Collectors.toList()));
            return principal;
        }
    }

    @Override
    public User getUserByEmail(String email) {
        try {
            User user = jdbc.queryForObject(SELECT_USER_BY_EMAIL_QUERY, of("email", email), new UserRowMapper());
            return user;
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No User found by email: " + email);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void sendVerificationCode(UserDTO user) {
        String expirationDate = format(addDays(new Date(), 1), "yyyy-MM-dd HH:mm:ss");
        String verificationCode = randomAlphabetic(8).toUpperCase();
        try {
            jdbc.update(DELETE_VERIFICATION_CODE_BY_USER_ID, of("id", user.getId()));
            jdbc.update(INSERT_VERIFICATION_CODE_QUERY, of("userId", user.getId(), "code", verificationCode, "expirationDate", expirationDate));
            //sendSMS(user.getPhone(), "From: Bostoneo Solutions \nVerification code\n" + verificationCode);
            log.info("Verification Code: {}", verificationCode);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public User verifyCode(String email, String code) {
        if(isVerificationCodeExpired(code)) throw new ApiException("This code has expired. Please login again.");
        try {
            User userByCode = jdbc.queryForObject(SELECT_USER_BY_USER_CODE_QUERY, of("code", code), new UserRowMapper());
            User userByEmail = jdbc.queryForObject(SELECT_USER_BY_EMAIL_QUERY, of("email", email), new UserRowMapper());
            if(userByCode.getEmail().equalsIgnoreCase(userByEmail.getEmail())) {
                jdbc.update(DELETE_CODE, of("code", code));
                return userByCode;
            } else {
                throw new ApiException("Code is invalid. Please try again.");
            }
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("Could not find record");
        } catch (Exception exception) {
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void resetPassword(String email) {
        if(getEmailCount(email.trim().toLowerCase()) <= 0) throw new ApiException("There is no account for this email address.");
        try {
            String expirationDate = format(addDays(new Date(), 1), "yyyy-MM-dd HH:mm:ss"); // Corrected format
            User user = getUserByEmail(email);
            String verificationUrl = getVerificationUrl(UUID.randomUUID().toString(), PASSWORD.getType());
            jdbc.update(DELETE_PASSWORD_VERIFICATION_BY_USER_ID_QUERY, of("userId",  user.getId()));
            jdbc.update(INSERT_PASSWORD_VERIFICATION_QUERY, of("userId",  user.getId(), "url", verificationUrl, "expirationDate", expirationDate));
            sendEmail(user.getFirstName(), email, verificationUrl, PASSWORD);
            log.info("Verification URL: {}", verificationUrl);
        } catch (Exception exception) {
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public User verifyPasswordKey(String key) {
        if(isLinkExpired(key, PASSWORD)) throw new ApiException("This link has expired. Please reset your password again.");
        try {
            User user = jdbc.queryForObject(SELECT_USER_BY_PASSWORD_URL_QUERY, of("url", getVerificationUrl(key, PASSWORD.getType())), new UserRowMapper());
            //jdbc.update("DELETE_USER_FROM_PASSWORD_VERIFICATION_QUERY", of("id", user.getId())); //Depends on use case / developer or business
            return user;
        } catch (EmptyResultDataAccessException exception) {
            log.error(exception.getMessage());
            throw new ApiException("This link is not valid. Please reset your password again.");
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void renewPassword(String key, String password, String confirmPassword) {
        if(!password.equals(confirmPassword)) throw new ApiException("Passwords don't match. Please try again.");
        try {
            jdbc.update(UPDATE_USER_PASSWORD_BY_URL_QUERY, of("password", encoder.encode(password), "url", getVerificationUrl(key, PASSWORD.getType())));
            jdbc.update(DELETE_VERIFICATION_BY_URL_QUERY, of("url", getVerificationUrl(key, PASSWORD.getType())));
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }
    @Override
    public void renewPassword(Long userId, String password, String confirmPassword) {
        if(!password.equals(confirmPassword)) throw new ApiException("Passwords don't match. Please try again.");
        try {
            jdbc.update(UPDATE_USER_PASSWORD_BY_USER_ID_QUERY, of("id", userId, "password", encoder.encode(password)));
            //jdbc.update(DELETE_PASSWORD_VERIFICATION_BY_USER_ID_QUERY, of("userId", userId));
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public User verifyAccountKey(String key) {
        try {
            User user = jdbc.queryForObject(SELECT_USER_BY_ACCOUNT_URL_QUERY, of("url", getVerificationUrl(key, ACCOUNT.getType())), new UserRowMapper());
            jdbc.update(UPDATE_USER_ENABLED_QUERY, of("enabled", true, "id", user.getId()));
            // Delete after updating - depends on your requirements
            return user;
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("This link is not valid.");
        } catch (Exception exception) {
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public User updateUserDetails(UpdateForm user) {
        try {
            jdbc.update(UPDATE_USER_DETAILS_QUERY, getUserDetailsSqlParameterSource(user));
            return get(user.getId());
        }catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No User found by id: " + user.getId());
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public void updatePassword(Long id, String currentPassword, String newPassword, String confirmNewPassword) {
        if(!newPassword.equals(confirmNewPassword)) { throw new ApiException("Passwords don't match. Please try again."); }
        User user = get(id);
        if(encoder.matches(currentPassword, user.getPassword())) {
            try {
                jdbc.update(UPDATE_USER_PASSWORD_BY_ID_QUERY, of("userId", id, "password", encoder.encode(newPassword)));
            }  catch (Exception exception) {
                throw new ApiException("An error occurred. Please try again.");
            }
        } else {
            throw new ApiException("Incorrect current password. Please try again.");
        }
    }

    @Override
    public void updateAccountSettings(Long userId, Boolean enabled, Boolean notLocked) {
        try {
            jdbc.update(UPDATE_USER_SETTINGS_QUERY, of("userId", userId, "enabled", enabled, "notLocked", notLocked));
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public User toggleMfa(String email) {
        User user = getUserByEmail(email);
        if(isBlank(user.getPhone())) { throw new ApiException("You need a phone number to change Multi-Factor Authentication"); }
        user.setUsingMFA(!user.isUsingMFA());
        try {
            jdbc.update(TOGGLE_USER_MFA_QUERY, of("email", email, "isUsingMfa", user.isUsingMFA()));
            return user;
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("Unable to update Multi-Factor Authentication");
        }
    }

    @Override
    public void updateImage(UserDTO user, MultipartFile image) {
        String userImageUrl = setUserImageUrl(user.getEmail());
        user.setImageUrl(userImageUrl);
        saveImage(user.getEmail(), image);
        jdbc.update(UPDATE_USER_IMAGE_QUERY, of("imageUrl", userImageUrl, "id", user.getId()));
    }

    @Override
    public List<User> getUsersByRoleId(Long roleId) {
        try {
            return jdbc.query(RoleQuery.SELECT_USERS_BY_ROLE_ID_QUERY, of("roleId", roleId), new UserRowMapper());
        } catch (Exception exception) {
            log.error("Error fetching users by role id: {}", exception.getMessage());
            throw new ApiException("An error occurred while fetching users by role");
        }
    }

    @Override
    public User findByIdWithRoles(Long id) {
        try {
            User user = jdbc.queryForObject(SELECT_USER_BY_ID_QUERY, of("id", id), new UserRowMapper());
            if (user != null) {
                // Load roles for the user
                Set<Role> roles = roleRepository.getRolesByUserId(user.getId());
                user.setRoles(roles);
            }
            return user;
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("No User found by id: " + id);
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    @Override
    public List<User> findActiveAttorneys() {
        try {
            String query = "SELECT * FROM users u " +
                          "INNER JOIN user_roles ur ON u.id = ur.user_id " +
                          "INNER JOIN roles r ON ur.role_id = r.id " +
                          "WHERE u.enabled = true AND u.not_locked = true " +
                          "AND r.name IN ('ROLE_ATTORNEY', 'ROLE_SENIOR_ATTORNEY', 'ROLE_PARTNER', " +
                          "'ROLE_SENIOR_PARTNER', 'ROLE_MANAGING_PARTNER') " +
                          "ORDER BY u.first_name, u.last_name";
            
            List<User> attorneys = jdbc.query(query, new UserRowMapper());
            
            // Load roles for each attorney
            attorneys.forEach(attorney -> {
                Set<Role> roles = roleRepository.getRolesByUserId(attorney.getId());
                attorney.setRoles(roles);
            });
            
            return attorneys;
        } catch (Exception exception) {
            log.error("Error fetching active attorneys: {}", exception.getMessage());
            throw new ApiException("An error occurred while fetching active attorneys");
        }
    }
    
    @Override
    public User findByEmail(String email) {
        return getUserByEmail(email);
    }

    private void sendEmail(String firstName, String email, String verificationUrl, VerificationType verificationType) {
        CompletableFuture.runAsync(() -> emailService.sendVerificationEmail(firstName, email, verificationUrl, verificationType));

        /*CompletableFuture.runAsync(() -> {
            try {
                emailService.sendVerificationEmail(firstName, email, verificationUrl, verificationType);
            } catch (Exception exception) {
                throw new ApiException("Unable to send email");
            }
        });*/

        /*CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
            try {
                emailService.sendVerificationEmail(firstName, email, verificationUrl, verificationType);
            } catch (Exception exception) {
                throw new ApiException("Unable to send email");
            }
        });*/

        /*CompletableFuture<Void> future = CompletableFuture.runAsync(new Runnable() {
            @Override
            public void run() {
                try {
                    emailService.sendVerificationEmail(firstName, email, verificationUrl, verificationType);
                } catch (Exception exception) {
                    throw new ApiException("Unable to send email");
                }
            }
        });*/
    }

    private String setUserImageUrl(String email) {
        return fromCurrentContextPath().path("/user/image/" + email + ".png").toUriString();
    }

    private void saveImage(String email, MultipartFile image) {
        Path fileStorageLocation = Paths.get(System.getProperty("user.home") + "/Downloads/images/").toAbsolutePath().normalize();
        if(!Files.exists(fileStorageLocation)) {
            try {
                Files.createDirectories(fileStorageLocation);
            } catch (Exception exception) {
                log.error(exception.getMessage());
                throw new ApiException("Unable to create directories to save image");
            }
            log.info("Created directories: {}", fileStorageLocation);
        }
        try {
            Files.copy(image.getInputStream(), fileStorageLocation.resolve(email + ".png"), REPLACE_EXISTING);
        } catch (IOException exception) {
            log.error(exception.getMessage());
            throw new ApiException(exception.getMessage());
        }
        log.info("File saved in: {} folder", fileStorageLocation);
    }

    private Boolean isLinkExpired(String key, VerificationType password) {
        try {
            return jdbc.queryForObject(SELECT_EXPIRATION_BY_URL, of("url", getVerificationUrl(key, password.getType())), Boolean.class);
        } catch (EmptyResultDataAccessException exception) {
            log.error(exception.getMessage());
            throw new ApiException("This link is not valid. Please reset your password again");
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("An error occurred. Please try again");
        }
    }

    private Boolean isVerificationCodeExpired(String code) {
        try {
            return jdbc.queryForObject(SELECT_CODE_EXPIRATION_QUERY, of("code", code), Boolean.class);
        } catch (EmptyResultDataAccessException exception) {
            throw new ApiException("This code is not valid. Please login again.");
        } catch (Exception exception) {
            throw new ApiException("An error occurred. Please try again.");
        }
    }

    private SqlParameterSource getSqlParameterSource(User user) {
        return new MapSqlParameterSource()
                .addValue("firstName", user.getFirstName())
                .addValue("lastName", user.getLastName())
                .addValue("email", user.getEmail())
                .addValue("password", encoder.encode(user.getPassword()));
    }

    private SqlParameterSource getUserDetailsSqlParameterSource(UpdateForm user) {
        return new MapSqlParameterSource()
                .addValue("id", user.getId())
                .addValue("firstName", user.getFirstName())
                .addValue("lastName", user.getLastName())
                .addValue("email", user.getEmail())
                .addValue("phone", user.getPhone())
                .addValue("address", user.getAddress())
                .addValue("title", user.getTitle())
                .addValue("bio", user.getBio());
    }

    private String getVerificationUrl(String key, String type) {
        return fromCurrentContextPath().path("/user/verify/" + type + "/" + key).toUriString();
    }
}