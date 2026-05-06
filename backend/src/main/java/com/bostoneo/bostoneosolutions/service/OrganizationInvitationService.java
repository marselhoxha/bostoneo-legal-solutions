package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;

import java.util.List;
import java.util.Optional;

public interface OrganizationInvitationService {

    /**
     * Create a new invitation.
     *
     * @param practiceAreas comma-delimited PracticeArea enum names; ignored
     *                      unless {@code role} is ATTORNEY. Caller is
     *                      responsible for validating the value before passing
     *                      it in.
     */
    OrganizationInvitation createInvitation(Long organizationId, String email, String role, Long createdBy,
                                            String practiceAreas);

    /**
     * Backwards-compatible overload — equivalent to passing {@code null} for
     * {@code practiceAreas}.
     */
    default OrganizationInvitation createInvitation(Long organizationId, String email, String role, Long createdBy) {
        return createInvitation(organizationId, email, role, createdBy, null);
    }

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
     * Get invitation by ID
     */
    OrganizationInvitation getInvitationById(Long invitationId);

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
