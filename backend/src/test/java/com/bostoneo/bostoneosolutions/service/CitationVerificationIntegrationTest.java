package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ai.CitationVerificationResult;
import com.bostoneo.bostoneosolutions.service.external.CourtListenerService;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for citation verification with real API calls.
 * Tests the fixes for wrong URLs and empty case names.
 *
 * DISABLED: Requires running PostgreSQL database and external API access.
 * Run manually with: mvn test -Dtest=CitationVerificationIntegrationTest -DskipTests=false
 */
@SpringBootTest
@Disabled("Requires PostgreSQL and external API - run manually")
public class CitationVerificationIntegrationTest {

    @Autowired
    private CourtListenerService courtListenerService;

    @Test
    public void testBellAtlanticWithCaseName() {
        System.out.println("\n=== TEST 1: Bell Atlantic v. Twombly WITH case name ===");

        CitationVerificationResult result = courtListenerService.verifyCitation(
            "Bell Atlantic Corp. v. Twombly, 550 U.S. 544"
        );

        System.out.println("Found: " + result.isFound());
        System.out.println("Case Name: " + result.getCaseName());
        System.out.println("Citation: " + result.getCitation());
        System.out.println("URL: " + result.getUrl());
        System.out.println("Error: " + result.getErrorMessage());

        if (result.isFound()) {
            assertNotNull(result.getCaseName(), "Case name should not be null");
            assertFalse(result.getCaseName().isEmpty(), "Case name should not be empty");
            assertNotNull(result.getUrl(), "URL should not be null");
            assertFalse(result.getUrl().contains("mnc-v-a-knudsen"),
                "URL should NOT be mnc-v-a-knudsen (wrong case)");
            assertTrue(result.getUrl().contains("twombly") || result.getUrl().contains("bell-atlantic"),
                "URL should contain case-specific path");
        }
    }

    @Test
    public void testSupremeCourtWithoutCaseName() {
        System.out.println("\n=== TEST 2: 550 U.S. 544 WITHOUT case name ===");

        CitationVerificationResult result = courtListenerService.verifyCitation("550 U.S. 544");

        System.out.println("Found: " + result.isFound());
        System.out.println("Case Name: " + result.getCaseName());
        System.out.println("Citation: " + result.getCitation());
        System.out.println("URL: " + result.getUrl());
        System.out.println("Error: " + result.getErrorMessage());

        // Without case name, should either:
        // 1. Find it via Justia (Supreme Court fallback)
        // 2. Return not found (safe behavior - no wrong URLs)

        if (result.isFound() && result.getUrl() != null) {
            assertFalse(result.getUrl().contains("mnc-v-a-knudsen"),
                "Should NOT return wrong Montana case URL");
        }
    }

    @Test
    public void testAshcroftWithCaseName() {
        System.out.println("\n=== TEST 3: Ashcroft v. Iqbal WITH case name ===");

        CitationVerificationResult result = courtListenerService.verifyCitation(
            "Ashcroft v. Iqbal, 556 U.S. 662"
        );

        System.out.println("Found: " + result.isFound());
        System.out.println("Case Name: " + result.getCaseName());
        System.out.println("Citation: " + result.getCitation());
        System.out.println("URL: " + result.getUrl());
        System.out.println("Error: " + result.getErrorMessage());

        if (result.isFound()) {
            assertNotNull(result.getCaseName(), "Case name should not be null");
            assertFalse(result.getCaseName().isEmpty(), "Case name should not be empty");
            assertFalse(result.getUrl().contains("mnc-v-a-knudsen"),
                "Should NOT return wrong Montana case URL");
        }
    }

    @Test
    public void testFederalReporterCitation() {
        System.out.println("\n=== TEST 4: Federal Reporter (F.3d) WITH case name ===");

        CitationVerificationResult result = courtListenerService.verifyCitation(
            "Stop & Shop Supermarket Co. v. Blue Cross & Blue Shield, 373 F.3d 57"
        );

        System.out.println("Found: " + result.isFound());
        System.out.println("Case Name: " + result.getCaseName());
        System.out.println("Citation: " + result.getCitation());
        System.out.println("URL: " + result.getUrl());
        System.out.println("Error: " + result.getErrorMessage());

        // Should extract citation correctly (regex fix)
        // May or may not verify in database (depends on coverage)
        // But should NOT return wrong URL
        if (result.isFound() && result.getUrl() != null) {
            assertFalse(result.getUrl().contains("mnc-v-a-knudsen"),
                "Should NOT return wrong Montana case URL");
        }
    }
}
