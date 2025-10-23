package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Service for validating and sanitizing research queries
 * Helps prevent abuse, improve quality, and provide user feedback
 */
@Service
@Slf4j
public class QueryValidationService {

    private static final int MIN_QUERY_LENGTH = 10;
    private static final int MAX_QUERY_LENGTH = 2000;
    private static final int RECOMMENDED_MIN_LENGTH = 15;
    private static final int RECOMMENDED_MAX_LENGTH = 500;

    // Patterns for detecting problematic queries
    private static final Pattern EXCESSIVE_PUNCTUATION = Pattern.compile("[!?.]{4,}");
    private static final Pattern EXCESSIVE_CAPS = Pattern.compile("[A-Z\\s]{50,}");
    private static final Pattern SPAM_PATTERN = Pattern.compile("(.)\\1{10,}"); // Same char repeated 10+ times

    /**
     * Validation result
     */
    public static class ValidationResult {
        public final boolean isValid;
        public final String errorMessage;
        public final List<String> warnings;
        public final List<String> suggestions;
        public final String sanitizedQuery;

        public ValidationResult(boolean isValid, String errorMessage, List<String> warnings,
                               List<String> suggestions, String sanitizedQuery) {
            this.isValid = isValid;
            this.errorMessage = errorMessage;
            this.warnings = warnings;
            this.suggestions = suggestions;
            this.sanitizedQuery = sanitizedQuery;
        }

        public static ValidationResult valid(String sanitizedQuery, List<String> warnings, List<String> suggestions) {
            return new ValidationResult(true, null, warnings, suggestions, sanitizedQuery);
        }

        public static ValidationResult invalid(String errorMessage) {
            return new ValidationResult(false, errorMessage, List.of(), List.of(), null);
        }
    }

    /**
     * Validate and sanitize a research query
     */
    public ValidationResult validateQuery(String query, String mode) {
        List<String> warnings = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();

        // Check if query is null or empty
        if (query == null || query.trim().isEmpty()) {
            return ValidationResult.invalid("Query cannot be empty");
        }

        String sanitized = query.trim();

        // Length validation
        if (sanitized.length() < MIN_QUERY_LENGTH) {
            return ValidationResult.invalid(
                "Query too short (minimum " + MIN_QUERY_LENGTH + " characters). " +
                "Please provide more detail for better results."
            );
        }

        if (sanitized.length() > MAX_QUERY_LENGTH) {
            return ValidationResult.invalid(
                "Query too long (maximum " + MAX_QUERY_LENGTH + " characters). " +
                "Please be more concise or split into multiple queries."
            );
        }

        // Length recommendations
        if (sanitized.length() < RECOMMENDED_MIN_LENGTH) {
            warnings.add("Very short query. Adding more context will improve results.");
            suggestions.add("Try: 'What are the legal requirements for [your specific situation]?'");
        }

        if (sanitized.length() > RECOMMENDED_MAX_LENGTH) {
            warnings.add("Long query detected. Consider breaking into multiple focused questions.");
            suggestions.add("Split into: 1) Main legal question 2) Follow-up for details");
        }

        // Pattern validation
        if (EXCESSIVE_PUNCTUATION.matcher(sanitized).find()) {
            warnings.add("Excessive punctuation detected. Using normal punctuation will improve AI understanding.");
            sanitized = EXCESSIVE_PUNCTUATION.matcher(sanitized).replaceAll(".");
        }

        if (EXCESSIVE_CAPS.matcher(sanitized).find()) {
            warnings.add("Excessive capitalization detected. Mixed case is easier to read.");
        }

        if (SPAM_PATTERN.matcher(sanitized).find()) {
            return ValidationResult.invalid("Invalid query pattern detected");
        }

        // Content-based validation
        if (isJustKeywords(sanitized)) {
            warnings.add("Query appears to be just keywords. Full questions get better results.");
            suggestions.add("Instead of: 'asylum immigration' try: 'What are the requirements for asylum?'");
        }

        // Mode-specific suggestions
        if ("THOROUGH".equalsIgnoreCase(mode)) {
            if (isTooSimpleForThorough(sanitized)) {
                suggestions.add("This seems like a simple question. FAST mode may be more cost-effective.");
            }
        } else {
            if (isComplexForFast(sanitized)) {
                suggestions.add("This is a complex question. THOROUGH mode will provide deeper analysis.");
            }
        }

        // Check for common issues
        if (containsMultipleQuestions(sanitized)) {
            warnings.add("Multiple questions detected. Best results come from one focused question at a time.");
            suggestions.add("Consider asking each question separately for detailed answers.");
        }

        log.debug("Query validation: valid={}, warnings={}, query='{}'",
            true, warnings.size(), sanitized.substring(0, Math.min(50, sanitized.length())));

        return ValidationResult.valid(sanitized, warnings, suggestions);
    }

    /**
     * Check if query is just keywords (no question words or verbs)
     */
    private boolean isJustKeywords(String query) {
        String lower = query.toLowerCase();
        // If no question words and very short, likely just keywords
        boolean hasQuestionWords = lower.contains("what") || lower.contains("how") ||
            lower.contains("when") || lower.contains("where") || lower.contains("why") ||
            lower.contains("can") || lower.contains("should") || lower.contains("would") ||
            lower.contains("is") || lower.contains("are");

        return !hasQuestionWords && query.split("\\s+").length < 5;
    }

    /**
     * Check if query is too simple for THOROUGH mode
     */
    private boolean isTooSimpleForThorough(String query) {
        String lower = query.toLowerCase();

        // Very short queries
        if (query.length() < 30) {
            return true;
        }

        // Simple definition/lookup questions
        if (lower.matches(".*what (is|are) (a |an |the )?\\w+.*")) {
            return true;
        }

        return false;
    }

    /**
     * Check if query is complex and would benefit from THOROUGH mode
     */
    private boolean isComplexForFast(String query) {
        String lower = query.toLowerCase();

        // Look for complexity indicators
        boolean hasMultipleClauses = query.split("[,;]").length > 2;
        boolean hasComplexityWords = lower.contains("analyze") ||
            lower.contains("evaluate") ||
            lower.contains("compare") ||
            lower.contains("comprehensive") ||
            lower.contains("detail") ||
            lower.contains("strategy") ||
            lower.contains("all options") ||
            lower.contains("step by step");

        return hasMultipleClauses || hasComplexityWords || query.length() > 150;
    }

    /**
     * Check if query contains multiple distinct questions
     */
    private boolean containsMultipleQuestions(String query) {
        long questionMarkCount = query.chars().filter(ch -> ch == '?').count();
        return questionMarkCount > 1;
    }

    /**
     * Suggest optimal mode for a query
     */
    public String suggestMode(String query) {
        if (query == null || query.trim().isEmpty()) {
            return "FAST";
        }

        if (isComplexForFast(query)) {
            return "THOROUGH";
        }

        return "FAST";
    }
}
