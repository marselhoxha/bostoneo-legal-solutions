package com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto;

/**
 * Mirrors the shape produced by the frontend {@code riskAlerts} getter on
 * {@code attorney-dashboard.component.ts}.
 *
 * @param severity        One of {@code "critical"}, {@code "warning"}, {@code "info"}.
 * @param type            Domain-specific bucket (e.g. {@code "sol"}, {@code "doc-stale"}, {@code "comm-gap"}).
 * @param title           Short headline.
 * @param description     Sub-headline / detail line.
 * @param daysRemaining   Optional countdown displayed on SOL-style alerts; nullable when not applicable.
 */
public record PiRiskAlertDto(
        String severity,
        String type,
        String title,
        String description,
        Integer daysRemaining
) {}
