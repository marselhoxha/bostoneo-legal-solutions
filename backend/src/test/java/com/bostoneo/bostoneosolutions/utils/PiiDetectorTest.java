package com.bostoneo.bostoneosolutions.utils;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PiiDetectorTest {

    // === HIGH-confidence patterns (no keyword needed) ===

    @Test
    void testSsnRedaction() {
        assertEquals("SSN: [SSN-REDACTED]", PiiDetector.redact("SSN: 123-45-6789"));
        assertEquals("SSN: [SSN-REDACTED]", PiiDetector.redact("SSN: 123 45 6789"));
        assertTrue(PiiDetector.containsPii("My SSN is 123-45-6789"));
        assertTrue(PiiDetector.detectPiiTypes("123-45-6789").contains("SSN"));
    }

    @Test
    void testItinRedaction() {
        assertEquals("ITIN: [ITIN-REDACTED]", PiiDetector.redact("ITIN: 912-78-1234"));
        assertEquals("ITIN: [ITIN-REDACTED]", PiiDetector.redact("ITIN: 900-70-0000"));
        assertTrue(PiiDetector.detectPiiTypes("912-78-1234").contains("ITIN"));
        // 9xx should NOT match SSN
        assertFalse(PiiDetector.detectPiiTypes("912-78-1234").contains("SSN"));
    }

    @Test
    void testEmailRedaction() {
        assertEquals("Email: [EMAIL-REDACTED]", PiiDetector.redact("Email: john@example.com"));
        assertEquals("Contact [EMAIL-REDACTED] for info", PiiDetector.redact("Contact jane.doe+test@firm.co.uk for info"));
        assertTrue(PiiDetector.detectPiiTypes("john@example.com").contains("EMAIL"));
    }

    @Test
    void testPhoneRedaction() {
        assertEquals("Call [PHONE-REDACTED]", PiiDetector.redact("Call (617) 555-1234"));
        assertEquals("Call [PHONE-REDACTED]", PiiDetector.redact("Call 617-555-1234"));
        assertEquals("Call [PHONE-REDACTED]", PiiDetector.redact("Call 617.555.1234"));
        assertTrue(PiiDetector.detectPiiTypes("(617) 555-1234").contains("PHONE"));
    }

    @Test
    void testCreditCardRedaction() {
        assertEquals("Card: [CARD-REDACTED]", PiiDetector.redact("Card: 4111-1111-1111-1111"));
        assertEquals("Card: [CARD-REDACTED]", PiiDetector.redact("Card: 4111111111111111"));
        assertEquals("Card: [CARD-REDACTED]", PiiDetector.redact("Card: 5500 0000 0000 0004"));
        assertTrue(PiiDetector.detectPiiTypes("4111-1111-1111-1111").contains("CARD"));
    }

    @Test
    void testANumberRedaction() {
        assertEquals("Alien: [A-NUMBER-REDACTED]", PiiDetector.redact("Alien: A123456789"));
        assertEquals("Alien: [A-NUMBER-REDACTED]", PiiDetector.redact("Alien: A#123456789"));
        assertEquals("Alien: [A-NUMBER-REDACTED]", PiiDetector.redact("Alien: A1234567"));
        assertTrue(PiiDetector.detectPiiTypes("A123456789").contains("A-NUMBER"));
    }

    @Test
    void testUscisReceiptRedaction() {
        assertEquals("Receipt: [USCIS-RECEIPT-REDACTED]", PiiDetector.redact("Receipt: MSC2190123456"));
        assertEquals("Receipt: [USCIS-RECEIPT-REDACTED]", PiiDetector.redact("Receipt: EAC2190123456"));
        assertEquals("Receipt: [USCIS-RECEIPT-REDACTED]", PiiDetector.redact("Receipt: IOE2190123456"));
        assertTrue(PiiDetector.detectPiiTypes("MSC2190123456").contains("USCIS-RECEIPT"));
    }

    // === MEDIUM-confidence patterns (keyword-anchored) ===

    @Test
    void testDobRedaction() {
        assertEquals("DOB [DOB-REDACTED]", PiiDetector.redact("DOB 03/15/1985"));
        assertEquals("date of birth: [DOB-REDACTED]", PiiDetector.redact("date of birth: 12-25-1990"));
        assertTrue(PiiDetector.detectPiiTypes("DOB 03/15/1985").contains("DOB"));
        // Without keyword: should NOT redact
        assertEquals("Filed on 03/15/1985", PiiDetector.redact("Filed on 03/15/1985"));
    }

    @Test
    void testEinRedaction() {
        assertEquals("EIN [EIN-REDACTED]", PiiDetector.redact("EIN 12-3456789"));
        assertEquals("Employer identification: [EIN-REDACTED]", PiiDetector.redact("Employer identification: 12-3456789"));
        assertTrue(PiiDetector.detectPiiTypes("EIN 12-3456789").contains("EIN"));
        // Without keyword: should NOT redact
        assertEquals("Reference 12-3456789", PiiDetector.redact("Reference 12-3456789"));
    }

    @Test
    void testDriversLicenseRedaction() {
        assertEquals("DL number [DL-REDACTED]", PiiDetector.redact("DL number S12345678"));
        assertEquals("Driver's license: [DL-REDACTED]", PiiDetector.redact("Driver's license: MA1234567"));
        assertTrue(PiiDetector.detectPiiTypes("license number S12345678").contains("DL"));
        // Without keyword: should NOT redact
        assertEquals("Code AB12345678", PiiDetector.redact("Code AB12345678"));
    }

    @Test
    void testPassportRedaction() {
        assertEquals("passport [PASSPORT-REDACTED] here", PiiDetector.redact("passport 123456789 here"));
        assertEquals("passport number [PASSPORT-REDACTED]", PiiDetector.redact("passport number 123456789"));
        assertTrue(PiiDetector.detectPiiTypes("passport number 123456789").contains("PASSPORT"));
        // Without keyword: should NOT redact
        assertEquals("number 123456789", PiiDetector.redact("number 123456789"));
    }

    @Test
    void testBankAccountRedaction() {
        assertEquals("bank account [ACCOUNT-REDACTED]", PiiDetector.redact("bank account 12345678901234"));
        assertEquals("checking [ACCOUNT-REDACTED]", PiiDetector.redact("checking 12345678901234"));
        assertTrue(PiiDetector.detectPiiTypes("account number 12345678").contains("ACCOUNT"));
        // Without keyword: should NOT redact
        assertEquals("ref 12345678901234", PiiDetector.redact("ref 12345678901234"));
    }

    @Test
    void testRoutingRedaction() {
        assertEquals("routing [ROUTING-REDACTED]", PiiDetector.redact("routing 021000021"));
        assertEquals("ABA [ROUTING-REDACTED]", PiiDetector.redact("ABA 021000021"));
        assertTrue(PiiDetector.detectPiiTypes("routing number 021000021").contains("ROUTING"));
        // Without keyword: should NOT redact
        assertEquals("code 021000021", PiiDetector.redact("code 021000021"));
    }

    // === Edge cases ===

    @Test
    void testCleanPromptPassesThrough() {
        String clean = "What are the legal requirements for filing a motion to dismiss in Massachusetts?";
        assertEquals(clean, PiiDetector.redact(clean));
        assertFalse(PiiDetector.containsPii(clean));
        assertEquals("", PiiDetector.detectPiiTypes(clean));
    }

    @Test
    void testNullAndEmpty() {
        assertNull(PiiDetector.redact(null));
        assertEquals("", PiiDetector.redact(""));
        assertFalse(PiiDetector.containsPii(null));
        assertFalse(PiiDetector.containsPii(""));
        assertEquals("", PiiDetector.detectPiiTypes(null));
        assertEquals("", PiiDetector.detectPiiTypes(""));
    }

    @Test
    void testMultiplePiiInOnePrompt() {
        String input = "Client John (SSN 123-45-6789, email john@example.com, DOB 03/15/1985) called (617) 555-1234";
        String redacted = PiiDetector.redact(input);
        assertTrue(redacted.contains("[SSN-REDACTED]"));
        assertTrue(redacted.contains("[EMAIL-REDACTED]"));
        assertTrue(redacted.contains("[DOB-REDACTED]"));
        assertTrue(redacted.contains("[PHONE-REDACTED]"));
        assertFalse(redacted.contains("123-45-6789"));
        assertFalse(redacted.contains("john@example.com"));
        assertFalse(redacted.contains("03/15/1985"));
        assertFalse(redacted.contains("555-1234"));
    }
}
