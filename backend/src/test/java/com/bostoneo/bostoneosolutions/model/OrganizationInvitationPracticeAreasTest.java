package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link OrganizationInvitation#getPracticeAreasList()} —
 * verifies CSV-string → {@code List<PracticeArea>} parsing including
 * null/blank handling, whitespace trimming, and graceful skipping of
 * unknown enum tokens.
 */
class OrganizationInvitationPracticeAreasTest {

    private OrganizationInvitation newInvitationWith(String csv) {
        OrganizationInvitation invitation = new OrganizationInvitation();
        invitation.setPracticeAreas(csv);
        return invitation;
    }

    @Test
    void parsesCommaDelimitedListOfValidEnumValues() {
        assertThat(newInvitationWith("PERSONAL_INJURY,FAMILY_LAW,IMMIGRATION").getPracticeAreasList())
                .containsExactly(
                        PracticeArea.PERSONAL_INJURY,
                        PracticeArea.FAMILY_LAW,
                        PracticeArea.IMMIGRATION);
    }

    @Test
    void returnsEmptyForNull() {
        assertThat(newInvitationWith(null).getPracticeAreasList()).isEmpty();
    }

    @Test
    void returnsEmptyForEmptyString() {
        assertThat(newInvitationWith("").getPracticeAreasList()).isEmpty();
    }

    @Test
    void returnsEmptyForWhitespaceOnlyString() {
        assertThat(newInvitationWith("   ").getPracticeAreasList()).isEmpty();
    }

    @Test
    void trimsWhitespaceAroundTokens() {
        assertThat(newInvitationWith("PERSONAL_INJURY, FAMILY_LAW , IMMIGRATION ").getPracticeAreasList())
                .containsExactly(
                        PracticeArea.PERSONAL_INJURY,
                        PracticeArea.FAMILY_LAW,
                        PracticeArea.IMMIGRATION);
    }

    @Test
    void silentlySkipsUnknownEnumTokens() {
        assertThat(newInvitationWith("PERSONAL_INJURY,MEDICAL_MALPRACTICE,FAMILY_LAW").getPracticeAreasList())
                .containsExactly(PracticeArea.PERSONAL_INJURY, PracticeArea.FAMILY_LAW);
    }

    @Test
    void returnsEmptyForOnlyUnknownTokens() {
        assertThat(newInvitationWith("FOO,BAR,MEDICAL_MALPRACTICE").getPracticeAreasList()).isEmpty();
    }

    @Test
    void parsesSingleValue() {
        assertThat(newInvitationWith("PERSONAL_INJURY").getPracticeAreasList())
                .containsExactly(PracticeArea.PERSONAL_INJURY);
    }
}
