package com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury;

import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiInsightDto;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pins the access-control invariant on the PI dashboard endpoint: only
 * attorneys whose {@code practiceAreas} include {@code PERSONAL_INJURY}
 * may call the {@code /insights} handler. Everyone else gets
 * {@code 403 FORBIDDEN}.
 *
 * <p>Mirrors the existing test style in
 * {@link com.bostoneo.bostoneosolutions.controller.OrganizationInvitationPracticeAreaSubsetTest}
 * — Mockito + plain JUnit 5, no {@code @SpringBootTest}. The service is
 * mocked so these tests focus on the controller's authorization logic, not
 * algorithm correctness.</p>
 */
class PersonalInjuryDashboardSecurityTest {

    private static final Long USER_ID = 42L;
    private static final Long ATTORNEY_ID = 7L;
    private static final Long ORG_ID = 100L;

    private PersonalInjuryDashboardService service;
    private AttorneyRepository attorneyRepository;
    private PersonalInjuryDashboardController controller;

    @BeforeEach
    void setUp() {
        service = mock(PersonalInjuryDashboardService.class);
        attorneyRepository = mock(AttorneyRepository.class);
        controller = new PersonalInjuryDashboardController(service, attorneyRepository);

        // Service responses are non-null so we can assert 200-style success.
        when(service.getInsights(anyLong())).thenReturn(List.of(
                new PiInsightDto("gap", "Treatment gap", "ri-flashlight-fill",
                        "orange", "Test Client", "desc", "Generate analysis", 1L)
        ));
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    private Authentication authFor(Long userId) {
        UserDTO dto = new UserDTO();
        dto.setId(userId);
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(dto);
        return auth;
    }

    private void mockAttorney(String practiceAreasCsv) {
        Attorney attorney = Attorney.builder()
                .id(ATTORNEY_ID)
                .userId(USER_ID)
                .organizationId(ORG_ID)
                .practiceAreas(practiceAreasCsv)
                .isActive(true)
                .build();
        when(attorneyRepository.findByUserId(USER_ID)).thenReturn(Optional.of(attorney));
    }

    // ──────────────────────────────────────────────────────────────────
    // Happy path: PERSONAL_INJURY scope grants access
    // ──────────────────────────────────────────────────────────────────

    @Test
    void insights_personalInjuryAttorney_returnsBody() {
        mockAttorney("PERSONAL_INJURY");

        List<PiInsightDto> body = controller.getInsights(authFor(USER_ID));

        assertThat(body).isNotNull().isNotEmpty();
    }

    // ──────────────────────────────────────────────────────────────────
    // Multi-practice attorney that includes PI: still allowed
    // ──────────────────────────────────────────────────────────────────

    @Test
    void insights_multiPracticeAreaIncludingPi_returnsBody() {
        mockAttorney("PERSONAL_INJURY,FAMILY_LAW");

        List<PiInsightDto> body = controller.getInsights(authFor(USER_ID));

        assertThat(body).isNotNull().isNotEmpty();
    }

    // ──────────────────────────────────────────────────────────────────
    // Wrong practice area: 403
    // ──────────────────────────────────────────────────────────────────

    @Test
    void insights_familyLawOnly_throws403() {
        mockAttorney("FAMILY_LAW");

        assertThatThrownBy(() -> controller.getInsights(authFor(USER_ID)))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ──────────────────────────────────────────────────────────────────
    // Empty practiceAreas: 403
    // ──────────────────────────────────────────────────────────────────

    @Test
    void insights_emptyPracticeAreas_throws403() {
        mockAttorney("");

        assertThatThrownBy(() -> controller.getInsights(authFor(USER_ID)))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ──────────────────────────────────────────────────────────────────
    // No attorney row at all (e.g. org admin): 403
    // ──────────────────────────────────────────────────────────────────

    @Test
    void insights_noAttorneyRow_throws403() {
        when(attorneyRepository.findByUserId(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.getInsights(authFor(USER_ID)))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }
}
