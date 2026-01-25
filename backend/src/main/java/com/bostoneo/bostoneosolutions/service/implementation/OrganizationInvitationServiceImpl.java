package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.OrganizationInvitationRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.OrganizationInvitationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class OrganizationInvitationServiceImpl implements OrganizationInvitationService {

    private final OrganizationInvitationRepository invitationRepository;
    private final UserRepository<User> userRepository;

    @Override
    public OrganizationInvitation createInvitation(Long organizationId, String email, String role, Long createdBy) {
        log.info("Creating invitation for email: {} to organization: {}", email, organizationId);

        // Check if user already exists in the organization
        User existingUser = userRepository.findByEmail(email);
        if (existingUser != null && organizationId.equals(existingUser.getOrganizationId())) {
            throw new ApiException("User is already a member of this organization");
        }

        // Check for pending invitation
        if (hasPendingInvitation(email, organizationId)) {
            throw new ApiException("An invitation has already been sent to this email");
        }

        OrganizationInvitation invitation = OrganizationInvitation.builder()
                .organizationId(organizationId)
                .email(email.toLowerCase().trim())
                .role(role != null ? role : "USER")
                .token(UUID.randomUUID().toString())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .createdBy(createdBy)
                .build();

        OrganizationInvitation saved = invitationRepository.save(invitation);
        log.info("Created invitation ID: {} for email: {}", saved.getId(), email);

        // TODO: Send invitation email
        // emailService.sendInvitationEmail(invitation);

        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OrganizationInvitation> getByToken(String token) {
        return invitationRepository.findByToken(token);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrganizationInvitation> getByOrganization(Long organizationId) {
        return invitationRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrganizationInvitation> getPendingByOrganization(Long organizationId) {
        return invitationRepository.findPendingByOrganizationId(organizationId, LocalDateTime.now());
    }

    @Override
    public OrganizationInvitation acceptInvitation(String token, Long userId) {
        log.info("Accepting invitation with token for user: {}", userId);

        OrganizationInvitation invitation = invitationRepository.findByToken(token)
                .orElseThrow(() -> new ApiException("Invalid invitation token"));

        if (invitation.isExpired()) {
            throw new ApiException("This invitation has expired");
        }

        if (invitation.isAccepted()) {
            throw new ApiException("This invitation has already been used");
        }

        // Update user's organization
        User user = userRepository.get(userId);
        if (user == null) {
            throw new ApiException("User not found");
        }

        user.setOrganizationId(invitation.getOrganizationId());
        userRepository.update(user);

        // Mark invitation as accepted
        invitation.accept();
        OrganizationInvitation saved = invitationRepository.save(invitation);

        log.info("User {} joined organization {} via invitation {}",
                userId, invitation.getOrganizationId(), invitation.getId());

        return saved;
    }

    @Override
    public OrganizationInvitation resendInvitation(Long invitationId) {
        log.info("Resending invitation: {}", invitationId);

        OrganizationInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ApiException("Invitation not found"));

        if (invitation.isAccepted()) {
            throw new ApiException("Cannot resend an accepted invitation");
        }

        // Generate new token and extend expiration
        invitation.setToken(UUID.randomUUID().toString());
        invitation.setExpiresAt(LocalDateTime.now().plusDays(7));

        OrganizationInvitation saved = invitationRepository.save(invitation);

        // TODO: Send invitation email
        // emailService.sendInvitationEmail(invitation);

        log.info("Resent invitation to: {}", invitation.getEmail());
        return saved;
    }

    @Override
    public void cancelInvitation(Long invitationId) {
        log.info("Cancelling invitation: {}", invitationId);

        OrganizationInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ApiException("Invitation not found"));

        if (invitation.isAccepted()) {
            throw new ApiException("Cannot cancel an accepted invitation");
        }

        invitationRepository.delete(invitation);
        log.info("Cancelled invitation for: {}", invitation.getEmail());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasPendingInvitation(String email, Long organizationId) {
        return invitationRepository.existsPendingByEmailAndOrganization(
                email.toLowerCase().trim(), organizationId, LocalDateTime.now());
    }

    @Override
    public void cleanupExpiredInvitations() {
        log.info("Cleaning up expired invitations");
        // Delete invitations expired more than 30 days ago
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        invitationRepository.deleteByExpiresAtBefore(cutoff);
    }
}
