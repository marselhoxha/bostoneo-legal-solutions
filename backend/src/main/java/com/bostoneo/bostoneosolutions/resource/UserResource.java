package com.bostoneo.bostoneosolutions.resource;

import com.auth0.jwt.exceptions.TokenExpiredException;
import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.event.NewUserEvent;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.form.*;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.Permission;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.provider.TokenProvider;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.service.EventService;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import com.bostoneo.bostoneosolutions.service.RoleService;
import com.bostoneo.bostoneosolutions.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static com.bostoneo.bostoneosolutions.constant.Constants.TOKEN_PREFIX;
import static com.bostoneo.bostoneosolutions.dtomapper.UserDTOMapper.toUser;
import static com.bostoneo.bostoneosolutions.enumeration.EventType.*;
import static com.bostoneo.bostoneosolutions.utils.ExceptionUtils.processError;
import static com.bostoneo.bostoneosolutions.utils.UserUtils.getAuthenticatedUser;
import static com.bostoneo.bostoneosolutions.utils.UserUtils.getLoggedInUser;
import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpStatus.*;
import static org.springframework.http.MediaType.IMAGE_PNG_VALUE;
import static org.springframework.security.authentication.UsernamePasswordAuthenticationToken.unauthenticated;
import static org.springframework.web.servlet.support.ServletUriComponentsBuilder.fromCurrentContextPath;

@RestController
@RequestMapping(path = "/user")
@RequiredArgsConstructor
@Slf4j
public class UserResource {
    private final UserService userService;
    private final RoleService roleService;
    private final EventService eventService;
    private final AuthenticationManager authenticationManager;
    private final TokenProvider tokenProvider;
    private final HttpServletRequest request;
    private final HttpServletResponse response;
    private final ApplicationEventPublisher publisher;
    private final ClientRepository clientRepository;
    private final FileStorageService fileStorageService;

    // Holds the UserPrincipal from authentication to avoid rebuilding it in sendResponse()
    private final ThreadLocal<UserPrincipal> authenticatedPrincipal = new ThreadLocal<>();

    @PostMapping("/login")
    @AuditLog(action = "LOGIN", entityType = "USER", description = "User login attempt")
    public ResponseEntity<HttpResponse> login(@RequestBody @Valid LoginForm loginForm) {
        UserDTO user = authenticate(loginForm.getEmail(), loginForm.getPassword());
        try {
            return user.isUsingMFA() ? sendVerificationCode(user) : sendResponse(user);
        } finally {
            authenticatedPrincipal.remove();
        }
    }

    @PostMapping("/register")
    @AuditLog(action = "CREATE", entityType = "USER", description = "New user registration")
    public ResponseEntity<HttpResponse> saveUser(@RequestBody @Valid User user) throws InterruptedException {
        TimeUnit.SECONDS.sleep(4);
        UserDTO userDto = userService.createUser(user);
        return ResponseEntity.created(getUri()).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userDto))
                        .message(String.format("User account created for user %s", user.getFirstName()))
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @GetMapping("/profile")
    public ResponseEntity<HttpResponse> profile(Authentication authentication) {
        UserDTO user = userService.getUserByEmail(getAuthenticatedUser(authentication).getEmail());
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", user, "events", eventService.getEventsByUserId(user.getId()), "roles", roleService.getRoles()))
                        .message("Profile Retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PatchMapping("/update")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Updated user profile information")
    public ResponseEntity<HttpResponse> updateUser(@RequestBody @Valid UpdateForm user) {
        UserDTO updatedUser = userService.updateUserDetails(user);
        publisher.publishEvent(new NewUserEvent(updatedUser.getEmail(), PROFILE_UPDATE, updatedUser.getOrganizationId()));
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", updatedUser, "events", eventService.getEventsByUserId(user.getId()), "roles", roleService.getRoles()))
                        .message("User updated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // START - To reset password when user is not logged in

    @GetMapping("/verify/code/{email}/{code}")
    public ResponseEntity<HttpResponse> verifyCode(@PathVariable("email") String email, @PathVariable("code") String code) {
        UserDTO user = userService.verifyCode(email, code);
        publisher.publishEvent(new NewUserEvent(user.getEmail(), LOGIN_ATTEMPT_SUCCESS, user.getOrganizationId()));
        UserPrincipal verifyPrincipal = getUserPrincipal(user);
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", user, "access_token", tokenProvider.createAccessToken(verifyPrincipal)
                                , "refresh_token", tokenProvider.createRefreshToken(verifyPrincipal)))
                        .message("Login Success")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/resetpassword/{email}")
    public ResponseEntity<HttpResponse> resetPassword(@PathVariable("email") String email) {
        userService.resetPassword(email);
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Email sent. Please check your email to reset your password.")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/verify/account/{key}")
    public ResponseEntity<HttpResponse> verifyAccount(@PathVariable("key") String key) throws InterruptedException {
        TimeUnit.SECONDS.sleep(3);
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message(userService.verifyAccountKey(key).isEnabled() ? "Account already verified" : "Account verified")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/verify/password/{key}")
    public ResponseEntity<HttpResponse> verifyPasswordUrl(@PathVariable("key") String key) throws InterruptedException {
        TimeUnit.SECONDS.sleep(3);
        UserDTO user = userService.verifyPasswordKey(key);
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", user))
                        .message("Please enter a new password")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/new/password")
    public ResponseEntity<HttpResponse> resetPasswordWithKey(@RequestBody @Valid NewPasswordForm form) throws InterruptedException {
        TimeUnit.SECONDS.sleep(3);
        userService.updatePassword(form.getUserId(), form.getPassword(), form.getConfirmPassword());
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Password reset successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // END - To reset password when user is not logged in

    @PatchMapping("/update/password")
    public ResponseEntity<HttpResponse> updatePassword(Authentication authentication, @RequestBody @Valid UpdatePasswordForm form) {
        UserDTO userDTO = getAuthenticatedUser(authentication);
        userService.updatePassword(userDTO.getId(), form.getCurrentPassword(), form.getNewPassword(), form.getConfirmNewPassword());
        publisher.publishEvent(new NewUserEvent(userDTO.getEmail(), PASSWORD_UPDATE, userDTO.getOrganizationId()));
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserById(userDTO.getId()), "events", eventService.getEventsByUserId(userDTO.getId()), "roles", roleService.getRoles()))
                        .message("Password updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PatchMapping("/update/role/{roleName}")
    public ResponseEntity<HttpResponse> updateUserRole(Authentication authentication, @PathVariable("roleName") String roleName) {
        UserDTO userDTO = getAuthenticatedUser(authentication);
        userService.updateUserRole(userDTO.getId(), roleName);
        publisher.publishEvent(new NewUserEvent(userDTO.getEmail(), ROLE_UPDATE, userDTO.getOrganizationId()));
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .data(of("user", userService.getUserById(userDTO.getId()), "events", eventService.getEventsByUserId(userDTO.getId()), "roles", roleService.getRoles()))
                        .timeStamp(now().toString())
                        .message("Role updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PatchMapping("/update/settings")
    public ResponseEntity<HttpResponse> updateAccountSettings(Authentication authentication, @RequestBody @Valid SettingsForm form) {
        UserDTO userDTO = getAuthenticatedUser(authentication);
        userService.updateAccountSettings(userDTO.getId(), form.getEnabled(), form.getNotLocked());
        publisher.publishEvent(new NewUserEvent(userDTO.getEmail(), ACCOUNT_SETTINGS_UPDATE, userDTO.getOrganizationId()));
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .data(of("user", userService.getUserById(userDTO.getId()), "events", eventService.getEventsByUserId(userDTO.getId()), "roles", roleService.getRoles()))
                        .timeStamp(now().toString())
                        .message("Account settings updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PatchMapping("/togglemfa")
    public ResponseEntity<HttpResponse> toggleMfa(Authentication authentication) throws InterruptedException {
        TimeUnit.SECONDS.sleep(3);
        UserDTO user = userService.toggleMfa(getAuthenticatedUser(authentication).getEmail());
        publisher.publishEvent(new NewUserEvent(user.getEmail(), MFA_UPDATE, user.getOrganizationId()));
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .data(of("user", user, "events", eventService.getEventsByUserId(user.getId()), "roles", roleService.getRoles()))
                        .timeStamp(now().toString())
                        .message("Multi-Factor Authentication updated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PatchMapping("/update/image")
    public ResponseEntity<HttpResponse> updateProfileImage(Authentication authentication, @RequestParam("image") MultipartFile image) throws InterruptedException {
        UserDTO user = getAuthenticatedUser(authentication);
        userService.updateImage(user, image);

        // Sync Client imageUrl if user is a client
        Client client = clientRepository.findByUserId(user.getId());
        if (client != null) {
            client.setImageUrl(user.getImageUrl());
            clientRepository.save(client);
        }

        publisher.publishEvent(new NewUserEvent(user.getEmail(), PROFILE_PICTURE_UPDATE, user.getOrganizationId()));
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .data(of("user", userService.getUserById(user.getId()), "events", eventService.getEventsByUserId(user.getId()), "roles", roleService.getRoles()))
                        .timeStamp(now().toString())
                        .message("Profile image updated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping(value = "/image/{fileName}", produces = IMAGE_PNG_VALUE)
    public byte[] getProfileImage(@PathVariable("fileName") String fileName) throws Exception {
        return fileStorageService.loadFileAsResource("profile-images/" + fileName).getInputStream().readAllBytes();
    }

    @GetMapping("/refresh/token")
    public ResponseEntity<HttpResponse> refreshToken(HttpServletRequest request) {
        log.info("Token refresh request received");

        try {
            String authHeader = request.getHeader(AUTHORIZATION);
            if (authHeader == null || !authHeader.startsWith(TOKEN_PREFIX)) {
                log.warn("Refresh token missing or invalid format");
                return ResponseEntity.status(UNAUTHORIZED).body(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .reason("Refresh token missing or invalid")
                                .status(UNAUTHORIZED)
                                .statusCode(UNAUTHORIZED.value())
                                .build());
            }

            String token = authHeader.substring(TOKEN_PREFIX.length());
            Long userId = tokenProvider.getSubject(token, request);

            if (userId == null || !tokenProvider.isTokenValid(userId, token)) {
                log.warn("Refresh token validation failed");
                return ResponseEntity.status(UNAUTHORIZED).body(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .reason("Refresh token expired or invalid")
                                .status(UNAUTHORIZED)
                                .statusCode(UNAUTHORIZED.value())
                                .build());
            }

            // Extract organizationId from token and set tenant context before getting user
            Long organizationId = tokenProvider.getOrganizationId(token);
            if (organizationId != null) {
                TenantContext.setCurrentTenant(organizationId);
            }

            UserDTO user = userService.getUserById(userId);
            log.info("Token refresh successful for user: {}", user != null ? user.getEmail() : "unknown");

            // Generate new tokens (cache principal to avoid duplicate DB queries)
            UserPrincipal refreshPrincipal = getUserPrincipal(user);
            String newAccessToken = tokenProvider.createAccessToken(refreshPrincipal);
            String newRefreshToken = tokenProvider.createRefreshToken(refreshPrincipal);

            return ResponseEntity.ok().body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("user", user, "access_token", newAccessToken, "refresh_token", newRefreshToken))
                            .message("Token refreshed")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());

        } catch (TokenExpiredException e) {
            log.warn("Refresh token expired: {}", e.getMessage());
            return ResponseEntity.status(UNAUTHORIZED).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .reason("Session expired. Please log in again.")
                            .status(UNAUTHORIZED)
                            .statusCode(UNAUTHORIZED.value())
                            .build());
        } catch (Exception e) {
            log.error("Error during token refresh: {}", e.getMessage());
            return ResponseEntity.status(UNAUTHORIZED).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .reason("Token refresh failed")
                            .status(UNAUTHORIZED)
                            .statusCode(UNAUTHORIZED.value())
                            .build());
        } finally {
            TenantContext.clear();
        }
    }

    private boolean isHeaderAndTokenValid(HttpServletRequest request) {
        try {
            return request.getHeader(AUTHORIZATION) != null
                    && request.getHeader(AUTHORIZATION).startsWith(TOKEN_PREFIX)
                    && tokenProvider.isTokenValid(
                    tokenProvider.getSubject(request.getHeader(AUTHORIZATION).substring(TOKEN_PREFIX.length()), request),
                    request.getHeader(AUTHORIZATION).substring(TOKEN_PREFIX.length())
            );
        } catch (Exception e) {
            log.warn("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    @RequestMapping("/error")
    public ResponseEntity<HttpResponse> handleError(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason("There is no mapping for a " + request.getMethod() + " request for this path on the server")
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value())
                        .build());
    }

    /*@RequestMapping("/error")
    public ResponseEntity<HttpResponse> handleError(HttpServletRequest request) {
        return new ResponseEntity<>(HttpResponse.builder()
                .timeStamp(now().toString())
                .reason("There is no mapping for a " + request.getMethod() + " request for this path on the server")
                .status(NOT_FOUND)
                .statusCode(NOT_FOUND.value())
                .build(), NOT_FOUND);
    }*/

    @GetMapping("/test-delete/{userId}")
    public ResponseEntity<String> testDeleteEndpoint(@PathVariable("userId") Long userId) {
        log.info("🧪 TEST DELETE ENDPOINT REACHED! User ID: {}", userId);
        return ResponseEntity.ok("Test delete endpoint works for user: " + userId);
    }

    @GetMapping("/list")
    public ResponseEntity<HttpResponse> getUsers() {
        // Retrieve users through the service and convert to DTOs
        Collection<User> users = userService.getUsers(0, 1000);
        List<UserDTO> userDTOs = users.stream()
            .map(user -> userService.getUserByEmail(user.getEmail()))
            .collect(Collectors.toList());
            
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("users", userDTOs))
                        .message("Users retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/delete/{userId}")
    @AuditLog(action = "DELETE", entityType = "USER", description = "User account deleted")
    public ResponseEntity<HttpResponse> deleteUser(@PathVariable("userId") Long userId) {
        log.info("DELETE REQUEST REACHED CONTROLLER! User ID: {}", userId);

        // Authentication check
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            log.warn("No authentication found in SecurityContext for delete request");
            return ResponseEntity.status(UNAUTHORIZED).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Authentication required")
                    .status(UNAUTHORIZED)
                    .statusCode(UNAUTHORIZED.value())
                    .build());
        }

        log.info("Delete user request - Principal: {}", auth.getPrincipal());
        log.info("Delete user request - Authorities: {}", auth.getAuthorities());

        // Permission check
        boolean hasPermission = auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("USER:DELETE") ||
                          a.getAuthority().equals("USER:ADMIN") ||
                          a.getAuthority().equals("ROLE_ADMIN"));

        if (!hasPermission) {
            log.warn("User does not have permission to delete users");
            return ResponseEntity.status(FORBIDDEN).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("You don't have permission to delete users")
                    .status(FORBIDDEN)
                    .statusCode(FORBIDDEN.value())
                    .build());
        }

        try {
            userService.deleteUser(userId);
            return ResponseEntity.ok().body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("User deleted successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        } catch (Exception e) {
            log.error("Error deleting user: {}", e.getMessage(), e);
            return ResponseEntity.status(BAD_REQUEST).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to delete user: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build());
        }
    }

    private UserDTO authenticate(String email, String password) {
        // Capture device/IP on request thread for async event processing
        String device = com.bostoneo.bostoneosolutions.utils.RequestUtils.getDevice(request);
        String ipAddress = com.bostoneo.bostoneosolutions.utils.RequestUtils.getIpAddress(request);
        // Fire LOGIN_ATTEMPT event asynchronously without pre-fetching user
        publisher.publishEvent(new NewUserEvent(email, LOGIN_ATTEMPT, null, device, ipAddress));
        try {
            Authentication authentication = authenticationManager.authenticate(unauthenticated(email, password));
            // Reuse the UserPrincipal from authentication — already has roles + permissions
            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            UserDTO loggedInUser = getLoggedInUser(authentication);

            // Add case role assignments (only extra query needed for token)
            Set<com.bostoneo.bostoneosolutions.model.CaseRoleAssignment> caseRoleAssignments = roleService.getCaseRoleAssignments(loggedInUser.getId());
            principal = new UserPrincipal(principal.getUser(), principal.getRoles(), principal.getPermissions(), caseRoleAssignments);
            authenticatedPrincipal.set(principal);

            if(!loggedInUser.isUsingMFA()) {
                publisher.publishEvent(new NewUserEvent(email, LOGIN_ATTEMPT_SUCCESS, loggedInUser.getOrganizationId(), device, ipAddress));
            }
            return loggedInUser;
        } catch (Exception exception) {
            publisher.publishEvent(new NewUserEvent(email, LOGIN_ATTEMPT_FAILURE, null, device, ipAddress));
            processError(request, response, exception);
            throw new ApiException(exception.getMessage());
        }
    }

    private URI getUri() {
        return URI.create(fromCurrentContextPath().path("/user/get/<userId>").toUriString());
    }

    private ResponseEntity<HttpResponse> sendResponse(UserDTO user) {
        // Reuse principal from authentication — avoids 5+ redundant DB queries
        UserPrincipal principal = authenticatedPrincipal.get();
        if (principal == null) {
            // Fallback for non-login flows (e.g., MFA verify)
            principal = getUserPrincipal(user);
        }
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", user, "access_token", tokenProvider.createAccessToken(principal)
                                , "refresh_token", tokenProvider.createRefreshToken(principal)))
                        .message("Login Success")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    private UserPrincipal getUserPrincipal(UserDTO user) {
        User userEntity = toUser(userService.getUserByEmail(user.getEmail()));
        // Get roles and permissions for the user
        Set<Role> roles = roleService.getRolesByUserId(user.getId());
        Set<Permission> permissions = new HashSet<>();
        for (Role role : roles) {
            permissions.addAll(roleService.getPermissionsByRoleId(role.getId()));
        }
        
        // Get case role assignments for the user
        Set<com.bostoneo.bostoneosolutions.model.CaseRoleAssignment> caseRoleAssignments = roleService.getCaseRoleAssignments(user.getId());
        
        return new UserPrincipal(userEntity, roles, permissions, caseRoleAssignments);
    }

    private ResponseEntity<HttpResponse> sendVerificationCode(UserDTO user) {
        userService.sendVerificationCode(user);
        return ResponseEntity.ok().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", user))
                        .message("Verification Code Sent")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
