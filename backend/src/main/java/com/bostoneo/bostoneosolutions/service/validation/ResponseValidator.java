package com.bostoneo.bostoneosolutions.service.validation;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Validates AI responses for temporal logic errors
 * Prevents malpractice-level errors by detecting advice for passed deadlines
 */
@Service
@Slf4j
public class ResponseValidator {

    // Patterns to detect date mentions in responses
    private static final Pattern DATE_PATTERN = Pattern.compile(
        "(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2}),?\\s+(\\d{4})"
    );

    private static final Pattern ISO_DATE_PATTERN = Pattern.compile(
        "(\\d{4})-(\\d{2})-(\\d{2})"
    );

    // Patterns that indicate advice for future events
    private static final Pattern[] FUTURE_ADVICE_PATTERNS = {
        Pattern.compile("prepare for.*hearing", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(\\d+)\\s+days? (until|from now)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("deadline.*in\\s+(\\d+)\\s+days?", Pattern.CASE_INSENSITIVE),
        Pattern.compile("must.*file.*by", Pattern.CASE_INSENSITIVE),
        Pattern.compile("upcoming.*hearing", Pattern.CASE_INSENSITIVE)
    };

    /**
     * Validate response for temporal consistency
     */
    public ValidationResult validateTemporalConsistency(String response, LocalDate currentDate) {
        ValidationResult result = new ValidationResult();
        result.setValid(true);

        if (response == null || response.isEmpty()) {
            result.setValid(false);
            result.addError("Empty response");
            return result;
        }

        log.debug("Validating response for temporal consistency (current date: {})", currentDate);

        // Extract all dates mentioned in response
        List<LocalDate> mentionedDates = extractDates(response);
        List<LocalDate> passedDates = new ArrayList<>();

        for (LocalDate date : mentionedDates) {
            if (date.isBefore(currentDate)) {
                passedDates.add(date);
            }
        }

        // Check if response gives future-oriented advice for passed dates
        if (!passedDates.isEmpty()) {
            for (LocalDate passedDate : passedDates) {
                if (containsFutureAdviceForDate(response, passedDate)) {
                    String warning = String.format(
                        "Response contains preparation advice for PASSED deadline: %s (was %d days ago)",
                        passedDate.format(DateTimeFormatter.ofPattern("MMMM d, yyyy")),
                        java.time.temporal.ChronoUnit.DAYS.between(passedDate, currentDate)
                    );
                    result.addWarning(warning);
                    result.setValid(false);
                }
            }
        }

        // Check for temporal contradictions (e.g., "129 days until February 2025" when it's October 2025)
        Pattern contradictionPattern = Pattern.compile(
            "(\\d+)\\s+days?\\s+(until|from now|to|before).*?(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2}),?\\s+(\\d{4})",
            Pattern.CASE_INSENSITIVE
        );

        Matcher matcher = contradictionPattern.matcher(response);
        while (matcher.find()) {
            try {
                int daysUntil = Integer.parseInt(matcher.group(1));
                String month = matcher.group(3);
                String day = matcher.group(4);
                String year = matcher.group(5);

                String dateStr = String.format("%s %s, %s", month, day, year);
                LocalDate mentionedDate = LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("MMMM d, yyyy"));

                long actualDays = java.time.temporal.ChronoUnit.DAYS.between(currentDate, mentionedDate);

                // If the mentioned days and actual days differ significantly
                if (Math.abs(actualDays - daysUntil) > 7) {  // Allow 1 week tolerance
                    String warning = String.format(
                        "Temporal contradiction: Response says '%d days until %s' but actually it's %d days (difference: %d days)",
                        daysUntil,
                        dateStr,
                        actualDays,
                        Math.abs(actualDays - daysUntil)
                    );
                    result.addWarning(warning);
                    result.setValid(false);
                }

                // If date is in the past but response says "days until"
                if (mentionedDate.isBefore(currentDate) && daysUntil > 0) {
                    String error = String.format(
                        "CRITICAL: Response says '%d days until %s' but that date was %d days AGO",
                        daysUntil,
                        dateStr,
                        Math.abs(actualDays)
                    );
                    result.addError(error);
                    result.setValid(false);
                }

            } catch (Exception e) {
                log.debug("Could not parse date from contradiction pattern: {}", e.getMessage());
            }
        }

        // Log validation results
        if (!result.isValid()) {
            log.warn("Temporal validation FAILED: {} errors, {} warnings",
                result.getErrors().size(), result.getWarnings().size());
            result.getErrors().forEach(error -> log.warn("  ERROR: {}", error));
            result.getWarnings().forEach(warning -> log.warn("  WARNING: {}", warning));
        } else {
            log.debug("Temporal validation PASSED");
        }

        return result;
    }

    /**
     * Extract all dates mentioned in response
     */
    private List<LocalDate> extractDates(String response) {
        List<LocalDate> dates = new ArrayList<>();

        // Extract dates in "Month Day, Year" format
        Matcher dateMatcher = DATE_PATTERN.matcher(response);
        while (dateMatcher.find()) {
            try {
                String dateStr = dateMatcher.group(0);
                LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("MMMM d, yyyy"));
                dates.add(date);
            } catch (DateTimeParseException e) {
                log.debug("Could not parse date: {}", dateMatcher.group(0));
            }
        }

        // Extract dates in ISO format (YYYY-MM-DD)
        Matcher isoMatcher = ISO_DATE_PATTERN.matcher(response);
        while (isoMatcher.find()) {
            try {
                String dateStr = isoMatcher.group(0);
                LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
                dates.add(date);
            } catch (DateTimeParseException e) {
                log.debug("Could not parse ISO date: {}", isoMatcher.group(0));
            }
        }

        return dates;
    }

    /**
     * Check if response contains future-oriented advice near a specific date
     */
    private boolean containsFutureAdviceForDate(String response, LocalDate date) {
        String dateStr = date.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));

        // Find the section of text near this date
        int dateIndex = response.indexOf(dateStr);
        if (dateIndex == -1) {
            dateIndex = response.indexOf(date.format(DateTimeFormatter.ofPattern("MMM d, yyyy")));
        }
        if (dateIndex == -1) {
            return false;
        }

        // Check text within 200 characters before and after the date
        int start = Math.max(0, dateIndex - 200);
        int end = Math.min(response.length(), dateIndex + 200);
        String context = response.substring(start, end);

        // Check if context contains future-oriented advice patterns
        for (Pattern pattern : FUTURE_ADVICE_PATTERNS) {
            if (pattern.matcher(context).find()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Result of validation
     */
    @Data
    public static class ValidationResult {
        private boolean valid = true;
        private List<String> errors = new ArrayList<>();
        private List<String> warnings = new ArrayList<>();

        public void addError(String error) {
            errors.add(error);
            valid = false;
        }

        public void addWarning(String warning) {
            warnings.add(warning);
        }

        public boolean hasIssues() {
            return !errors.isEmpty() || !warnings.isEmpty();
        }

        public String getSummary() {
            if (valid && !hasIssues()) {
                return "Validation passed";
            }
            return String.format("Validation %s: %d errors, %d warnings",
                valid ? "passed with warnings" : "FAILED",
                errors.size(),
                warnings.size());
        }
    }
}
