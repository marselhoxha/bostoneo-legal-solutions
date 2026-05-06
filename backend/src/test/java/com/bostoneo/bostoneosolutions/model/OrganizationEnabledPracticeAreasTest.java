package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link Organization#getEnabledPracticeAreasList()} —
 * verifies CSV-string → {@code List<PracticeArea>} parsing including
 * null/blank handling, whitespace trimming, and graceful skipping of
 * unknown enum tokens.
 */
class OrganizationEnabledPracticeAreasTest {

    private Organization newOrgWith(String csv) {
        Organization org = new Organization();
        org.setEnabledPracticeAreas(csv);
        return org;
    }

    @Test
    void parsesCommaDelimitedListOfValidEnumValues() {
        assertThat(newOrgWith("PERSONAL_INJURY,FAMILY_LAW,IMMIGRATION").getEnabledPracticeAreasList())
                .containsExactly(
                        PracticeArea.PERSONAL_INJURY,
                        PracticeArea.FAMILY_LAW,
                        PracticeArea.IMMIGRATION);
    }

    @Test
    void returnsEmptyForNull() {
        assertThat(newOrgWith(null).getEnabledPracticeAreasList()).isEmpty();
    }

    @Test
    void returnsEmptyForEmptyString() {
        assertThat(newOrgWith("").getEnabledPracticeAreasList()).isEmpty();
    }

    @Test
    void returnsEmptyForWhitespaceOnlyString() {
        assertThat(newOrgWith("   ").getEnabledPracticeAreasList()).isEmpty();
    }

    @Test
    void trimsWhitespaceAroundTokens() {
        assertThat(newOrgWith("PERSONAL_INJURY, FAMILY_LAW , IMMIGRATION ").getEnabledPracticeAreasList())
                .containsExactly(
                        PracticeArea.PERSONAL_INJURY,
                        PracticeArea.FAMILY_LAW,
                        PracticeArea.IMMIGRATION);
    }

    @Test
    void silentlySkipsUnknownEnumTokens() {
        assertThat(newOrgWith("PERSONAL_INJURY,MEDICAL_MALPRACTICE,FAMILY_LAW").getEnabledPracticeAreasList())
                .containsExactly(PracticeArea.PERSONAL_INJURY, PracticeArea.FAMILY_LAW);
    }

    @Test
    void returnsEmptyForOnlyUnknownTokens() {
        assertThat(newOrgWith("FOO,BAR,MEDICAL_MALPRACTICE").getEnabledPracticeAreasList()).isEmpty();
    }

    @Test
    void parsesSingleValue() {
        assertThat(newOrgWith("PERSONAL_INJURY").getEnabledPracticeAreasList())
                .containsExactly(PracticeArea.PERSONAL_INJURY);
    }
}
