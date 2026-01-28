package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.OrganizationDTO;
import com.bostoneo.bostoneosolutions.dto.OrganizationStatsDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface OrganizationService {

    /**
     * Create a new organization
     */
    OrganizationDTO createOrganization(OrganizationDTO dto);

    /**
     * Get organization by ID
     */
    Optional<OrganizationDTO> getOrganizationById(Long id);

    /**
     * Get organization entity by ID (for internal use)
     */
    Optional<Organization> getOrganizationEntityById(Long id);

    /**
     * Get organization by slug
     */
    Optional<OrganizationDTO> getOrganizationBySlug(String slug);

    /**
     * Get all organizations
     */
    List<OrganizationDTO> getAllOrganizations();

    /**
     * Update organization
     */
    OrganizationDTO updateOrganization(Long id, OrganizationDTO dto);

    /**
     * Delete organization
     */
    void deleteOrganization(Long id);

    /**
     * Search organizations
     */
    List<OrganizationDTO> searchOrganizations(String query);

    /**
     * Get default organization (ID = 1)
     */
    Organization getDefaultOrganization();

    /**
     * Check if slug is available
     */
    boolean isSlugAvailable(String slug);

    /**
     * Generate unique slug from name
     */
    String generateSlug(String name);

    /**
     * Get organizations with Twilio enabled
     */
    List<Organization> getOrganizationsWithTwilioEnabled();

    /**
     * Update Twilio settings for organization
     */
    OrganizationDTO updateTwilioSettings(Long id, String subaccountSid, String authToken,
                                         String phoneNumber, String whatsappNumber, String friendlyName);

    /**
     * Disable Twilio for organization
     */
    OrganizationDTO disableTwilio(Long id);

    /**
     * Update notification preferences
     */
    OrganizationDTO updateNotificationPreferences(Long id, Boolean smsEnabled, Boolean whatsappEnabled,
                                                   Boolean emailEnabled, Boolean signatureReminderEmail,
                                                   Boolean signatureReminderSms, Boolean signatureReminderWhatsapp,
                                                   String signatureReminderDays);

    /**
     * Get paginated list of all organizations
     */
    Page<OrganizationDTO> getAllOrganizationsPaginated(Pageable pageable);

    /**
     * Get organization statistics
     */
    OrganizationStatsDTO getOrganizationStats(Long organizationId);

    /**
     * Get count of users in an organization
     */
    Integer getUserCountByOrganization(Long organizationId);

    /**
     * Get count of cases in an organization
     */
    Integer getCaseCountByOrganization(Long organizationId);

    /**
     * Get count of documents in an organization
     */
    Integer getDocumentCountByOrganization(Long organizationId);

    /**
     * Get count of clients in an organization
     */
    Integer getClientCountByOrganization(Long organizationId);

    /**
     * Get users belonging to an organization
     */
    Page<UserDTO> getUsersByOrganization(Long organizationId, Pageable pageable);
}
