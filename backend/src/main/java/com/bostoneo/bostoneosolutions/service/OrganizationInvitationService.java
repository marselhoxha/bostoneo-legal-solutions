package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;

import java.util.List;
import java.util.Optional;

public interface OrganizationInvitationService {

    /**
     * Create a new invitation
     */
    OrganizationInvitation createInvitation(Long organizationId, String email, String role, Long createdBy);

    /**
     * Get invitation by token
     */
    Optional<OrganizationInvitation> getByToken(String token);

    /**
     * Get all invitations for an organization
     */
    List<OrganizationInvitation> getByOrganization(Long organizationId);

    /**
     * Get pending invitations for an organization
     */
    List<OrganizationInvitation> getPendingByOrganization(Long organizationId);

    /**
     * Accept an invitation
     */
    OrganizationInvitation acceptInvitation(String token, Long userId);

    /**
     * Resend an invitation (generates new token and expiration)
     */
    OrganizationInvitation resendInvitation(Long invitationId);

    /**
     * Cancel/delete an invitation
     */
    void cancelInvitation(Long invitationId);

    /**
     * Check if email already has pending invitation for organization
     */
    boolean hasPendingInvitation(String email, Long organizationId);

    /**
     * Clean up expired invitations
     */
    void cleanupExpiredInvitations();
}
