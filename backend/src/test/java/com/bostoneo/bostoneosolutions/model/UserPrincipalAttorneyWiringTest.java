package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the contract between {@link UserPrincipal#setAttorney(Attorney)}
 * and {@link UserPrincipal#getPracticeAreas()}.
 *
 * <p>Phase 3 wires {@code UserPrincipal.attorney} during authentication
 * (see {@code UserRepositoryImpl.loadUserByUsername} and
 * {@code UserResource.getUserPrincipal}). Per-request access to
 * {@code getPracticeAreas()} flows through the setter — these tests verify
 * the three states the auth path produces.</p>
 */
class UserPrincipalAttorneyWiringTest {

    private UserPrincipal principalFor(User user) {
        return new UserPrincipal(user, new HashSet<>(), new HashSet<>(), new HashSet<>());
    }

    private User newUser(long id) {
        User u = new User();
        u.setId(id);
        return u;
    }

    @Test
    void principalWithAttorneyRow_returnsParsedPracticeAreas() {
        Attorney attorney = Attorney.builder()
                .id(10L)
                .userId(1L)
                .practiceAreas("PERSONAL_INJURY,FAMILY_LAW")
                .build();

        UserPrincipal principal = principalFor(newUser(1L));
        principal.setAttorney(attorney);

        List<PracticeArea> areas = principal.getPracticeAreas();

        assertThat(areas)
                .containsExactly(PracticeArea.PERSONAL_INJURY, PracticeArea.FAMILY_LAW);
    }

    @Test
    void principalWithoutAttorneyRow_returnsEmptyList() {
        // Mirrors a non-attorney user (org admin, paralegal, superadmin) where
        // attorneyRepository.findByUserId(...) returns empty during auth.
        UserPrincipal principal = principalFor(newUser(2L));

        assertThat(principal.getAttorney()).isNull();
        assertThat(principal.getPracticeAreas()).isEmpty();
    }

    @Test
    void attorneyWithNullPracticeAreas_returnsEmptyList() {
        Attorney attorney = Attorney.builder()
                .id(11L)
                .userId(3L)
                .practiceAreas(null)
                .build();

        UserPrincipal principal = principalFor(newUser(3L));
        principal.setAttorney(attorney);

        assertThat(principal.getPracticeAreas()).isEmpty();
    }

    @Test
    void attorneyWithBlankPracticeAreas_returnsEmptyList() {
        Attorney attorney = Attorney.builder()
                .id(12L)
                .userId(4L)
                .practiceAreas("   ")
                .build();

        UserPrincipal principal = principalFor(newUser(4L));
        principal.setAttorney(attorney);

        assertThat(principal.getPracticeAreas()).isEmpty();
    }
}
