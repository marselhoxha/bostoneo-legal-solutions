package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response payload for GET /api/ai/document-types?practiceArea=...&jurisdiction=...
 *
 * Drives the draft-wizard Step 2 rendering — tiered list of doc types that actually have
 * PA-specific templates in {@code DocumentTypeTemplateRegistry}. When a practice area has no
 * coverage, {@code hasCoverage} is false and the frontend renders a "coming soon" empty state
 * that points to the Template Library.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PracticeAreaCatalogResponse {

    private String practiceAreaSlug;      // "pi", "family", "estate"
    private String practiceAreaName;      // "Personal Injury"
    private String jurisdiction;          // echoed from query, normalized ("ma", "federal", or null)
    private boolean hasCoverage;          // false → frontend renders empty state; no entries
    private List<CatalogTier> tiers;      // T1/T2/T3; empty when hasCoverage=false
    private String emptyStateMessage;     // populated when hasCoverage=false

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CatalogTier {
        private String tierName;          // "Essential" / "Common" / "Occasional"
        private int tierRank;             // 1 / 2 / 3
        private List<CatalogEntry> types;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CatalogEntry {
        private String documentType;      // canonical slug sent to generation (e.g. "lor", "divorce_petition")
        private String documentTypeUiId;  // UI-catalog id for icon/desc lookup (e.g. "letter-of-representation")
        private String displayName;       // "Letter of Representation"
        private String category;          // "letter" | "pleading" | "contract" | "discovery" | "motion"
        private String description;       // one-line tagline for the doctype card
        private boolean hasSpecificTemplate;  // true → PA-specific template exists; false → generic fallback (Civil only)
    }
}
