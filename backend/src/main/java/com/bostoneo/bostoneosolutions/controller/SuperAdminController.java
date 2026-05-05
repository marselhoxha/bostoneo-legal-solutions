package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.superadmin.*;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.service.SuperAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

/**
 * Controller for SUPERADMIN operations.
 * Provides cross-organization visibility and management capabilities.
 * SECURITY: All endpoints require ROLE_SUPERADMIN
 */
@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ROLE_SUPERADMIN')")
public class SuperAdminController {

    private final SuperAdminService superAdminService;

    /**
     * Get platform-wide statistics for the dashboard
     */
    @GetMapping("/dashboard/stats")
    public ResponseEntity<HttpResponse> getDashboardStats() {
        log.info("SUPERADMIN: Fetching dashboard stats");

        PlatformStatsDTO stats = superAdminService.getPlatformStats();

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("stats", stats))
                .message("Platform statistics retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get all organizations with their stats (paginated)
     */
    @GetMapping("/organizations")
    public ResponseEntity<HttpResponse> getAllOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {

        log.info("SUPERADMIN: Fetching all organizations - page={}, size={}", page, size);

        String validatedSort = com.bostoneo.bostoneosolutions.util.SortValidator.forOrganizations(sortBy);
        Sort sort = sortDir.equalsIgnoreCase("desc")
            ? Sort.by(validatedSort).descending()
            : Sort.by(validatedSort).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);
        Page<OrganizationWithStatsDTO> organizations = superAdminService.getAllOrganizationsWithStats(pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "organizations", organizations.getContent(),
                    "page", Map.of(
                        "number", organizations.getNumber(),
                        "size", organizations.getSize(),
                        "totalElements", organizations.getTotalElements(),
                        "totalPages", organizations.getTotalPages()
                    )
                ))
                .message("Organizations retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Search organizations by name or slug
     */
    @GetMapping("/organizations/search")
    public ResponseEntity<HttpResponse> searchOrganizations(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        log.info("SUPERADMIN: Searching organizations with query: {}", query);

        Pageable pageable = PageRequest.of(page, size);
        Page<OrganizationWithStatsDTO> organizations = superAdminService.searchOrganizations(query, pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "organizations", organizations.getContent(),
                    "page", Map.of(
                        "number", organizations.getNumber(),
                        "size", organizations.getSize(),
                        "totalElements", organizations.getTotalElements(),
                        "totalPages", organizations.getTotalPages()
                    )
                ))
                .message("Search results retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get detailed information about a specific organization
     */
    @GetMapping("/organizations/{id}")
    public ResponseEntity<HttpResponse> getOrganizationDetails(@PathVariable Long id) {
        log.info("SUPERADMIN: Fetching details for organization ID: {}", id);

        OrganizationDetailDTO organization = superAdminService.getOrganizationDetails(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("organization", organization))
                .message("Organization details retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get users belonging to a specific organization (paginated)
     */
    @GetMapping("/organizations/{id}/users")
    public ResponseEntity<HttpResponse> getOrganizationUsers(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        log.info("SUPERADMIN: Fetching users for organization ID: {}", id);

        Pageable pageable = PageRequest.of(page, size);
        Page<UserDTO> users = superAdminService.getOrganizationUsers(id, pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "users", users.getContent(),
                    "page", Map.of(
                        "number", users.getNumber(),
                        "size", users.getSize(),
                        "totalElements", users.getTotalElements(),
                        "totalPages", users.getTotalPages()
                    )
                ))
                .message("Organization users retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Add a user to an existing organization
     */
    @PostMapping("/organizations/{id}/users")
    @AuditLog(action = "CREATE", entityType = "USER", description = "Added user to organization")
    public ResponseEntity<HttpResponse> addUserToOrganization(
            @PathVariable Long id,
            @Valid @RequestBody CreateUserForOrgDTO dto) {
        log.info("SUPERADMIN: Adding user {} to organization ID: {}", dto.getEmail(), id);
        Map<String, Object> result = superAdminService.addUserToOrganization(id, dto);
        return ResponseEntity.status(CREATED).body(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(result)
                .message("User created successfully")
                .status(CREATED)
                .statusCode(CREATED.value())
                .build()
        );
    }

    /**
     * Resend invitation email for a user in a specific organization
     */
    @PostMapping("/organizations/{orgId}/users/{userId}/resend-invitation")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Resent invitation email")
    public ResponseEntity<HttpResponse> resendInvitation(
            @PathVariable Long orgId,
            @PathVariable Long userId) {
        log.info("SUPERADMIN: Resending invitation for user {} in org {}", userId, orgId);

        superAdminService.resendInvitation(orgId, userId);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Invitation email resent successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get all available roles for user assignment
     */
    @GetMapping("/roles")
    public ResponseEntity<HttpResponse> getAvailableRoles() {
        log.info("SUPERADMIN: Fetching available roles");
        var roles = superAdminService.getAvailableRoles();
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("roles", roles))
                .message("Roles retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Suspend an organization
     */
    @PutMapping("/organizations/{id}/suspend")
    @AuditLog(action = "UPDATE", entityType = "ORGANIZATION", description = "Suspended organization")
    public ResponseEntity<HttpResponse> suspendOrganization(@PathVariable Long id) {
        log.info("SUPERADMIN: Suspending organization ID: {}", id);

        superAdminService.suspendOrganization(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Organization suspended successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Activate/reactivate an organization
     */
    @PutMapping("/organizations/{id}/activate")
    @AuditLog(action = "UPDATE", entityType = "ORGANIZATION", description = "Activated organization")
    public ResponseEntity<HttpResponse> activateOrganization(@PathVariable Long id) {
        log.info("SUPERADMIN: Activating organization ID: {}", id);

        superAdminService.activateOrganization(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Organization activated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Soft-delete an organization
     */
    @DeleteMapping("/organizations/{id}")
    @AuditLog(action = "DELETE", entityType = "ORGANIZATION", description = "Deleted organization")
    public ResponseEntity<HttpResponse> deleteOrganization(@PathVariable Long id) {
        log.info("SUPERADMIN: Deleting organization ID: {}", id);

        superAdminService.deleteOrganization(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Organization deleted successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Permanently delete an organization and ALL its data.
     * Audit logs are preserved for compliance.
     * Requires ?confirm=PERMANENT_DELETE as a safety check.
     */
    @DeleteMapping("/organizations/{id}/permanent")
    @AuditLog(action = "DELETE", entityType = "ORGANIZATION", description = "Permanently deleted organization")
    public ResponseEntity<HttpResponse> hardDeleteOrganization(
            @PathVariable Long id,
            @RequestParam String confirm) {
        if (!"PERMANENT_DELETE".equals(confirm)) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Missing or invalid confirmation parameter")
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build());
        }

        log.info("SUPERADMIN: PERMANENTLY DELETING organization {}", id);
        superAdminService.hardDeleteOrganization(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Organization permanently deleted with all data")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get all users across all organizations (paginated)
     */
    @GetMapping("/users")
    public ResponseEntity<HttpResponse> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        log.info("SUPERADMIN: Fetching all users - page={}, size={}", page, size);

        Pageable pageable = PageRequest.of(page, size);
        Page<UserDTO> users = superAdminService.getAllUsers(pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "users", users.getContent(),
                    "page", Map.of(
                        "number", users.getNumber(),
                        "size", users.getSize(),
                        "totalElements", users.getTotalElements(),
                        "totalPages", users.getTotalPages()
                    )
                ))
                .message("Users retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Search users across all organizations
     */
    @GetMapping("/users/search")
    public ResponseEntity<HttpResponse> searchUsers(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        log.info("SUPERADMIN: Searching users with query: {}", query);

        Pageable pageable = PageRequest.of(page, size);
        Page<UserDTO> users = superAdminService.searchUsers(query, pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "users", users.getContent(),
                    "page", Map.of(
                        "number", users.getNumber(),
                        "size", users.getSize(),
                        "totalElements", users.getTotalElements(),
                        "totalPages", users.getTotalPages()
                    )
                ))
                .message("Search results retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get user details
     */
    @GetMapping("/users/{id}")
    public ResponseEntity<HttpResponse> getUserDetails(@PathVariable Long id) {
        log.info("SUPERADMIN: Fetching details for user ID: {}", id);

        UserDetailDTO user = superAdminService.getUserDetails(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("user", user))
                .message("User details retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Reset user password (sends reset email)
     */
    @PostMapping("/users/{id}/reset-password")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Reset user password")
    public ResponseEntity<HttpResponse> resetUserPassword(@PathVariable Long id) {
        log.info("SUPERADMIN: Resetting password for user ID: {}", id);

        superAdminService.resetUserPassword(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Password reset email sent successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Enable or disable a user account
     */
    @PutMapping("/users/{id}/toggle-status")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Toggled user status")
    public ResponseEntity<HttpResponse> toggleUserStatus(
            @PathVariable Long id,
            @RequestParam boolean enabled) {
        log.info("SUPERADMIN: Setting user {} enabled to: {}", id, enabled);

        superAdminService.toggleUserStatus(id, enabled);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("User status updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Enable or disable MFA for a user (SuperAdmin override)
     */
    @PutMapping("/users/{id}/toggle-mfa")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Toggled user MFA status")
    public ResponseEntity<HttpResponse> toggleUserMfa(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        log.info("SUPERADMIN: Setting user {} MFA to: {}", id, enabled);

        superAdminService.toggleUserMfa(id, enabled);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("User MFA status updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * V63 — set the per-user opt-in for the new attorney-facing PI view (P4+).
     * Superadmin curates the beta cohort. Affected users pick up the new flag
     * on next session refresh; until then their currentUser cache still says false.
     */
    @PutMapping("/users/{id}/toggle-beta-attorney-view")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Toggled user beta attorney view")
    public ResponseEntity<HttpResponse> toggleUserBetaAttorneyView(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        log.info("SUPERADMIN: Setting user {} beta_attorney_view to: {}", id, enabled);

        superAdminService.setUserBetaAttorneyView(id, enabled);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("User beta attorney view updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Resend verification email
     */
    @PostMapping("/users/{id}/resend-verification")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Resent verification email")
    public ResponseEntity<HttpResponse> resendVerificationEmail(@PathVariable Long id) {
        log.info("SUPERADMIN: Resending verification email for user ID: {}", id);

        superAdminService.resendVerificationEmail(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Verification email sent successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== CHANGE USER ROLE ====================

    /**
     * Change a user's role
     */
    @PutMapping("/users/{id}/role")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Changed user role")
    public ResponseEntity<HttpResponse> changeUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        String roleName = body.get("roleName");
        if (roleName == null || roleName.isBlank()) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("roleName is required")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }

        log.info("SUPERADMIN: Changing role for user {} to {}", id, roleName);
        superAdminService.changeUserRole(id, roleName);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Role updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Get recent login sessions for a user
     */
    @GetMapping("/users/{id}/sessions")
    public ResponseEntity<HttpResponse> getUserSessions(@PathVariable Long id) {
        log.info("SUPERADMIN: Fetching sessions for user {}", id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("sessions", superAdminService.getUserSessions(id)))
                .message("User sessions retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Terminate all active sessions for a user
     */
    @PostMapping("/users/{id}/terminate-sessions")
    @AuditLog(action = "UPDATE", entityType = "USER", description = "Terminated user sessions")
    public ResponseEntity<HttpResponse> terminateUserSessions(@PathVariable Long id) {
        log.info("SUPERADMIN: Terminating all sessions for user {}", id);

        superAdminService.terminateUserSessions(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("All sessions terminated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Permanently delete a user and all their data.
     * Requires ?confirm=PERMANENT_DELETE as a safety check.
     */
    @DeleteMapping("/users/{id}/permanent")
    @AuditLog(action = "DELETE", entityType = "USER", description = "Permanently deleted user")
    public ResponseEntity<HttpResponse> hardDeleteUser(
            @PathVariable Long id,
            @RequestParam String confirm) {
        if (!"PERMANENT_DELETE".equals(confirm)) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Missing or invalid confirmation parameter")
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build());
        }

        log.info("SUPERADMIN: Permanently deleting user {}", id);
        superAdminService.hardDeleteUser(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("User permanently deleted")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== SYSTEM HEALTH & MONITORING ====================

    /**
     * Get system health status
     */
    @GetMapping("/system/health")
    public ResponseEntity<HttpResponse> getSystemHealth() {
        log.info("SUPERADMIN: Checking system health");

        SystemHealthDTO health = superAdminService.getSystemHealth();

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("health", health))
                .message("System health retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get active sessions (users logged in within a time window)
     */
    @GetMapping("/system/active-sessions")
    public ResponseEntity<HttpResponse> getActiveSessions(
            @RequestParam(defaultValue = "1h") String window) {
        log.info("SUPERADMIN: Fetching active sessions for window: {}", window);

        List<ActiveSessionDTO> sessions = superAdminService.getActiveSessions(window);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("sessions", sessions))
                .message("Active sessions retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get recent login events (paginated)
     */
    @GetMapping("/system/login-events")
    public ResponseEntity<HttpResponse> getLoginEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("SUPERADMIN: Fetching login events page {} size {}", page, size);

        Page<LoginEventDTO> events = superAdminService.getLoginEvents(
            PageRequest.of(page, size));

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "loginEvents", events.getContent(),
                    "page", Map.of(
                        "number", events.getNumber(),
                        "size", events.getSize(),
                        "totalElements", events.getTotalElements(),
                        "totalPages", events.getTotalPages()
                    )
                ))
                .message("Login events retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get platform analytics
     */
    @GetMapping("/analytics")
    public ResponseEntity<HttpResponse> getPlatformAnalytics(
            @RequestParam(defaultValue = "week") String period) {
        log.info("SUPERADMIN: Fetching platform analytics for period: {}", period);

        PlatformAnalyticsDTO analytics = superAdminService.getPlatformAnalytics(period);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("analytics", analytics))
                .message("Platform analytics retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== ORGANIZATION CRUD ====================

    /**
     * Create a new organization
     */
    @PostMapping("/organizations")
    @AuditLog(action = "CREATE", entityType = "ORGANIZATION", description = "Created new organization")
    public ResponseEntity<HttpResponse> createOrganization(@Valid @RequestBody CreateOrganizationDTO dto) {
        log.info("SUPERADMIN: Creating new organization: {}", dto.getName());

        Organization organization = superAdminService.createOrganization(dto);

        return ResponseEntity.status(CREATED).body(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("organization", organization))
                .message("Organization created successfully")
                .status(CREATED)
                .statusCode(CREATED.value())
                .build()
        );
    }

    /**
     * Update an organization
     */
    @PutMapping("/organizations/{id}")
    @AuditLog(action = "UPDATE", entityType = "ORGANIZATION", description = "Updated organization")
    public ResponseEntity<HttpResponse> updateOrganization(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrganizationDTO dto) {
        log.info("SUPERADMIN: Updating organization ID: {}", id);

        Organization organization = superAdminService.updateOrganization(id, dto);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("organization", organization))
                .message("Organization updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== AUDIT LOGS ====================

    /**
     * Get audit logs with filtering
     */
    @GetMapping("/audit-logs")
    public ResponseEntity<HttpResponse> getAuditLogs(
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("SUPERADMIN: Fetching audit logs");

        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLogEntryDTO> logs = superAdminService.getAuditLogs(
            organizationId, userId, action, entityType, startDate, endDate, pageable
        );

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "logs", logs.getContent(),
                    "page", Map.of(
                        "number", logs.getNumber(),
                        "size", logs.getSize(),
                        "totalElements", logs.getTotalElements(),
                        "totalPages", logs.getTotalPages()
                    )
                ))
                .message("Audit logs retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== ANNOUNCEMENTS ====================

    /**
     * Send platform announcement
     */
    @PostMapping("/announcements")
    @AuditLog(action = "CREATE", entityType = "ANNOUNCEMENT", description = "Sent platform announcement")
    public ResponseEntity<HttpResponse> sendAnnouncement(@Valid @RequestBody AnnouncementDTO dto) {
        log.info("SUPERADMIN: Sending announcement: {}", dto.getTitle());

        superAdminService.sendAnnouncement(dto);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Announcement sent successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get all announcements (paginated)
     */
    @GetMapping("/announcements")
    public ResponseEntity<HttpResponse> getAnnouncements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("SUPERADMIN: Fetching announcements - page={}, size={}", page, size);

        Pageable pageable = PageRequest.of(page, size);
        Page<AnnouncementSummaryDTO> announcements = superAdminService.getAnnouncements(pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "announcements", announcements.getContent(),
                    "page", Map.of(
                        "number", announcements.getNumber(),
                        "size", announcements.getSize(),
                        "totalElements", announcements.getTotalElements(),
                        "totalPages", announcements.getTotalPages()
                    )
                ))
                .message("Announcements retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Delete an announcement
     */
    @DeleteMapping("/announcements/{id}")
    @AuditLog(action = "DELETE", entityType = "ANNOUNCEMENT", description = "Deleted announcement")
    public ResponseEntity<HttpResponse> deleteAnnouncement(@PathVariable Long id) {
        log.info("SUPERADMIN: Deleting announcement ID: {}", id);

        superAdminService.deleteAnnouncement(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("Announcement deleted successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== INTEGRATIONS ====================

    /**
     * Get integration status for all organizations
     */
    @GetMapping("/integrations/status")
    public ResponseEntity<HttpResponse> getIntegrationStatus() {
        log.info("SUPERADMIN: Fetching integration status");

        var integrations = superAdminService.getIntegrationStatus();

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("integrations", integrations))
                .message("Integration status retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== SECURITY ====================

    /**
     * Get security overview
     */
    @GetMapping("/security/overview")
    public ResponseEntity<HttpResponse> getSecurityOverview() {
        log.info("SUPERADMIN: Fetching security overview");

        var security = superAdminService.getSecurityOverview();

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("security", security))
                .message("Security overview retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Get failed logins (paginated)
     */
    @GetMapping("/security/failed-logins")
    public ResponseEntity<HttpResponse> getFailedLogins(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("SUPERADMIN: Fetching failed logins - page={}, size={}", page, size);

        Pageable pageable = PageRequest.of(page, size);
        var logins = superAdminService.getFailedLogins(pageable);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "logins", logins.getContent(),
                    "page", Map.of(
                        "number", logins.getNumber(),
                        "size", logins.getSize(),
                        "totalElements", logins.getTotalElements(),
                        "totalPages", logins.getTotalPages()
                    )
                ))
                .message("Failed logins retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== ORGANIZATION FEATURES ====================

    /**
     * Get organization features
     */
    @GetMapping("/organizations/{id}/features")
    public ResponseEntity<HttpResponse> getOrganizationFeatures(@PathVariable Long id) {
        log.info("SUPERADMIN: Fetching features for organization ID: {}", id);

        var features = superAdminService.getOrganizationFeatures(id);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("features", features))
                .message("Organization features retrieved successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    /**
     * Update organization features
     */
    @PutMapping("/organizations/{id}/features")
    @AuditLog(action = "UPDATE", entityType = "ORGANIZATION", description = "Updated organization features")
    public ResponseEntity<HttpResponse> updateOrganizationFeatures(
            @PathVariable Long id,
            @RequestBody OrganizationFeaturesDTO features) {
        log.info("SUPERADMIN: Updating features for organization ID: {}", id);

        var updatedFeatures = superAdminService.updateOrganizationFeatures(id, features);

        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("features", updatedFeatures))
                .message("Organization features updated successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // ==================== DASHBOARD DRILL-DOWNS ====================

    @GetMapping("/dashboard/active-users-by-org")
    public ResponseEntity<HttpResponse> getActiveUsersByOrg() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("organizations", superAdminService.getActiveUsersByOrg()))
            .message("Active users by organization retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/active-users-by-org/{orgId}/users")
    public ResponseEntity<HttpResponse> getActiveUsersForOrg(@PathVariable Long orgId) {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("users", superAdminService.getActiveUsersForOrg(orgId)))
            .message("Active users for organization retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/active-users-by-org/{orgId}/users/{userId}/sessions")
    public ResponseEntity<HttpResponse> getUserSessionsDrillDown(
            @PathVariable Long orgId, @PathVariable Long userId) {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("sessions", superAdminService.getUserSessionsDrillDown(orgId, userId)))
            .message("User sessions retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/requests-by-org")
    public ResponseEntity<HttpResponse> getRequestsByOrg(
            @RequestParam(defaultValue = "1h") String timeWindow) {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("organizations", superAdminService.getRequestsByOrg(timeWindow)))
            .message("API requests by organization retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/requests-by-org/{orgId}/breakdown")
    public ResponseEntity<HttpResponse> getRequestBreakdownForOrg(
            @PathVariable Long orgId,
            @RequestParam(defaultValue = "1h") String timeWindow) {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("breakdown", superAdminService.getRequestBreakdownForOrg(orgId, timeWindow)))
            .message("Request breakdown retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/storage-by-org")
    public ResponseEntity<HttpResponse> getStorageByOrg() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("organizations", superAdminService.getStorageByOrg()))
            .message("Storage by organization retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/errors-by-org")
    public ResponseEntity<HttpResponse> getErrorsByOrg() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("organizations", superAdminService.getErrorsByOrg()))
            .message("Errors by organization retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/security-by-org")
    public ResponseEntity<HttpResponse> getSecurityByOrg() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("organizations", superAdminService.getSecurityByOrg()))
            .message("Security by organization retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/engagement")
    public ResponseEntity<HttpResponse> getEngagementMetrics() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("engagement", superAdminService.getEngagementMetrics()))
            .message("Engagement metrics retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/data-growth")
    public ResponseEntity<HttpResponse> getDataGrowth() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("growth", superAdminService.getDataGrowth()))
            .message("Data growth metrics retrieved")
            .status(OK).statusCode(OK.value()).build());
    }

    @GetMapping("/dashboard/feature-adoption")
    public ResponseEntity<HttpResponse> getFeatureAdoption() {
        return ResponseEntity.ok(HttpResponse.builder()
            .timeStamp(now().toString())
            .data(Map.of("adoption", superAdminService.getFeatureAdoption()))
            .message("Feature adoption retrieved")
            .status(OK).statusCode(OK.value()).build());
    }
}
