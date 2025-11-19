package com.bostoneo.bostoneosolutions.service;

import org.junit.jupiter.api.Test;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test citation regex pattern to ensure it handles federal reporters with digits
 */
public class CitationRegexTest {

    private static final Pattern CITATION_PATTERN =
        Pattern.compile("(\\d+)\\s+([A-Z](?:[A-Za-z.\\d\\s]){1,30})\\s+(\\d+(?:st|nd|rd|th)?)");

    @Test
    public void testFederalCitationWithDigits() {
        String citation = "Stop & Shop Supermarket Co. v. Blue Cross & Blue Shield, 373 F.3d 57";
        Matcher matcher = CITATION_PATTERN.matcher(citation);

        assertTrue(matcher.find(), "Should match federal citation with F.3d");
        assertEquals("373 F.3d 57", matcher.group().trim());
        System.out.println("✓ Matched: " + matcher.group().trim());
    }

    @Test
    public void testFederalSupplementCitation() {
        String citation = "Example Case v. Another, 685 F. Supp. 2d 456";
        Matcher matcher = CITATION_PATTERN.matcher(citation);

        assertTrue(matcher.find(), "Should match F. Supp. 2d citation");
        assertEquals("685 F. Supp. 2d 456", matcher.group().trim());
        System.out.println("✓ Matched: " + matcher.group().trim());
    }

    @Test
    public void testMassachusettsCitation() {
        String citation = "Anthony's Pier Four, Inc. v. HBC Associates, 411 Mass. 451";
        Matcher matcher = CITATION_PATTERN.matcher(citation);

        assertTrue(matcher.find(), "Should match Mass. citation");
        assertEquals("411 Mass. 451", matcher.group().trim());
        System.out.println("✓ Matched: " + matcher.group().trim());
    }

    @Test
    public void testSupremeCourtCitation() {
        String citation = "McDonnell Douglas Corp. v. Green, 411 U.S. 792";
        Matcher matcher = CITATION_PATTERN.matcher(citation);

        assertTrue(matcher.find(), "Should match U.S. citation");
        assertEquals("411 U.S. 792", matcher.group().trim());
        System.out.println("✓ Matched: " + matcher.group().trim());
    }

    @Test
    public void testF2dCitation() {
        String citation = "Test Case v. Defendant, 123 F.2d 456";
        Matcher matcher = CITATION_PATTERN.matcher(citation);

        assertTrue(matcher.find(), "Should match F.2d citation");
        assertEquals("123 F.2d 456", matcher.group().trim());
        System.out.println("✓ Matched: " + matcher.group().trim());
    }
}
