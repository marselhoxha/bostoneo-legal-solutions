package com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury;

import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiCrossMatterPatternDto;
import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiInsightDto;
import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiRiskAlertDto;
import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Personal Injury dashboard data assembly. Ports the algorithms behind the
 * frontend getters {@code aiInsights}, {@code riskAlerts}, and
 * {@code crossMatterPattern} on {@code attorney-dashboard.component.ts} so
 * the same payloads can be served from the API.
 *
 * <p>The service is intentionally decoupled from the security principal
 * type — callers pass the resolved {@code organizationId}. Tenant scoping
 * is enforced via {@link LegalCaseRepository#findByOrganizationId(Long)}.</p>
 *
 * <p>Several heuristics in the TS getters are derived from frontend-only
 * mock data (e.g. "5+ matters → comm-gap warning"). They have been ported
 * faithfully so the dashboard shape is preserved, but real signals
 * (treatment-record completeness, last-contact timestamps, …) will replace
 * them in subsequent phases. Sites that need real signals are marked with
 * {@code TODO}.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PersonalInjuryDashboardService {

    /** Hard cap on insights returned, matching the {@code .slice(0, 3)} on the TS getter. */
    private static final int MAX_INSIGHTS = 3;

    /** Hard cap on risk alerts returned, matching the {@code .slice(0, 4)} on the TS getter. */
    private static final int MAX_RISK_ALERTS = 4;

    /** Hard cap on matters surfaced in a cross-matter pattern, matching {@code piCases.slice(0, 3)}. */
    private static final int MAX_CROSS_MATTER_MATTERS = 3;

    /** Background palette used by {@code getClientAvatarBg} on the frontend. */
    private static final String[] AVATAR_COLORS = {
            "#0b64e9", "#f97006", "#16a34a", "#6b4aff", "#f24149", "#0891b2"
    };

    private final LegalCaseRepository legalCaseRepository;

    // ────────────────────────────────────────────────────────────────────
    // Insights
    // ────────────────────────────────────────────────────────────────────

    /**
     * Build the AI insights row for the attorney's PI cases. Mirrors the
     * branches of the TS {@code aiInsights} getter:
     *
     * <ol>
     *   <li>Treatment-gap card on the first PI case found.</li>
     *   <li>Settlement-update card on the first high-priority case.</li>
     *   <li>Cross-matter pattern card when ≥3 cases exist.</li>
     * </ol>
     */
    public List<PiInsightDto> getInsights(Long organizationId) {
        List<LegalCase> cases = loadPiCases(organizationId);
        List<PiInsightDto> insights = new ArrayList<>();

        // Treatment-gap card — TS uses any PI case; with the practice-area
        // filter applied here, every case in the list qualifies.
        cases.stream().findFirst().ifPresent(piCase -> insights.add(new PiInsightDto(
                "gap",
                "Treatment gap",
                "ri-flashlight-fill",
                "orange",
                matterLabel(piCase),
                // TODO: replace mock copy with real medical-record gap detection
                // once treatment-record completeness signals exist.
                "Possible treatment gap detected. Provider records may be incomplete — review for claim strength.",
                "Generate analysis",
                piCase.getId()
        )));

        // Settlement-update card — TS keys off priority === 'high'.
        cases.stream()
                .filter(c -> c.getPriority() == CasePriority.HIGH)
                .findFirst()
                .ifPresent(highPriority -> insights.add(new PiInsightDto(
                        "settlement",
                        "Settlement updated",
                        "ri-checkbox-circle-fill",
                        "green",
                        matterLabel(highPriority),
                        // TODO: pull real comparable-cases signal once the
                        // settlement-projection service exists.
                        "AI updated settlement range based on 3 comparable cases this quarter. Review projection.",
                        "View comparables",
                        highPriority.getId()
                )));

        // Cross-matter pattern card — surfaced once ≥3 PI matters present.
        if (cases.size() >= 3) {
            insights.add(new PiInsightDto(
                    "pattern",
                    "Pattern detected",
                    "ri-pulse-line",
                    "violet",
                    cases.size() + " matters",
                    "AI suggests grouping similar matters for batch review. Strategy memo available.",
                    "View memo",
                    null
            ));
        }

        return insights.size() <= MAX_INSIGHTS
                ? insights
                : insights.subList(0, MAX_INSIGHTS);
    }

    // ────────────────────────────────────────────────────────────────────
    // Risk alerts
    // ────────────────────────────────────────────────────────────────────

    /**
     * Build the risk alerts strip. The TS getter draws on
     * {@code urgentItems} for the SOL-style critical row; that data lives
     * on the frontend (composed from tasks, deadlines, hearings). The
     * ported version surfaces:
     *
     * <ul>
     *   <li>{@code doc-stale} warning when any case is in {@code PENDING} status.</li>
     *   <li>{@code comm-gap} warning when ≥5 PI matters exist.</li>
     * </ul>
     *
     * The {@code sol} critical alert is intentionally omitted — see the
     * TODO below; until urgent-items is exposed via the API, we don't have
     * a backend signal that maps to "urgent.priority === critical".
     */
    public List<PiRiskAlertDto> getRiskAlerts(Long organizationId) {
        List<LegalCase> cases = loadPiCases(organizationId);
        List<PiRiskAlertDto> alerts = new ArrayList<>();

        // TODO: port the {@code criticalUrgent} branch once an API surface
        // exists for the frontend's {@code urgentItems} stream. The TS
        // version pushes a critical SOL alert when any urgent item is
        // marked {@code priority === 'critical'}; we don't expose urgent
        // items from the backend yet.

        cases.stream()
                .filter(c -> c.getStatus() == CaseStatus.PENDING)
                .findFirst()
                .ifPresent(stale -> alerts.add(new PiRiskAlertDto(
                        "warning",
                        "doc-stale",
                        "Document awaiting signature",
                        titleOrFallback(stale) + " · pending client action",
                        null
                )));

        if (cases.size() >= 5) {
            int unupdated = Math.min(2, cases.size());
            alerts.add(new PiRiskAlertDto(
                    "warning",
                    "comm-gap",
                    "Client communication gap",
                    unupdated + " clients haven't been updated in 7+ days",
                    null
            ));
        }

        return alerts.size() <= MAX_RISK_ALERTS
                ? alerts
                : alerts.subList(0, MAX_RISK_ALERTS);
    }

    // ────────────────────────────────────────────────────────────────────
    // Cross-matter pattern
    // ────────────────────────────────────────────────────────────────────

    /**
     * Compose the cross-matter pattern card. Returns {@code null} when
     * fewer than the threshold (3 cases overall, ≥2 PI cases) exist —
     * matching the {@code crossMatterPattern} getter's nullable contract.
     */
    public PiCrossMatterPatternDto getCrossMatterPattern(Long organizationId) {
        List<LegalCase> cases = loadPiCases(organizationId);
        if (cases.size() < 3) {
            return null;
        }
        // The TS version filters to PI cases inside the getter; here every
        // case in {@code cases} is already PI-scoped. We keep the ≥2 guard
        // for parity even though it's redundant now.
        if (cases.size() < 2) {
            return null;
        }

        List<PiCrossMatterPatternDto.MatterRef> matters = new ArrayList<>();
        int limit = Math.min(MAX_CROSS_MATTER_MATTERS, cases.size());
        for (int i = 0; i < limit; i++) {
            String clientName = cases.get(i).getClientName();
            String safeName = clientName == null || clientName.isBlank() ? "Client" : clientName;
            matters.add(new PiCrossMatterPatternDto.MatterRef(
                    initialsFromName(safeName),
                    avatarBgFor(safeName),
                    safeName.split(" ")[0]
            ));
        }

        return new PiCrossMatterPatternDto(
                "Pattern across " + cases.size() + " personal injury matters",
                "These matters share treatment patterns and similar settlement ranges based on past comparable cases. Strategy memo and comparable outcomes available.",
                matters,
                "Open strategy memo",
                "Compare outcomes"
        );
    }

    // ────────────────────────────────────────────────────────────────────
    // Internals
    // ────────────────────────────────────────────────────────────────────

    /**
     * Load PI-scoped cases for the org. Filters on the canonical
     * {@code practice_area} column when present, falling back to a
     * substring match on the legacy free-text {@code type} column for
     * data that predates the practice-area migration.
     */
    private List<LegalCase> loadPiCases(Long organizationId) {
        if (organizationId == null) {
            return List.of();
        }
        // TODO: replace with assigned-attorney scoping once
        // {@code LegalCase.assignedAttorneyId} (or an equivalent join via
        // case_role_assignments) exists. Today the cases table tracks
        // attorneys only via case_role_assignments; org-level scoping is
        // the closest surface available without that join.
        List<LegalCase> all = legalCaseRepository.findByOrganizationId(organizationId);
        List<LegalCase> filtered = new ArrayList<>(all.size());
        for (LegalCase c : all) {
            if (isPersonalInjury(c)) {
                filtered.add(c);
            }
        }
        return filtered;
    }

    private boolean isPersonalInjury(LegalCase c) {
        // Canonical signal: practice_area enum slug stored on the row.
        if (c.getPracticeArea() != null) {
            String pa = c.getPracticeArea().trim();
            if (PracticeArea.fromString(pa)
                    .filter(PracticeArea.PERSONAL_INJURY::equals)
                    .isPresent()) {
                return true;
            }
        }
        // Legacy fallback: matches the TS test
        // {@code caseType?.toLowerCase().includes('personal injury') || ... 'pi'}.
        if (c.getType() != null) {
            String t = c.getType().toLowerCase(Locale.ROOT);
            return t.contains("personal injury") || t.equals("pi");
        }
        return false;
    }

    private String matterLabel(LegalCase c) {
        if (c.getClientName() != null && !c.getClientName().isBlank()) {
            return c.getClientName();
        }
        return titleOrFallback(c);
    }

    private String titleOrFallback(LegalCase c) {
        return c.getTitle() != null && !c.getTitle().isBlank() ? c.getTitle() : "Untitled matter";
    }

    private String initialsFromName(String name) {
        if (name == null || name.isBlank()) return "??";
        String[] parts = name.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0].length() >= 2
                    ? parts[0].substring(0, 2).toUpperCase(Locale.ROOT)
                    : parts[0].toUpperCase(Locale.ROOT);
        }
        return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0))
                .toUpperCase(Locale.ROOT);
    }

    private String avatarBgFor(String name) {
        // Same hash function as the TS {@code getClientAvatarBg} so avatars
        // stay stable when the dashboard switches from local data to the
        // API payload.
        int hash = 0;
        for (int i = 0; i < name.length(); i++) {
            hash = (hash << 5) - hash + name.charAt(i);
        }
        int idx = Math.abs(hash) % AVATAR_COLORS.length;
        return AVATAR_COLORS[idx];
    }
}
