package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.superadmin.*;
import com.bostoneo.bostoneosolutions.model.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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
     * Resend verification email to user
     */
    void resendVerificationEmail(Long userId);

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
}
