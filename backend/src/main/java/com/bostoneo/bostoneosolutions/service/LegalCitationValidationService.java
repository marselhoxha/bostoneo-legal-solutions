package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Service for validating legal citations against Bluebook standards
 * and verifying their accuracy and currency.
 * Ensures lawyer-grade precision in citation formatting and verification.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LegalCitationValidationService {

    // Bluebook-compliant citation patterns
    private static final Pattern FEDERAL_CASE_PATTERN = Pattern.compile(
        "^([\\w\\s\\.,'&-]+),\\s*(\\d+)\\s+(U\\.S\\.|F\\.\\d*d|F\\. Supp\\.\\s*\\d*d?)\\s+(\\d+)(?:,\\s*(\\d+(?:-\\d+)?))?" +
        "\\s*\\(((?:[A-Z][a-z]+\\.\\s*)?(?:Cir\\.|\\d{4}))\\)$"
    );

    private static final Pattern STATE_CASE_PATTERN = Pattern.compile(
        "^([\\w\\s\\.,'&-]+),\\s*(\\d+)\\s+([A-Z][a-z]+\\.(?:\\s*\\d*d)?)\\s+(\\d+)(?:,\\s*(\\d+(?:-\\d+)?))?" +
        "\\s*\\(([A-Z][a-z]+\\.(?:\\s*(?:Sup\\.|App\\.|Ct\\.))?)\\s*(\\d{4})\\)$"
    );

    private static final Pattern FEDERAL_STATUTE_PATTERN = Pattern.compile(
        "^(\\d+)\\s+U\\.S\\.C\\.\\s+§\\s*(\\d+[a-z]?)(?:\\(([a-z0-9\\)\\(]+)\\))?(?:\\s*\\((\\d{4})\\))?$"
    );

    private static final Pattern CFR_PATTERN = Pattern.compile(
        "^(\\d+)\\s+C\\.F\\.R\\.\\s+§\\s*([\\d\\.]+)(?:\\(([a-z0-9\\)\\(]+)\\))?(?:\\s*\\((\\d{4})\\))?$"
    );

    private static final Pattern MASS_STATUTE_PATTERN = Pattern.compile(
        "^(?:Mass\\.\\s+Gen\\.\\s+Laws|M\\.G\\.L\\.)\\s+c(?:h)?\\.\\s*(\\d+[A-Z]?),\\s*§\\s*(\\d+[A-Z]?)(?:\\s*\\((\\d{4})\\))?$"
    );

    private static final Pattern MASS_RULE_PATTERN = Pattern.compile(
        "^Mass\\.\\s+R\\.\\s+(Civ|Crim|App|Evid)\\.\\s+P\\.\\s*([\\d\\.]+)(?:\\(([a-z0-9\\)\\(]+)\\))?$"
    );

    /**
     * Comprehensive citation validation result
     */
    public static class CitationValidationResult {
        private final String originalCitation;
        private final boolean isValid;
        private final String citationType;
        private final String correctedCitation;
        private final List<String> errors;
        private final List<String> warnings;
        private final Map<String, String> metadata;

        public CitationValidationResult(String originalCitation, boolean isValid, String citationType,
                                       String correctedCitation, List<String> errors, List<String> warnings,
                                       Map<String, String> metadata) {
            this.originalCitation = originalCitation;
            this.isValid = isValid;
            this.citationType = citationType;
            this.correctedCitation = correctedCitation;
            this.errors = errors != null ? errors : new ArrayList<>();
            this.warnings = warnings != null ? warnings : new ArrayList<>();
            this.metadata = metadata != null ? metadata : new HashMap<>();
        }

        // Getters
        public String getOriginalCitation() { return originalCitation; }
        public boolean isValid() { return isValid; }
        public String getCitationType() { return citationType; }
        public String getCorrectedCitation() { return correctedCitation; }
        public List<String> getErrors() { return errors; }
        public List<String> getWarnings() { return warnings; }
        public Map<String, String> getMetadata() { return metadata; }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("originalCitation", originalCitation);
            map.put("isValid", isValid);
            map.put("citationType", citationType);
            map.put("correctedCitation", correctedCitation);
            map.put("errors", errors);
            map.put("warnings", warnings);
            map.put("metadata", metadata);
            return map;
        }
    }

    /**
     * Validates a single citation for Bluebook compliance and accuracy
     */
    public CitationValidationResult validateCitation(String citation) {
        if (citation == null || citation.trim().isEmpty()) {
            return new CitationValidationResult(citation, false, "UNKNOWN",
                null, List.of("Empty or null citation"), null, null);
        }

        String trimmedCitation = citation.trim();

        // Try federal case citation
        Matcher federalCaseMatcher = FEDERAL_CASE_PATTERN.matcher(trimmedCitation);
        if (federalCaseMatcher.matches()) {
            return validateFederalCaseCitation(trimmedCitation, federalCaseMatcher);
        }

        // Try state case citation
        Matcher stateCaseMatcher = STATE_CASE_PATTERN.matcher(trimmedCitation);
        if (stateCaseMatcher.matches()) {
            return validateStateCaseCitation(trimmedCitation, stateCaseMatcher);
        }

        // Try federal statute
        Matcher federalStatuteMatcher = FEDERAL_STATUTE_PATTERN.matcher(trimmedCitation);
        if (federalStatuteMatcher.matches()) {
            return validateFederalStatuteCitation(trimmedCitation, federalStatuteMatcher);
        }

        // Try CFR
        Matcher cfrMatcher = CFR_PATTERN.matcher(trimmedCitation);
        if (cfrMatcher.matches()) {
            return validateCFRCitation(trimmedCitation, cfrMatcher);
        }

        // Try Massachusetts statute
        Matcher massStatuteMatcher = MASS_STATUTE_PATTERN.matcher(trimmedCitation);
        if (massStatuteMatcher.matches()) {
            return validateMassachusettsStatuteCitation(trimmedCitation, massStatuteMatcher);
        }

        // Try Massachusetts rule
        Matcher massRuleMatcher = MASS_RULE_PATTERN.matcher(trimmedCitation);
        if (massRuleMatcher.matches()) {
            return validateMassachusettsRuleCitation(trimmedCitation, massRuleMatcher);
        }

        // Unknown format - attempt to identify and correct
        return attemptCitationCorrection(trimmedCitation);
    }

    /**
     * Validates multiple citations and returns aggregate results
     */
    public Map<String, Object> validateMultipleCitations(List<String> citations) {
        List<CitationValidationResult> results = new ArrayList<>();
        int validCount = 0;
        int correctedCount = 0;
        Map<String, Integer> typeCount = new HashMap<>();
        List<String> allErrors = new ArrayList<>();
        List<String> allWarnings = new ArrayList<>();

        for (String citation : citations) {
            CitationValidationResult result = validateCitation(citation);
            results.add(result);

            if (result.isValid()) {
                validCount++;
            }
            if (result.getCorrectedCitation() != null && !result.getCorrectedCitation().equals(result.getOriginalCitation())) {
                correctedCount++;
            }

            typeCount.merge(result.getCitationType(), 1, Integer::sum);
            allErrors.addAll(result.getErrors());
            allWarnings.addAll(result.getWarnings());
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCitations", citations.size());
        summary.put("validCitations", validCount);
        summary.put("correctedCitations", correctedCount);
        summary.put("invalidCitations", citations.size() - validCount);
        summary.put("validationRate", validCount * 100.0 / citations.size());
        summary.put("citationTypes", typeCount);
        summary.put("errors", allErrors);
        summary.put("warnings", allWarnings);
        summary.put("results", results.stream().map(CitationValidationResult::toMap).toList());

        return summary;
    }

    private CitationValidationResult validateFederalCaseCitation(String citation, Matcher matcher) {
        String caseName = matcher.group(1);
        String volume = matcher.group(2);
        String reporter = matcher.group(3);
        String page = matcher.group(4);
        String pincite = matcher.group(5);
        String court = matcher.group(6);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, String> metadata = new HashMap<>();

        metadata.put("caseName", caseName);
        metadata.put("volume", volume);
        metadata.put("reporter", reporter);
        metadata.put("page", page);
        metadata.put("court", court);

        // Validate case name format
        if (!caseName.contains(" v. ")) {
            errors.add("Case name should use 'v.' not 'vs.'");
        }

        // Check for italics requirement (can't verify in plain text)
        warnings.add("Ensure case name is italicized in final document");

        // Validate reporter abbreviation
        if (!isValidFederalReporter(reporter)) {
            errors.add("Invalid federal reporter abbreviation: " + reporter);
        }

        // Validate year format
        if (!court.matches(".*\\d{4}.*")) {
            errors.add("Missing or invalid year in court parenthetical");
        }

        // Check for pincite
        if (pincite == null) {
            warnings.add("Consider adding pincite for specific page reference");
        }

        boolean isValid = errors.isEmpty();
        String correctedCitation = isValid ? citation : buildCorrectedFederalCaseCitation(
            caseName, volume, reporter, page, pincite, court);

        return new CitationValidationResult(citation, isValid, "FEDERAL_CASE",
            correctedCitation, errors, warnings, metadata);
    }

    private CitationValidationResult validateStateCaseCitation(String citation, Matcher matcher) {
        String caseName = matcher.group(1);
        String volume = matcher.group(2);
        String reporter = matcher.group(3);
        String page = matcher.group(4);
        String pincite = matcher.group(5);
        String court = matcher.group(6);
        String year = matcher.group(7);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, String> metadata = new HashMap<>();

        metadata.put("caseName", caseName);
        metadata.put("volume", volume);
        metadata.put("reporter", reporter);
        metadata.put("page", page);
        metadata.put("court", court);
        metadata.put("year", year);

        // Validate Massachusetts-specific formatting
        if (reporter.startsWith("Mass.") && !court.startsWith("Mass.")) {
            errors.add("Massachusetts reporter should have Massachusetts court designation");
        }

        // Check year validity
        int yearInt = Integer.parseInt(year);
        int currentYear = LocalDate.now().getYear();
        if (yearInt > currentYear) {
            errors.add("Citation year cannot be in the future");
        } else if (yearInt < 1780) { // Massachusetts statehood
            warnings.add("Citation predates Massachusetts statehood (1780)");
        }

        boolean isValid = errors.isEmpty();
        return new CitationValidationResult(citation, isValid, "STATE_CASE",
            citation, errors, warnings, metadata);
    }

    private CitationValidationResult validateFederalStatuteCitation(String citation, Matcher matcher) {
        String title = matcher.group(1);
        String section = matcher.group(2);
        String subsection = matcher.group(3);
        String year = matcher.group(4);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, String> metadata = new HashMap<>();

        metadata.put("title", title);
        metadata.put("section", section);
        if (subsection != null) metadata.put("subsection", subsection);
        if (year != null) metadata.put("year", year);

        // Validate title number
        int titleNum = Integer.parseInt(title);
        if (titleNum < 1 || titleNum > 54) {
            errors.add("Invalid U.S.C. title number (must be 1-54)");
        }

        // Check for year
        if (year == null) {
            warnings.add("Consider adding year in parentheses for currency");
        } else {
            int yearInt = Integer.parseInt(year);
            int currentYear = LocalDate.now().getYear();
            if (yearInt != currentYear && yearInt != currentYear - 1) {
                warnings.add("Citation may not be to current version of statute");
            }
        }

        boolean isValid = errors.isEmpty();
        String correctedCitation = isValid ? citation :
            String.format("%s U.S.C. § %s%s (%d)",
                title, section,
                subsection != null ? "(" + subsection + ")" : "",
                LocalDate.now().getYear());

        return new CitationValidationResult(citation, isValid, "FEDERAL_STATUTE",
            correctedCitation, errors, warnings, metadata);
    }

    private CitationValidationResult validateCFRCitation(String citation, Matcher matcher) {
        String title = matcher.group(1);
        String section = matcher.group(2);
        String subsection = matcher.group(3);
        String year = matcher.group(4);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, String> metadata = new HashMap<>();

        metadata.put("title", title);
        metadata.put("section", section);
        if (subsection != null) metadata.put("subsection", subsection);
        if (year != null) metadata.put("year", year);

        // Check title 8 for immigration
        if ("8".equals(title)) {
            metadata.put("subject", "Immigration");
        }

        // Validate year currency
        if (year == null) {
            warnings.add("Add year for CFR citations to indicate currency");
        }

        boolean isValid = errors.isEmpty();
        return new CitationValidationResult(citation, isValid, "FEDERAL_REGULATION",
            citation, errors, warnings, metadata);
    }

    private CitationValidationResult validateMassachusettsStatuteCitation(String citation, Matcher matcher) {
        String chapter = matcher.group(1);
        String section = matcher.group(2);
        String year = matcher.group(3);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, String> metadata = new HashMap<>();

        metadata.put("chapter", chapter);
        metadata.put("section", section);
        if (year != null) metadata.put("year", year);

        // Validate chapter format
        if (!chapter.matches("\\d+[A-Z]?")) {
            errors.add("Invalid chapter format");
        }

        // Check for proper abbreviation
        if (!citation.startsWith("Mass. Gen. Laws") && !citation.startsWith("M.G.L.")) {
            warnings.add("Use standard abbreviation: M.G.L. or Mass. Gen. Laws");
        }

        boolean isValid = errors.isEmpty();
        String correctedCitation = isValid ? citation :
            String.format("M.G.L. c. %s, § %s", chapter, section);

        return new CitationValidationResult(citation, isValid, "MASSACHUSETTS_STATUTE",
            correctedCitation, errors, warnings, metadata);
    }

    private CitationValidationResult validateMassachusettsRuleCitation(String citation, Matcher matcher) {
        String ruleType = matcher.group(1);
        String ruleNumber = matcher.group(2);
        String subsection = matcher.group(3);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, String> metadata = new HashMap<>();

        metadata.put("ruleType", ruleType);
        metadata.put("ruleNumber", ruleNumber);
        if (subsection != null) metadata.put("subsection", subsection);

        // Validate rule type
        if (!List.of("Civ", "Crim", "App", "Evid").contains(ruleType)) {
            errors.add("Invalid rule type (must be Civ, Crim, App, or Evid)");
        }

        // Check for common formatting issues
        if (citation.contains("Rule") && !citation.contains("R.")) {
            warnings.add("Use abbreviated form 'R.' instead of 'Rule'");
        }

        boolean isValid = errors.isEmpty();
        return new CitationValidationResult(citation, isValid, "MASSACHUSETTS_RULE",
            citation, errors, warnings, metadata);
    }

    private CitationValidationResult attemptCitationCorrection(String citation) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String corrected = citation;

        // Common corrections
        if (citation.contains(" vs ")) {
            corrected = corrected.replace(" vs ", " v. ");
            errors.add("Use 'v.' not 'vs' in case names");
        }

        if (citation.contains("USC")) {
            corrected = corrected.replace("USC", "U.S.C.");
            errors.add("Use proper spacing: U.S.C. not USC");
        }

        if (citation.contains("CFR")) {
            corrected = corrected.replace("CFR", "C.F.R.");
            errors.add("Use proper spacing: C.F.R. not CFR");
        }

        if (citation.contains("Mass Gen Laws")) {
            corrected = corrected.replace("Mass Gen Laws", "Mass. Gen. Laws");
            errors.add("Use proper abbreviation periods");
        }

        // Detect potential type
        String citationType = "UNKNOWN";
        if (citation.contains("U.S.") || citation.contains("F.") || citation.contains("F. Supp.")) {
            citationType = "LIKELY_FEDERAL_CASE";
        } else if (citation.contains("U.S.C.")) {
            citationType = "LIKELY_FEDERAL_STATUTE";
        } else if (citation.contains("C.F.R.")) {
            citationType = "LIKELY_FEDERAL_REGULATION";
        } else if (citation.contains("Mass.") || citation.contains("M.G.L.")) {
            citationType = "LIKELY_MASSACHUSETTS";
        }

        errors.add("Citation format not recognized - manual verification required");
        warnings.add("Consider consulting Bluebook for proper format");

        return new CitationValidationResult(citation, false, citationType,
            corrected, errors, warnings, null);
    }

    private boolean isValidFederalReporter(String reporter) {
        List<String> validReporters = List.of(
            "U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d",
            "F.", "F.2d", "F.3d", "F.4d",
            "F. Supp.", "F. Supp. 2d", "F. Supp. 3d",
            "F. App'x", "Fed. App'x"
        );
        return validReporters.contains(reporter);
    }

    private String buildCorrectedFederalCaseCitation(String caseName, String volume,
                                                     String reporter, String page,
                                                     String pincite, String court) {
        StringBuilder corrected = new StringBuilder();

        // Ensure proper case name format
        if (!caseName.contains(" v. ")) {
            caseName = caseName.replace(" vs. ", " v. ").replace(" vs ", " v. ");
        }

        corrected.append(caseName).append(", ");
        corrected.append(volume).append(" ");
        corrected.append(reporter).append(" ");
        corrected.append(page);

        if (pincite != null) {
            corrected.append(", ").append(pincite);
        }

        corrected.append(" (").append(court).append(")");

        return corrected.toString();
    }

    /**
     * Extracts all citations from a text and validates them
     */
    public Map<String, Object> extractAndValidateCitations(String text) {
        List<String> extractedCitations = extractCitations(text);
        Map<String, Object> validationResults = validateMultipleCitations(extractedCitations);

        // Add extraction metadata
        Map<String, Object> results = new HashMap<>(validationResults);
        results.put("textLength", text.length());
        results.put("citationsExtracted", extractedCitations.size());
        results.put("extractionTimestamp", LocalDate.now().format(DateTimeFormatter.ISO_DATE));

        return results;
    }

    private List<String> extractCitations(String text) {
        List<String> citations = new ArrayList<>();

        // Extract potential citations using various patterns
        // This is a simplified extraction - a full implementation would be more sophisticated

        // Pattern for case citations
        Pattern casePattern = Pattern.compile("[A-Z][\\w\\s\\.,'&-]+ v\\. [\\w\\s\\.,'&-]+,\\s*\\d+\\s+[A-Z\\.\\s\\d]+\\s+\\d+[^\\n]*?\\)");
        Matcher caseMatcher = casePattern.matcher(text);
        while (caseMatcher.find()) {
            citations.add(caseMatcher.group().trim());
        }

        // Pattern for statute citations
        Pattern statutePattern = Pattern.compile("\\d+\\s+U\\.S\\.C\\.\\s+§\\s*\\d+[a-z]?(?:\\([a-z0-9\\)\\(]+\\))?(?:\\s*\\(\\d{4}\\))?");
        Matcher statuteMatcher = statutePattern.matcher(text);
        while (statuteMatcher.find()) {
            citations.add(statuteMatcher.group().trim());
        }

        // Pattern for CFR citations
        Pattern cfrPattern = Pattern.compile("\\d+\\s+C\\.F\\.R\\.\\s+§\\s*[\\d\\.]+(?:\\([a-z0-9\\)\\(]+\\))?(?:\\s*\\(\\d{4}\\))?");
        Matcher cfrMatcher = cfrPattern.matcher(text);
        while (cfrMatcher.find()) {
            citations.add(cfrMatcher.group().trim());
        }

        // Pattern for Massachusetts citations
        Pattern massPattern = Pattern.compile("(?:Mass\\.\\s+Gen\\.\\s+Laws|M\\.G\\.L\\.)\\s+c(?:h)?\\.\\s*\\d+[A-Z]?,\\s*§\\s*\\d+[A-Z]?");
        Matcher massMatcher = massPattern.matcher(text);
        while (massMatcher.find()) {
            citations.add(massMatcher.group().trim());
        }

        return citations;
    }
}