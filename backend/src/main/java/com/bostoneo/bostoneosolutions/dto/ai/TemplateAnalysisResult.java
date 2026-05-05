package com.bostoneo.bostoneosolutions.dto.ai;

import com.bostoneo.bostoneosolutions.service.ai.importing.ImportWarning;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Claude's structured analysis of an uploaded template.
 *
 * <p>Claude returns classification + detected variables + body boundary anchors (short
 * verbatim line markers identifying letterhead/signature edges and the document title).
 * The Java side then slices the body out of the original extracted text, substitutes
 * {@code {{key}}} placeholders, and HTML-formats the result — populating
 * {@link #suggestedBodyWithPlaceholders} post-Claude. The attorney accepts / rejects /
 * edits each variable in the review step before committing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TemplateAnalysisResult {

    private Classification classification;
    private List<DetectedVariable> detectedVariables;
    private List<ImportWarning> warnings;
    private String suggestedName;
    private String suggestedDescription;
    /**
     * Final HTML body shown in the review preview and persisted to the DB.
     * NOT returned by Claude — populated by Java after slicing + substituting + formatting
     * against the original extracted text. Field is kept on the DTO so the existing
     * persistence and frontend code paths remain unchanged.
     */
    private String suggestedBodyWithPlaceholders;
    private Boolean requiresManualClassification;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Classification {
        private String documentType;    // e.g. "lor", "motion_to_dismiss", "complaint"
        private String practiceArea;    // slug from PRACTICE_AREAS enum (pi, family, criminal, ...)
        private String jurisdiction;    // ISO state code ("MA", "TX"...) or "federal" or null
        private Double confidence;      // 0.0 .. 1.0
        private String evidence;        // human-readable justification snippet
        private String category;        // TemplateCategory enum name — CORRESPONDENCE for letters, etc.
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DetectedVariable {
        private String rawText;            // e.g. "[CLIENT_NAME]" or "___________"
        private String suggestedKey;       // e.g. "client_name"
        private String suggestedLabel;     // e.g. "Client Name"
        private String dataType;           // VariableType enum name (TEXT | DATE | NUMBER | ...)
        private Double confidence;         // 0.0 .. 1.0
        private Integer occurrences;       // how many times it appears in the body
        private Boolean isPreExistingPlaceholder; // true if already {{mustache}} syntax

        /** Review-step editable fields default to the suggestions. */
        public String getEffectiveKey()   { return suggestedKey; }
        public String getEffectiveLabel() { return suggestedLabel; }
    }

    public List<ImportWarning> safeWarnings() {
        return warnings == null ? new ArrayList<>() : warnings;
    }

    public List<DetectedVariable> safeDetectedVariables() {
        return detectedVariables == null ? new ArrayList<>() : detectedVariables;
    }
}
