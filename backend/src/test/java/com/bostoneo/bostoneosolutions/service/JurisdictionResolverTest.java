package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Tests for JurisdictionResolver — state code lookups, court labels,
 * and Federal jurisdiction handling.
 */
class JurisdictionResolverTest {

    private JurisdictionResolver resolver;

    @BeforeEach
    void setUp() {
        // OrganizationRepository is only used for org-based resolution, not for static map lookups
        OrganizationRepository orgRepo = mock(OrganizationRepository.class);
        resolver = new JurisdictionResolver(orgRepo);
    }

    // ── getStateCode: name → 2-letter code ──

    @Test
    void getStateCode_federal_returnsUS() {
        assertEquals("US", resolver.getStateCode("Federal"));
    }

    @Test
    void getStateCode_texas_returnsTX() {
        assertEquals("TX", resolver.getStateCode("Texas"));
    }

    @Test
    void getStateCode_massachusetts_returnsMA() {
        assertEquals("MA", resolver.getStateCode("Massachusetts"));
    }

    @Test
    void getStateCode_districtOfColumbia_returnsDC() {
        assertEquals("DC", resolver.getStateCode("District of Columbia"));
    }

    @Test
    void getStateCode_caseInsensitive() {
        assertEquals("NY", resolver.getStateCode("new york"));
    }

    @Test
    void getStateCode_unknown_returnsNull() {
        assertNull(resolver.getStateCode("Narnia"));
    }

    @Test
    void getStateCode_null_returnsNull() {
        assertNull(resolver.getStateCode(null));
    }

    @Test
    void getStateCode_blank_returnsNull() {
        assertNull(resolver.getStateCode("  "));
    }

    // ── getStateName: 2-letter code → name ──

    @Test
    void getStateName_US_returnsFederal() {
        assertEquals("Federal", resolver.getStateName("US"));
    }

    @Test
    void getStateName_TX_returnsTexas() {
        assertEquals("Texas", resolver.getStateName("TX"));
    }

    @Test
    void getStateName_lowercase_works() {
        assertEquals("Florida", resolver.getStateName("fl"));
    }

    @Test
    void getStateName_unknown_returnsCodeItself() {
        // Graceful fallback: returns the code if not found
        assertEquals("ZZ", resolver.getStateName("ZZ"));
    }

    @Test
    void getStateName_null_returnsDefault() {
        assertEquals("Massachusetts", resolver.getStateName(null));
    }

    // ── getCourtLabel: state code → "STATE OF X" / "COMMONWEALTH OF X" / "UNITED STATES" ──

    @Test
    void getCourtLabel_federal_returnsUnitedStates() {
        assertEquals("UNITED STATES OF AMERICA", resolver.getCourtLabel("US"));
    }

    @Test
    void getCourtLabel_texas_returnsStateOfTexas() {
        assertEquals("STATE OF TEXAS", resolver.getCourtLabel("TX"));
    }

    @Test
    void getCourtLabel_massachusetts_returnsCommonwealth() {
        assertEquals("COMMONWEALTH OF MASSACHUSETTS", resolver.getCourtLabel("MA"));
    }

    @Test
    void getCourtLabel_pennsylvania_returnsCommonwealth() {
        assertEquals("COMMONWEALTH OF PENNSYLVANIA", resolver.getCourtLabel("PA"));
    }

    @Test
    void getCourtLabel_virginia_returnsCommonwealth() {
        assertEquals("COMMONWEALTH OF VIRGINIA", resolver.getCourtLabel("VA"));
    }

    @Test
    void getCourtLabel_kentucky_returnsCommonwealth() {
        assertEquals("COMMONWEALTH OF KENTUCKY", resolver.getCourtLabel("KY"));
    }

    @Test
    void getCourtLabel_california_returnsStateOf() {
        assertEquals("STATE OF CALIFORNIA", resolver.getCourtLabel("CA"));
    }

    @Test
    void getCourtLabel_null_fallsBackToDefault() {
        // null → defaults to MA → "COMMONWEALTH OF MASSACHUSETTS"
        assertEquals("COMMONWEALTH OF MASSACHUSETTS", resolver.getCourtLabel(null));
    }

    // ── Coverage: all 50 states + DC + Federal are mapped ──

    @ParameterizedTest(name = "State code {0} maps to {1}")
    @CsvSource({
        "AL, Alabama", "AK, Alaska", "AZ, Arizona", "AR, Arkansas",
        "CA, California", "CO, Colorado", "CT, Connecticut", "DE, Delaware",
        "FL, Florida", "GA, Georgia", "HI, Hawaii", "ID, Idaho",
        "IL, Illinois", "IN, Indiana", "IA, Iowa", "KS, Kansas",
        "KY, Kentucky", "LA, Louisiana", "ME, Maine", "MD, Maryland",
        "MA, Massachusetts", "MI, Michigan", "MN, Minnesota", "MS, Mississippi",
        "MO, Missouri", "MT, Montana", "NE, Nebraska", "NV, Nevada",
        "NH, New Hampshire", "NJ, New Jersey", "NM, New Mexico", "NY, New York",
        "NC, North Carolina", "ND, North Dakota", "OH, Ohio", "OK, Oklahoma",
        "OR, Oregon", "PA, Pennsylvania", "RI, Rhode Island", "SC, South Carolina",
        "SD, South Dakota", "TN, Tennessee", "TX, Texas", "UT, Utah",
        "VT, Vermont", "VA, Virginia", "WA, Washington", "WV, West Virginia",
        "WI, Wisconsin", "WY, Wyoming", "DC, District of Columbia", "US, Federal"
    })
    void getStateName_allJurisdictions(String code, String expectedName) {
        assertEquals(expectedName, resolver.getStateName(code));
    }

    @ParameterizedTest(name = "{1} resolves back to {0}")
    @CsvSource({
        "AL, Alabama", "AK, Alaska", "AZ, Arizona", "AR, Arkansas",
        "CA, California", "CO, Colorado", "CT, Connecticut", "DE, Delaware",
        "FL, Florida", "GA, Georgia", "HI, Hawaii", "ID, Idaho",
        "IL, Illinois", "IN, Indiana", "IA, Iowa", "KS, Kansas",
        "KY, Kentucky", "LA, Louisiana", "ME, Maine", "MD, Maryland",
        "MA, Massachusetts", "MI, Michigan", "MN, Minnesota", "MS, Mississippi",
        "MO, Missouri", "MT, Montana", "NE, Nebraska", "NV, Nevada",
        "NH, New Hampshire", "NJ, New Jersey", "NM, New Mexico", "NY, New York",
        "NC, North Carolina", "ND, North Dakota", "OH, Ohio", "OK, Oklahoma",
        "OR, Oregon", "PA, Pennsylvania", "RI, Rhode Island", "SC, South Carolina",
        "SD, South Dakota", "TN, Tennessee", "TX, Texas", "UT, Utah",
        "VT, Vermont", "VA, Virginia", "WA, Washington", "WV, West Virginia",
        "WI, Wisconsin", "WY, Wyoming", "DC, District of Columbia", "US, Federal"
    })
    void getStateCode_roundTrip(String expectedCode, String name) {
        assertEquals(expectedCode, resolver.getStateCode(name));
    }
}
