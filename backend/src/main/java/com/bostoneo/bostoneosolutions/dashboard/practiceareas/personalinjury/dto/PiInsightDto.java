package com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto;

/**
 * Mirrors the shape produced by the frontend {@code aiInsights} getter on
 * {@code attorney-dashboard.component.ts}. Field names match the TS interface
 * 1:1 so the existing template can switch from the local getter to the API
 * payload without further mapping.
 *
 * @param category       Insight kind (e.g. {@code "gap"}, {@code "settlement"}, {@code "pattern"}).
 * @param categoryLabel  Short human label (e.g. {@code "Treatment gap"}).
 * @param iconClass      Remix icon class for the leading bullet.
 * @param accentColor    Tailwind/Velzon accent token: {@code orange}, {@code green}, {@code violet}, {@code blue}.
 * @param matter         Display text for the matter — typically client name or case title.
 * @param description    Longer narrative shown under the headline.
 * @param actionLabel    CTA copy for the row's action button.
 * @param caseId         When the insight references a specific case, the case id; nullable for cross-matter.
 */
public record PiInsightDto(
        String category,
        String categoryLabel,
        String iconClass,
        String accentColor,
        String matter,
        String description,
        String actionLabel,
        Long caseId
) {}
