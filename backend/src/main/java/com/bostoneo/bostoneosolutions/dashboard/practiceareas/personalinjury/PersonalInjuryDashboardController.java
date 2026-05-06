package com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury;

import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiCrossMatterPatternDto;
import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiInsightDto;
import com.bostoneo.bostoneosolutions.dashboard.practiceareas.personalinjury.dto.PiRiskAlertDto;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Personal Injury attorney dashboard endpoints. Replaces the frontend's
 * locally-computed {@code aiInsights}, {@code riskAlerts}, and
 * {@code crossMatterPattern} getters with API-served payloads, so the
 * dashboard doesn't have to duplicate algorithm code or fetch extra case
 * data client-side.
 *
 * <p>Each endpoint enforces a 403 invariant: the caller must be an attorney
 * whose {@code practiceAreas} contains {@link PracticeArea#PERSONAL_INJURY}.
 * Non-attorney users (paralegals without an attorney row, org admins) and
 * attorneys without PI in their assigned areas receive
 * {@link HttpStatus#FORBIDDEN}.</p>
 *
 * <p>The handlers accept {@link Authentication} rather than
 * {@code @AuthenticationPrincipal UserPrincipal} because the codebase uses
 * two principal types in different auth flows — {@code UserPrincipal} on
 * the login path and {@code UserDTO} on the per-request JWT-filter path.
 * Resolving the user id directly from the {@code Authentication.getPrincipal()}
 * keeps this endpoint working under both flows; the underlying attorney
 * lookup is identical to what {@code UserPrincipal} would expose via
 * {@code getAttorney()} when populated.</p>
 */
@RestController
@RequestMapping("/api/v2/dashboard/personal-injury")
@RequiredArgsConstructor
@Slf4j
public class PersonalInjuryDashboardController {

    private final PersonalInjuryDashboardService service;
    private final AttorneyRepository attorneyRepository;

    @GetMapping("/insights")
    public List<PiInsightDto> getInsights(Authentication authentication) {
        Attorney attorney = resolveAttorneyOrDeny(authentication);
        return service.getInsights(attorney.getOrganizationId());
    }

    @GetMapping("/risk-alerts")
    public List<PiRiskAlertDto> getRiskAlerts(Authentication authentication) {
        Attorney attorney = resolveAttorneyOrDeny(authentication);
        return service.getRiskAlerts(attorney.getOrganizationId());
    }

    @GetMapping("/cross-matter")
    public PiCrossMatterPatternDto getCrossMatter(Authentication authentication) {
        Attorney attorney = resolveAttorneyOrDeny(authentication);
        return service.getCrossMatterPattern(attorney.getOrganizationId());
    }

    /**
     * Resolve the attorney row for the caller and enforce PI scope. Throws
     * {@code 403 FORBIDDEN} when the caller has no attorney record or the
     * attorney's assigned practice areas do not include
     * {@link PracticeArea#PERSONAL_INJURY}.
     */
    private Attorney resolveAttorneyOrDeny(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Authentication required");
        }
        Attorney attorney = attorneyRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Attorney record required for Personal Injury dashboard"));
        if (!attorney.getPracticeAreasList().contains(PracticeArea.PERSONAL_INJURY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Attorney lacks access to Personal Injury dashboard");
        }
        return attorney;
    }

    /**
     * Pull the user id off the security principal regardless of which
     * concrete type the auth flow produced. Mirrors the lookup pattern in
     * {@code AIDocumentAnalyzerController.getCurrentUserId()} — see the
     * project-wide note in the controller javadoc above.
     */
    private Long extractUserId(Authentication authentication) {
        if (authentication == null) return null;
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserPrincipal up) {
            return up.getUser() != null ? up.getUser().getId() : null;
        }
        if (principal instanceof UserDTO dto) {
            return dto.getId();
        }
        return null;
    }
}
