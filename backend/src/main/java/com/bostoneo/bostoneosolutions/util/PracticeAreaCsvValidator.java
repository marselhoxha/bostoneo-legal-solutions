package com.bostoneo.bostoneosolutions.util;

import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import com.bostoneo.bostoneosolutions.exception.ApiException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Helpers for validating and normalizing comma-delimited PracticeArea strings
 * coming from request bodies (org-creation form, invitation form, etc.).
 *
 * Centralized so the "default to PERSONAL_INJURY" rule and the "must be a known
 * enum value" rule are applied identically across all entry points.
 */
public final class PracticeAreaCsvValidator {

    /**
     * Default applied when an org is created without an explicit
     * enabledPracticeAreas value. Per the v1 plan every firm gets at least
     * Personal Injury enabled so the new dashboard always has something to show.
     */
    public static final String DEFAULT_ENABLED_PRACTICE_AREAS = PracticeArea.PERSONAL_INJURY.name();

    private PracticeAreaCsvValidator() {
    }

    /**
     * Validate a comma-delimited PracticeArea CSV. Returns the normalized
     * (trimmed, deduplicated) CSV. Throws ApiException with HTTP-400 semantics
     * when any token is not a valid PracticeArea enum name.
     *
     * Null/blank input is allowed and returned as null — callers decide whether
     * to substitute a default.
     */
    public static String validateAndNormalize(String csv) {
        if (csv == null || csv.isBlank()) {
            return null;
        }
        Set<String> seen = new HashSet<>();
        List<String> normalized = new ArrayList<>();
        for (String token : csv.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            try {
                PracticeArea pa = PracticeArea.valueOf(trimmed);
                if (seen.add(pa.name())) {
                    normalized.add(pa.name());
                }
            } catch (IllegalArgumentException e) {
                throw new ApiException("Invalid practice area: '" + trimmed
                        + "'. Must be one of the PracticeArea enum values.");
            }
        }
        return normalized.isEmpty() ? null : String.join(",", normalized);
    }

    /**
     * Validate the CSV and apply the org-creation default when input is blank.
     * Always returns a non-null, non-blank CSV containing at least
     * PERSONAL_INJURY.
     */
    public static String validateOrDefault(String csv) {
        String normalized = validateAndNormalize(csv);
        return normalized != null ? normalized : DEFAULT_ENABLED_PRACTICE_AREAS;
    }

    /**
     * Verify every token in {@code requested} is also present in
     * {@code allowed}. Throws ApiException identifying the first offending
     * token. Both arguments must already be validated CSVs (so this method does
     * the subset check, not enum validation).
     *
     * Both arguments are treated as case-sensitive enum-name CSVs.
     */
    public static void requireSubset(String requested, String allowed) {
        if (requested == null || requested.isBlank()) {
            return;
        }
        Set<String> allowedSet = new HashSet<>();
        if (allowed != null && !allowed.isBlank()) {
            for (String token : allowed.split(",")) {
                String trimmed = token.trim();
                if (!trimmed.isEmpty()) {
                    allowedSet.add(trimmed);
                }
            }
        }
        for (String token : requested.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            if (!allowedSet.contains(trimmed)) {
                throw new ApiException("Practice area '" + trimmed
                        + "' is not enabled for this organization.");
            }
        }
    }
}
