package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.service.OrganizationInvitationService;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies the practice-area validation rules added to
 * {@link OrganizationInvitationController#createInvitation}:
 *
 * <ul>
 *   <li>ATTORNEY invitations require a non-empty {@code practiceAreas}</li>
 *   <li>ATTORNEY {@code practiceAreas} must be a subset of the org's
 *       {@code enabledPracticeAreas}</li>
 *   <li>Non-ATTORNEY invitations ignore {@code practiceAreas}</li>
 * </ul>
 *
 * Uses Mockito to drive the controller directly — the project does not have
 * any {@code @SpringBootTest} infrastructure, so a focused unit test matches
 * the existing test style.
 */
class OrganizationInvitationPracticeAreaSubsetTest {

    private static final Long ORG_ID = 100L;
    private static final Long CURRENT_USER_ID = 7L;

    private OrganizationInvitationService invitationService;
    private OrganizationService organizationService;
    private TenantService tenantService;
    private OrganizationInvitationController controller;

    @BeforeEach
    void setUp() {
        invitationService = mock(OrganizationInvitationService.class);
        organizationService = mock(OrganizationService.class);
        tenantService = mock(TenantService.class);

        // Default tenant context: orgId = 100, current user id = 7.
        User currentUser = new User();
        currentUser.setId(CURRENT_USER_ID);
        when(tenantService.requireCurrentUser()).thenReturn(currentUser);
        when(tenantService.requireCurrentOrganizationId()).thenReturn(ORG_ID);

        controller = new OrganizationInvitationController(invitationService, organizationService, tenantService);
    }

    private void mockOrgWithEnabled(String enabled) {
        Organization org = new Organization();
        org.setId(ORG_ID);
        org.setEnabledPracticeAreas(enabled);
        when(organizationService.getOrganizationEntityById(ORG_ID)).thenReturn(Optional.of(org));
    }

    private void mockInvitationServiceReturns() {
        // Echo back a saved invitation so the controller can build a 201 response.
        when(invitationService.createInvitation(anyLong(), anyString(), anyString(), anyLong(), any()))
                .thenAnswer(inv -> {
                    OrganizationInvitation saved = OrganizationInvitation.builder()
                            .id(1L)
                            .organizationId(inv.getArgument(0))
                            .email(inv.getArgument(1))
                            .role(inv.getArgument(2))
                            .createdBy(inv.getArgument(3))
                            .practiceAreas(inv.getArgument(4))
                            .token("test-token")
                            .build();
                    return saved;
                });
    }

    // ──────────────────────────────────────────────────────────────────
    // Happy path: subset accepted
    // ──────────────────────────────────────────────────────────────────

    @Test
    void attorneyInvitation_withSubsetPracticeAreas_succeeds() {
        mockOrgWithEnabled("PERSONAL_INJURY,FAMILY_LAW,CRIMINAL_DEFENSE");
        mockInvitationServiceReturns();

        var request = new OrganizationInvitationController.InvitationRequest(
                "alice@firm.test", "ATTORNEY", "PERSONAL_INJURY,FAMILY_LAW");

        ResponseEntity<HttpResponse> response = controller.createInvitation(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(invitationService).createInvitation(
                eq(ORG_ID),
                eq("alice@firm.test"),
                eq("ATTORNEY"),
                eq(CURRENT_USER_ID),
                eq("PERSONAL_INJURY,FAMILY_LAW"));
    }

    // ──────────────────────────────────────────────────────────────────
    // Subset rule violated: 400
    // ──────────────────────────────────────────────────────────────────

    @Test
    void attorneyInvitation_withPracticeAreaNotEnabled_throws400() {
        mockOrgWithEnabled("PERSONAL_INJURY");

        var request = new OrganizationInvitationController.InvitationRequest(
                "alice@firm.test", "ATTORNEY", "PERSONAL_INJURY,FAMILY_LAW");

        assertThatThrownBy(() -> controller.createInvitation(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("FAMILY_LAW")
                .hasMessageContaining("not enabled");

        verify(invitationService, never()).createInvitation(anyLong(), anyString(), anyString(), anyLong(), any());
    }

    // ──────────────────────────────────────────────────────────────────
    // Empty practiceAreas for ATTORNEY: 400
    // ──────────────────────────────────────────────────────────────────

    @Test
    void attorneyInvitation_withEmptyPracticeAreas_throws400() {
        mockOrgWithEnabled("PERSONAL_INJURY,FAMILY_LAW");

        var request = new OrganizationInvitationController.InvitationRequest(
                "alice@firm.test", "ATTORNEY", "");

        assertThatThrownBy(() -> controller.createInvitation(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("practice area");

        verify(invitationService, never()).createInvitation(anyLong(), anyString(), anyString(), anyLong(), any());
    }

    @Test
    void attorneyInvitation_withNullPracticeAreas_throws400() {
        mockOrgWithEnabled("PERSONAL_INJURY,FAMILY_LAW");

        var request = new OrganizationInvitationController.InvitationRequest(
                "alice@firm.test", "ATTORNEY", null);

        assertThatThrownBy(() -> controller.createInvitation(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("practice area");

        verify(invitationService, never()).createInvitation(anyLong(), anyString(), anyString(), anyLong(), any());
    }

    // ──────────────────────────────────────────────────────────────────
    // Non-ATTORNEY roles ignore practiceAreas
    // ──────────────────────────────────────────────────────────────────

    @Test
    void paralegalInvitation_withNullPracticeAreas_succeeds() {
        // Note: org lookup not needed for non-ATTORNEY roles.
        mockInvitationServiceReturns();

        var request = new OrganizationInvitationController.InvitationRequest(
                "bob@firm.test", "PARALEGAL", null);

        ResponseEntity<HttpResponse> response = controller.createInvitation(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        // practiceAreas should be passed as null, not whatever request had.
        verify(invitationService).createInvitation(
                eq(ORG_ID),
                eq("bob@firm.test"),
                eq("PARALEGAL"),
                eq(CURRENT_USER_ID),
                eq((String) null));
    }

    @Test
    void paralegalInvitation_withPracticeAreasSet_isAcceptedAndIgnored() {
        mockInvitationServiceReturns();

        var request = new OrganizationInvitationController.InvitationRequest(
                "bob@firm.test", "PARALEGAL", "PERSONAL_INJURY");

        ResponseEntity<HttpResponse> response = controller.createInvitation(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        // Even though the JSON included practiceAreas, it MUST be dropped to
        // null for non-ATTORNEY roles — we don't want stray data on the row.
        verify(invitationService).createInvitation(
                eq(ORG_ID),
                eq("bob@firm.test"),
                eq("PARALEGAL"),
                eq(CURRENT_USER_ID),
                eq((String) null));
    }

    // ──────────────────────────────────────────────────────────────────
    // ROLE_ prefix tolerated
    // ──────────────────────────────────────────────────────────────────

    @Test
    void attorneyRoleWithRolePrefix_isRecognized() {
        mockOrgWithEnabled("PERSONAL_INJURY,FAMILY_LAW");
        mockInvitationServiceReturns();

        var request = new OrganizationInvitationController.InvitationRequest(
                "alice@firm.test", "ROLE_ATTORNEY", "PERSONAL_INJURY");

        ResponseEntity<HttpResponse> response = controller.createInvitation(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(invitationService).createInvitation(
                eq(ORG_ID),
                eq("alice@firm.test"),
                eq("ROLE_ATTORNEY"),
                eq(CURRENT_USER_ID),
                eq("PERSONAL_INJURY"));
    }
}
