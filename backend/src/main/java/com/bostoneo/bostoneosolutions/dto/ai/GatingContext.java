package com.bostoneo.bostoneosolutions.dto.ai;

/**
 * Computed gating state for a document generation request.
 * Captures the subset of {@link DocumentTypeTemplate} §6.1 fields relevant to
 * watermarking, verification-overdue warnings, disclaimer rendering, and audit.
 *
 * Separate from {@link DocumentTypeTemplate} so gating can be computed once per
 * request without mutating the shared registry instance.
 */
public record GatingContext(
        String approvalStatus,      // "draft" | "in_review" | "attorney_reviewed" | "production_ready" | null
        boolean isOverdue,          // true when today > nextReviewDue (warn-only)
        String templateType,        // e.g. "demand_letter_pi_ma" (resolved key from cascade)
        String templateVersion,     // e.g. "2026.04.23-draft"
        String lastVerified,        // ISO date string or null
        String nextReviewDue,       // ISO date string or null
        String disclaimer           // footer text or null
) {
    public boolean isDraft() {
        return "draft".equalsIgnoreCase(approvalStatus);
    }

    public boolean isInReview() {
        return "in_review".equalsIgnoreCase(approvalStatus);
    }

    public boolean hasDisclaimer() {
        return disclaimer != null && !disclaimer.isBlank();
    }

    public boolean requiresWatermark() {
        return isDraft() || isInReview();
    }
}
