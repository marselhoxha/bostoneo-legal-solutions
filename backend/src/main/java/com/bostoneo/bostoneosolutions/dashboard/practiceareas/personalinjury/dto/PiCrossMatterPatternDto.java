package com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto;

import java.util.List;

/**
 * Mirrors the shape produced by the frontend {@code crossMatterPattern} getter
 * on {@code attorney-dashboard.component.ts}. Returned as the body of
 * {@code GET /api/v2/dashboard/personal-injury/cross-matter}; the endpoint
 * may return {@code null} (HTTP 200 with a null body) when no pattern emerges
 * — matching the TS getter's contract.
 */
public record PiCrossMatterPatternDto(
        String title,
        String summary,
        List<MatterRef> matters,
        String primaryLabel,
        String secondaryLabel
) {

    /**
     * Compact reference to a matter for the avatar strip rendered alongside
     * the cross-matter narrative.
     *
     * @param initials Two-letter avatar text derived from the client name.
     * @param bg       Hex background color for the avatar (deterministic from name).
     * @param label    Short visible label (typically first name).
     */
    public record MatterRef(String initials, String bg, String label) {}
}
