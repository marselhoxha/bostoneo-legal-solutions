package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.OrganizationInvitationRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.OrganizationInvitationService;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
    private final EmailService emailService;
    private final OrganizationService organizationService;
    private final TenantService tenantService;

    @Value("${app.frontend.url:http://localhost:4200}")
    private String frontendUrl;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

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

        // Send invitation email
        sendInvitationEmailAsync(saved, organizationId);

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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        OrganizationInvitation invitation = invitationRepository.findByIdAndOrganizationId(invitationId, orgId)
                .orElseThrow(() -> new ApiException("Invitation not found or access denied"));

        if (invitation.isAccepted()) {
            throw new ApiException("Cannot resend an accepted invitation");
        }

        // Generate new token and extend expiration
        invitation.setToken(UUID.randomUUID().toString());
        invitation.setExpiresAt(LocalDateTime.now().plusDays(7));

        OrganizationInvitation saved = invitationRepository.save(invitation);

        // Resend invitation email
        sendInvitationEmailAsync(saved, saved.getOrganizationId());

        log.info("Resent invitation to: {}", invitation.getEmail());
        return saved;
    }

    @Override
    public void cancelInvitation(Long invitationId) {
        log.info("Cancelling invitation: {}", invitationId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        OrganizationInvitation invitation = invitationRepository.findByIdAndOrganizationId(invitationId, orgId)
                .orElseThrow(() -> new ApiException("Invitation not found or access denied"));

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

    /**
     * Send invitation email asynchronously
     */
    private void sendInvitationEmailAsync(OrganizationInvitation invitation, Long organizationId) {
        try {
            // Get organization name
            String organizationName = organizationService.getOrganizationById(organizationId)
                    .map(org -> org.getName())
                    .orElse("Bostoneo Legal Solutions");

            // Build invitation URL
            String inviteUrl = frontendUrl + "/accept-invite/" + invitation.getToken();

            // Send email asynchronously
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                emailService.sendInvitationEmail(
                        invitation.getEmail(),
                        organizationName,
                        invitation.getRole(),
                        inviteUrl,
                        7 // 7 days expiration
                );
            });
        } catch (Exception e) {
            log.error("Failed to send invitation email: {}", e.getMessage());
            // Don't throw - invitation was created successfully, email failure shouldn't rollback
        }
    }
}
