package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link Attorney#getPracticeAreasList()} — verifies
 * CSV-string → {@code List<PracticeArea>} parsing including null/blank
 * handling, whitespace trimming, and graceful skipping of unknown enum
 * tokens.
 */
class AttorneyPracticeAreasTest {

    private Attorney newAttorneyWith(String csv) {
        Attorney attorney = new Attorney();
        attorney.setPracticeAreas(csv);
        return attorney;
    }

    @Test
    void parsesCommaDelimitedListOfValidEnumValues() {
        assertThat(newAttorneyWith("PERSONAL_INJURY,FAMILY_LAW,IMMIGRATION").getPracticeAreasList())
                .containsExactly(
                        PracticeArea.PERSONAL_INJURY,
                        PracticeArea.FAMILY_LAW,
                        PracticeArea.IMMIGRATION);
    }

    @Test
    void returnsEmptyForNull() {
        assertThat(newAttorneyWith(null).getPracticeAreasList()).isEmpty();
    }

    @Test
    void returnsEmptyForEmptyString() {
        assertThat(newAttorneyWith("").getPracticeAreasList()).isEmpty();
    }

    @Test
    void returnsEmptyForWhitespaceOnlyString() {
        assertThat(newAttorneyWith("   ").getPracticeAreasList()).isEmpty();
    }

    @Test
    void trimsWhitespaceAroundTokens() {
        assertThat(newAttorneyWith("PERSONAL_INJURY, FAMILY_LAW , IMMIGRATION ").getPracticeAreasList())
                .containsExactly(
                        PracticeArea.PERSONAL_INJURY,
                        PracticeArea.FAMILY_LAW,
                        PracticeArea.IMMIGRATION);
    }

    @Test
    void silentlySkipsUnknownEnumTokens() {
        assertThat(newAttorneyWith("PERSONAL_INJURY,MEDICAL_MALPRACTICE,FAMILY_LAW").getPracticeAreasList())
                .containsExactly(PracticeArea.PERSONAL_INJURY, PracticeArea.FAMILY_LAW);
    }

    @Test
    void returnsEmptyForOnlyUnknownTokens() {
        assertThat(newAttorneyWith("FOO,BAR,MEDICAL_MALPRACTICE").getPracticeAreasList()).isEmpty();
    }

    @Test
    void parsesSingleValue() {
        assertThat(newAttorneyWith("PERSONAL_INJURY").getPracticeAreasList())
                .containsExactly(PracticeArea.PERSONAL_INJURY);
    }
}
