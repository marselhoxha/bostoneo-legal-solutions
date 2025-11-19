package com.bostoneo.bostoneosolutions.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test FRCP abbreviation link injection
 */
@SpringBootTest
public class FrcpLinkInjectionTest {

    @Autowired
    private CitationUrlInjector citationUrlInjector;

    @Test
    public void testFrcpAbbreviation() {
        String input = "Per FRCP 8(a), a complaint must contain a short and plain statement.";
        String result = citationUrlInjector.inject(input);

        System.out.println("Input:  " + input);
        System.out.println("Output: " + result);

        assertTrue(result.contains("[FRCP 8]"), "Should convert FRCP 8(a) to clickable link");
        assertTrue(result.contains("https://www.law.cornell.edu/rules/frcp/rule_8"), "Should link to Cornell LII");
        assertFalse(result.contains("FRCP 8(a)") && !result.contains("[FRCP"), "Should replace plain text with link");
    }

    @Test
    public void testFrcp12b6() {
        String input = "Motion to dismiss for failure to state a claim under FRCP 12(b)(6).";
        String result = citationUrlInjector.inject(input);

        System.out.println("Input:  " + input);
        System.out.println("Output: " + result);

        assertTrue(result.contains("[FRCP 12]"), "Should convert FRCP 12(b)(6) to clickable link");
        assertTrue(result.contains("https://www.law.cornell.edu/rules/frcp/rule_12"), "Should link to rule 12");
    }

    @Test
    public void testFedRCivP() {
        String input = "Per Fed. R. Civ. P. 56(c), summary judgment requires showing no genuine dispute.";
        String result = citationUrlInjector.inject(input);

        System.out.println("Input:  " + input);
        System.out.println("Output: " + result);

        assertTrue(result.contains("[Fed. R. Civ. P. 56]"), "Should convert Fed. R. Civ. P. to clickable link");
        assertTrue(result.contains("https://www.law.cornell.edu/rules/frcp/rule_56"), "Should link to rule 56");
    }

    @Test
    public void testFrcrpAbbreviation() {
        String input = "Criminal motions must be filed per FRCrP 12(b).";
        String result = citationUrlInjector.inject(input);

        System.out.println("Input:  " + input);
        System.out.println("Output: " + result);

        assertTrue(result.contains("[FRCrP 12]"), "Should convert FRCrP to clickable link");
        assertTrue(result.contains("https://www.law.cornell.edu/rules/frcrmp/rule_12"), "Should link to criminal rules");
    }

    @Test
    public void testMultipleFrcpCitations() {
        String input = "Complaints require FRCP 8(a) and FRCP 12(b)(6) applies to motions to dismiss.";
        String result = citationUrlInjector.inject(input);

        System.out.println("Input:  " + input);
        System.out.println("Output: " + result);

        int frcpLinkCount = result.split("\\[FRCP").length - 1;
        assertEquals(2, frcpLinkCount, "Should convert both FRCP citations");
    }
}
