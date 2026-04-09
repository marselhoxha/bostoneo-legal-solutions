package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.superadmin.*;
import com.bostoneo.bostoneosolutions.model.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * Service interface for SUPERADMIN operations.
 * Bypasses tenant filtering to provide cross-organization visibility.
 */
public interface SuperAdminService {

    // ==================== DASHBOARD ====================

    /**
     * Get platform-wide statistics for the dashboard
     */
    PlatformStatsDTO getPlatformStats();

    /**
     * Get system health information
     */
    SystemHealthDTO getSystemHealth();

    /**
     * Get platform analytics data
     */
    PlatformAnalyticsDTO getPlatformAnalytics(String period);

    // ==================== ORGANIZATIONS ====================

    /**
     * Get all organizations with their stats (paginated)
     */
    Page<OrganizationWithStatsDTO> getAllOrganizationsWithStats(Pageable pageable);

    /**
     * Get detailed information about a specific organization
     */
    OrganizationDetailDTO getOrganizationDetails(Long organizationId);

    /**
     * Search organizations by name or slug
     */
    Page<OrganizationWithStatsDTO> searchOrganizations(String query, Pageable pageable);

    /**
     * Create a new organization with admin user
     */
    Organization createOrganization(CreateOrganizationDTO dto);

    /**
     * Update an organization
     */
    Organization updateOrganization(Long organizationId, UpdateOrganizationDTO dto);

    /**
     * Suspend an organization
     */
    void suspendOrganization(Long organizationId);

    /**
     * Activate/reactivate an organization
     */
    void activateOrganization(Long organizationId);

    /**
     * Soft-delete an organization (set status to DELETED, disable all users)
     */
    void deleteOrganization(Long organizationId);

    /**
     * Permanently delete an organization and ALL its data from the database.
     * Audit logs are preserved for compliance.
     */
    void hardDeleteOrganization(Long organizationId);

    // ==================== USERS ====================

    /**
     * Get users belonging to a specific organization (paginated)
     */
    Page<UserDTO> getOrganizationUsers(Long organizationId, Pageable pageable);

    /**
     * Get all users across all organizations (paginated)
     */
    Page<UserDTO> getAllUsers(Pageable pageable);

    /**
     * Search users across all organizations
     */
    Page<UserDTO> searchUsers(String query, Pageable pageable);

    /**
     * Get detailed user information
     */
    UserDetailDTO getUserDetails(Long userId);

    /**
     * Reset a user's password (sends reset email)
     * NOTE: Impersonation removed for 201 CMR 17.00, HIPAA, SOC 2 compliance
     */
    void resetUserPassword(Long userId);

    /**
     * Enable or disable a user account
     */
    void toggleUserStatus(Long userId, boolean enabled);

    /**
     * Permanently delete a user and ALL their data from the database.
     * Audit logs are anonymized (user_id set to null) for compliance.
     */
    void hardDeleteUser(Long userId);

    /**
     * Enable or disable MFA for a user (SuperAdmin override — no phone check)
     */
    void toggleUserMfa(Long userId, boolean enabled);

    /**
     * Resend verification email to user
     */
    void resendVerificationEmail(Long userId);

    /**
     * Add a user to an existing organization
     */
    Map<String, Object> addUserToOrganization(Long organizationId, CreateUserForOrgDTO dto);

    /**
     * Resend invitation email for a user in a specific organization
     */
    void resendInvitation(Long organizationId, Long userId);

    /**
     * Get all available roles for user assignment
     */
    java.util.List<RoleSummaryDTO> getAvailableRoles();

    /**
     * Change a user's role
     */
    void changeUserRole(Long userId, String roleName);

    /**
     * Get recent login sessions for a user
     */
    java.util.List<Map<String, Object>> getUserSessions(Long userId);

    /**
     * Terminate all active sessions for a user
     */
    void terminateUserSessions(Long userId);

    // ==================== AUDIT LOGS ====================

    /**
     * Get audit logs with filtering
     */
    Page<AuditLogEntryDTO> getAuditLogs(Long organizationId, Long userId, String action,
                                         String entityType, String startDate, String endDate,
                                         Pageable pageable);

    // ==================== ANNOUNCEMENTS ====================

    /**
     * Send platform announcement
     */
    void sendAnnouncement(AnnouncementDTO announcement);

    /**
     * Get all announcements (paginated)
     */
    Page<AnnouncementSummaryDTO> getAnnouncements(Pageable pageable);

    /**
     * Delete an announcement
     */
    void deleteAnnouncement(Long announcementId);

    // ==================== INTEGRATIONS ====================

    /**
     * Get integration status for all organizations
     */
    java.util.List<IntegrationStatusDTO> getIntegrationStatus();

    // ==================== SECURITY ====================

    /**
     * Get security overview
     */
    SecurityOverviewDTO getSecurityOverview();

    /**
     * Get failed logins (paginated)
     */
    Page<FailedLoginDTO> getFailedLogins(Pageable pageable);

    // ==================== ORGANIZATION FEATURES ====================

    /**
     * Get organization features
     */
    OrganizationFeaturesDTO getOrganizationFeatures(Long organizationId);

    /**
     * Update organization features
     */
    OrganizationFeaturesDTO updateOrganizationFeatures(Long organizationId, OrganizationFeaturesDTO features);

    // ==================== SYSTEM HEALTH SESSIONS ====================

    /**
     * Get currently active sessions (users who logged in within the given time window)
     */
    List<ActiveSessionDTO> getActiveSessions(String window);

    /**
     * Get recent login events (success + failure) across the platform, paginated
     */
    Page<LoginEventDTO> getLoginEvents(Pageable pageable);

    // ==================== DASHBOARD DRILL-DOWNS ====================

    List<DashboardDrillDownDTO.OrgActiveUsers> getActiveUsersByOrg();
    List<DashboardDrillDownDTO.UserActivity> getActiveUsersForOrg(Long orgId);
    List<DashboardDrillDownDTO.UserSession> getUserSessionsDrillDown(Long orgId, Long userId);

    List<DashboardDrillDownDTO.OrgApiRequests> getRequestsByOrg(String timeWindow);
    List<DashboardDrillDownDTO.EndpointBreakdown> getRequestBreakdownForOrg(Long orgId, String timeWindow);

    List<DashboardDrillDownDTO.OrgStorage> getStorageByOrg();
    List<DashboardDrillDownDTO.OrgErrors> getErrorsByOrg();
    List<DashboardDrillDownDTO.OrgSecurity> getSecurityByOrg();

    // ==================== ENGAGEMENT & GROWTH ====================

    DashboardDrillDownDTO.EngagementMetrics getEngagementMetrics();
    DashboardDrillDownDTO.DataGrowth getDataGrowth();
    DashboardDrillDownDTO.FeatureAdoption getFeatureAdoption();
}
