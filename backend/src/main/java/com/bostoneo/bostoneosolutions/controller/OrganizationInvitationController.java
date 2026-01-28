package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.service.OrganizationInvitationService;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
@Slf4j
public class OrganizationInvitationController {

    private final OrganizationInvitationService invitationService;
    private final OrganizationService organizationService;
    private final TenantService tenantService;

    /**
     * Get all invitations for current organization
     */
    @GetMapping("/invitations")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> getInvitations() {
        Long orgId = tenantService.requireCurrentOrganizationId();
        List<OrganizationInvitation> invitations = invitationService.getByOrganization(orgId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("invitations", invitations))
                        .message("Invitations retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get pending invitations for current organization
     */
    @GetMapping("/invitations/pending")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> getPendingInvitations() {
        Long orgId = tenantService.requireCurrentOrganizationId();
        List<OrganizationInvitation> invitations = invitationService.getPendingByOrganization(orgId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("invitations", invitations))
                        .message("Pending invitations retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Create a new invitation
     */
    @PostMapping("/invitations")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    @AuditLog(action = "CREATE", entityType = "INVITATION", description = "Sent invitation to user")
    public ResponseEntity<HttpResponse> createInvitation(@RequestBody InvitationRequest request) {
        User currentUser = tenantService.requireCurrentUser();
        Long orgId = tenantService.requireCurrentOrganizationId();

        log.info("Creating invitation for {} to organization {}", request.email(), orgId);

        OrganizationInvitation invitation = invitationService.createInvitation(
                orgId,
                request.email(),
                request.role(),
                currentUser.getId()
        );

        return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("invitation", invitation))
                        .message("Invitation sent successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build()
        );
    }

    /**
     * Resend an invitation
     */
    @PostMapping("/invitations/{id}/resend")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> resendInvitation(@PathVariable Long id) {
        OrganizationInvitation invitation = invitationService.resendInvitation(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("invitation", invitation))
                        .message("Invitation resent successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Cancel an invitation
     */
    @DeleteMapping("/invitations/{id}")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    @AuditLog(action = "DELETE", entityType = "INVITATION", description = "Cancelled invitation")
    public ResponseEntity<HttpResponse> cancelInvitation(@PathVariable Long id) {
        invitationService.cancelInvitation(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Invitation cancelled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Validate an invitation token (public endpoint for registration flow)
     */
    @GetMapping("/invitations/validate/{token}")
    public ResponseEntity<HttpResponse> validateInvitation(@PathVariable String token) {
        var invitationOpt = invitationService.getByToken(token);

        if (invitationOpt.isEmpty()) {
            return ResponseEntity.status(NOT_FOUND).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Invalid invitation token")
                            .status(NOT_FOUND)
                            .statusCode(NOT_FOUND.value())
                            .build()
            );
        }

        OrganizationInvitation invitation = invitationOpt.get();

        if (invitation.isExpired()) {
            return ResponseEntity.status(GONE).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("This invitation has expired")
                            .status(GONE)
                            .statusCode(GONE.value())
                            .build()
            );
        }

        if (invitation.isAccepted()) {
            return ResponseEntity.status(GONE).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("This invitation has already been used")
                            .status(GONE)
                            .statusCode(GONE.value())
                            .build()
            );
        }

        // Get organization name
        String organizationName = organizationService.getOrganizationById(invitation.getOrganizationId())
                .map(org -> org.getName())
                .orElse("Organization");

        Map<String, Object> data = new HashMap<>();
        data.put("valid", true);
        data.put("email", invitation.getEmail());
        data.put("role", invitation.getRole());
        data.put("organizationId", invitation.getOrganizationId());
        data.put("organizationName", organizationName);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(data)
                        .message("Invitation is valid")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Accept an invitation (called after user registration)
     */
    @PostMapping("/invitations/accept/{token}")
    @AuditLog(action = "UPDATE", entityType = "INVITATION", description = "User accepted invitation and joined organization")
    public ResponseEntity<HttpResponse> acceptInvitation(@PathVariable String token) {
        User currentUser = tenantService.requireCurrentUser();

        OrganizationInvitation invitation = invitationService.acceptInvitation(token, currentUser.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("invitation", invitation))
                        .message("You have joined the organization successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // Request record for creating invitations
    public record InvitationRequest(String email, String role) {}
}
