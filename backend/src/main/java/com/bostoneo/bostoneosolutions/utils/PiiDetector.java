package com.bostoneo.bostoneosolutions.utils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PII detection and redaction utility for AI compliance.
 * Replaces personally identifiable information with labeled placeholders
 * before prompts leave the server to external AI APIs.
 *
 * Covers: MA 201 CMR 17.00, ABA Rule 1.6, HIPAA, PCI DSS, USCIS/immigration regs.
 */
public final class PiiDetector {

    private PiiDetector() {}

    // ---- Pattern entry: regex + replacement + optional keyword anchor ----

    private record PiiPattern(String label, Pattern regex, String replacement, Set<String> keywords) {
        /** High-confidence pattern (no keyword needed) */
        PiiPattern(String label, Pattern regex, String replacement) {
            this(label, regex, replacement, null);
        }

        boolean isKeywordAnchored() {
            return keywords != null && !keywords.isEmpty();
        }
    }

    // Keyword-proximity window (chars before the match to search for a keyword)
    private static final int KEYWORD_WINDOW = 60;

    // ---- HIGH-confidence patterns (regex-only, no keyword needed) ----

    // 1. SSN: 123-45-6789 or 123 45 6789 (but NOT 9xx which is ITIN)
    private static final Pattern SSN_PATTERN =
            Pattern.compile("\\b(?!9\\d{2})[0-8]\\d{2}[- ]\\d{2}[- ]\\d{4}\\b");

    // 2. ITIN: 9xx-xx-xxxx (IRS Individual Taxpayer Identification Number)
    private static final Pattern ITIN_PATTERN =
            Pattern.compile("\\b9\\d{2}[- ]\\d{2}[- ]\\d{4}\\b");

    // 3. Email addresses
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b");

    // 4. US phone: (123) 456-7890, 123-456-7890, 123.456.7890
    private static final Pattern PHONE_PATTERN =
            Pattern.compile("(?:\\(\\d{3}\\)[- ]?|\\b\\d{3}[-.])\\d{3}[-.\\s]\\d{4}\\b");

    // 5. Credit card: Visa/MC/Amex/Discover, 13-19 digits with optional separators
    private static final Pattern CARD_PATTERN =
            Pattern.compile("\\b(?:4\\d{3}|5[1-5]\\d{2}|3[47]\\d{2}|6(?:011|5\\d{2}))[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{1,7}\\b");

    // 6. USCIS A-Number: A#12345678 or A12345678 (7-9 digits)
    private static final Pattern A_NUMBER_PATTERN =
            Pattern.compile("\\bA#?\\d{7,9}\\b", Pattern.CASE_INSENSITIVE);

    // 7. USCIS Receipt Number: EAC/WAC/LIN/SRC/MSC/NBC/IOE/YSC + 10 digits
    private static final Pattern USCIS_RECEIPT_PATTERN =
            Pattern.compile("\\b(?:EAC|WAC|LIN|SRC|MSC|NBC|IOE|YSC)\\d{10}\\b", Pattern.CASE_INSENSITIVE);

    // ---- MEDIUM-confidence patterns (keyword-anchored) ----

    // 8. Date of birth: MM/DD/YYYY or MM-DD-YYYY
    private static final Pattern DOB_PATTERN =
            Pattern.compile("\\b(?:0[1-9]|1[0-2])[/-](?:0[1-9]|[12]\\d|3[01])[/-](?:19|20)\\d{2}\\b");
    private static final Set<String> DOB_KEYWORDS =
            Set.of("dob", "date of birth", "born", "birthday", "birth date", "birthdate");

    // 9. EIN: 12-3456789
    private static final Pattern EIN_PATTERN =
            Pattern.compile("\\b\\d{2}-\\d{7}\\b");
    private static final Set<String> EIN_KEYWORDS =
            Set.of("ein", "employer identification", "fein", "federal id", "tax id", "employer id");

    // 10. Driver's license: 1-2 letters + 7-8 digits
    private static final Pattern DL_PATTERN =
            Pattern.compile("\\b[A-Z]{1,2}\\d{7,8}\\b");
    private static final Set<String> DL_KEYWORDS =
            Set.of("driver", "license", "dl", "license number", "state id", "driver's license", "drivers license");

    // 11. Passport number: 9 digits near keyword
    private static final Pattern PASSPORT_PATTERN =
            Pattern.compile("\\b\\d{9}\\b");
    private static final Set<String> PASSPORT_KEYWORDS =
            Set.of("passport", "passport number", "passport no");

    // 12. Bank account number: 8-17 digits near keyword
    private static final Pattern ACCOUNT_PATTERN =
            Pattern.compile("\\b\\d{8,17}\\b");
    private static final Set<String> ACCOUNT_KEYWORDS =
            Set.of("account", "acct", "bank account", "checking", "savings", "account number", "account no");

    // 13. Routing number: 9 digits near keyword
    private static final Pattern ROUTING_PATTERN =
            Pattern.compile("\\b\\d{9}\\b");
    private static final Set<String> ROUTING_KEYWORDS =
            Set.of("routing", "aba", "rtn", "routing number");

    // ---- Ordered pattern list (HIGH first, then keyword-anchored) ----

    private static final List<PiiPattern> PATTERNS = List.of(
            // HIGH confidence (no keywords)
            new PiiPattern("SSN",           SSN_PATTERN,            "[SSN-REDACTED]"),
            new PiiPattern("ITIN",          ITIN_PATTERN,           "[ITIN-REDACTED]"),
            new PiiPattern("EMAIL",         EMAIL_PATTERN,          "[EMAIL-REDACTED]"),
            new PiiPattern("PHONE",         PHONE_PATTERN,          "[PHONE-REDACTED]"),
            new PiiPattern("CARD",          CARD_PATTERN,           "[CARD-REDACTED]"),
            new PiiPattern("A-NUMBER",      A_NUMBER_PATTERN,       "[A-NUMBER-REDACTED]"),
            new PiiPattern("USCIS-RECEIPT", USCIS_RECEIPT_PATTERN,  "[USCIS-RECEIPT-REDACTED]"),
            // MEDIUM confidence (keyword-anchored)
            new PiiPattern("DOB",           DOB_PATTERN,            "[DOB-REDACTED]",       DOB_KEYWORDS),
            new PiiPattern("EIN",           EIN_PATTERN,            "[EIN-REDACTED]",       EIN_KEYWORDS),
            new PiiPattern("DL",            DL_PATTERN,             "[DL-REDACTED]",        DL_KEYWORDS),
            new PiiPattern("PASSPORT",      PASSPORT_PATTERN,       "[PASSPORT-REDACTED]",  PASSPORT_KEYWORDS),
            new PiiPattern("ACCOUNT",       ACCOUNT_PATTERN,        "[ACCOUNT-REDACTED]",   ACCOUNT_KEYWORDS),
            new PiiPattern("ROUTING",       ROUTING_PATTERN,        "[ROUTING-REDACTED]",   ROUTING_KEYWORDS)
    );

    /**
     * Redact all detected PII from the text, replacing with labeled placeholders.
     *
     * @param text the text to redact
     * @return text with PII replaced by placeholders (e.g. [SSN-REDACTED])
     */
    public static String redact(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        String result = text;
        for (PiiPattern p : PATTERNS) {
            if (p.isKeywordAnchored()) {
                result = redactKeywordAnchored(result, p);
            } else {
                result = p.regex().matcher(result).replaceAll(Matcher.quoteReplacement(p.replacement()));
            }
        }
        return result;
    }

    /**
     * Check if the text contains any detectable PII patterns.
     */
    public static boolean containsPii(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        for (PiiPattern p : PATTERNS) {
            if (p.isKeywordAnchored()) {
                if (hasKeywordAnchoredMatch(text, p)) return true;
            } else {
                if (p.regex().matcher(text).find()) return true;
            }
        }
        return false;
    }

    /**
     * Return a comma-separated list of detected PII type labels (for logging).
     */
    public static String detectPiiTypes(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        List<String> found = new ArrayList<>();
        for (PiiPattern p : PATTERNS) {
            if (p.isKeywordAnchored()) {
                if (hasKeywordAnchoredMatch(text, p)) found.add(p.label());
            } else {
                if (p.regex().matcher(text).find()) found.add(p.label());
            }
        }
        return String.join(",", found);
    }

    // ---- Keyword-anchored helpers ----

    /**
     * Redact matches only when a keyword appears within KEYWORD_WINDOW chars before the match.
     */
    private static String redactKeywordAnchored(String text, PiiPattern p) {
        Matcher m = p.regex().matcher(text);
        StringBuilder sb = new StringBuilder();
        String lowerText = text.toLowerCase();

        while (m.find()) {
            int start = m.start();
            int windowStart = Math.max(0, start - KEYWORD_WINDOW);
            String window = lowerText.substring(windowStart, start);

            boolean keywordFound = false;
            for (String kw : p.keywords()) {
                if (window.contains(kw)) {
                    keywordFound = true;
                    break;
                }
            }
            if (keywordFound) {
                m.appendReplacement(sb, Matcher.quoteReplacement(p.replacement()));
            }
        }
        m.appendTail(sb);
        return sb.toString();
    }

    /**
     * Check if at least one keyword-anchored match exists.
     */
    private static boolean hasKeywordAnchoredMatch(String text, PiiPattern p) {
        Matcher m = p.regex().matcher(text);
        String lowerText = text.toLowerCase();

        while (m.find()) {
            int start = m.start();
            int windowStart = Math.max(0, start - KEYWORD_WINDOW);
            String window = lowerText.substring(windowStart, start);

            for (String kw : p.keywords()) {
                if (window.contains(kw)) {
                    return true;
                }
            }
        }
        return false;
    }
}
