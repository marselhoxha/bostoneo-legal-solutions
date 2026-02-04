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

import java.util.Map;

import static java.time.LocalDateTime.now;
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
    @AuditLog(action = "VIEW", entityType = "PLATFORM", description = "Viewed platform dashboard stats")
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
    @AuditLog(action = "VIEW", entityType = "ORGANIZATION", description = "Viewed all organizations")
    public ResponseEntity<HttpResponse> getAllOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {

        log.info("SUPERADMIN: Fetching all organizations - page={}, size={}", page, size);

        Sort sort = sortDir.equalsIgnoreCase("desc")
            ? Sort.by(sortBy).descending()
            : Sort.by(sortBy).ascending();

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
    @AuditLog(action = "SEARCH", entityType = "ORGANIZATION", description = "Searched organizations")
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
    @AuditLog(action = "VIEW", entityType = "ORGANIZATION", description = "Viewed organization details")
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
    @AuditLog(action = "VIEW", entityType = "USER", description = "Viewed organization users")
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
     * Get all users across all organizations (paginated)
     */
    @GetMapping("/users")
    @AuditLog(action = "VIEW", entityType = "USER", description = "Viewed all users")
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
    @AuditLog(action = "SEARCH", entityType = "USER", description = "Searched users")
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
    @AuditLog(action = "VIEW", entityType = "USER", description = "Viewed user details")
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

    // ==================== SYSTEM HEALTH & MONITORING ====================

    /**
     * Get system health status
     */
    @GetMapping("/system/health")
    @AuditLog(action = "VIEW", entityType = "SYSTEM", description = "Viewed system health")
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
     * Get platform analytics
     */
    @GetMapping("/analytics")
    @AuditLog(action = "VIEW", entityType = "ANALYTICS", description = "Viewed platform analytics")
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
    @AuditLog(action = "VIEW", entityType = "AUDIT_LOG", description = "Viewed audit logs")
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
    @AuditLog(action = "VIEW", entityType = "ANNOUNCEMENT", description = "Viewed announcements")
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
    @AuditLog(action = "VIEW", entityType = "INTEGRATION", description = "Viewed integration status")
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
    @AuditLog(action = "VIEW", entityType = "SECURITY", description = "Viewed security overview")
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
    @AuditLog(action = "VIEW", entityType = "SECURITY", description = "Viewed failed logins")
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
    @AuditLog(action = "VIEW", entityType = "ORGANIZATION", description = "Viewed organization features")
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
}
