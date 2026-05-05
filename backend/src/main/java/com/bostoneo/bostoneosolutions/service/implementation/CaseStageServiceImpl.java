package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.enumeration.CaseStage;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalRecordRepository;
import com.bostoneo.bostoneosolutions.repository.PISettlementEventRepository;
import com.bostoneo.bostoneosolutions.service.CaseStageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Implements the same backfill rules as V61 — kept aligned so a fresh recompute
 * always agrees with what the migration would have produced. If the rules ever
 * diverge between this service and the V61 SQL, this service wins (the SQL only
 * runs once, this runs continuously).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CaseStageServiceImpl implements CaseStageService {

    private static final String PI_PRACTICE_AREA = "Personal Injury";
    private static final int RECENT_TREATMENT_WINDOW_DAYS = 30;

    private final LegalCaseRepository legalCaseRepository;
    private final PIMedicalRecordRepository medicalRecordRepository;
    private final PISettlementEventRepository settlementEventRepository;

    @Override
    @Transactional(readOnly = true)
    public CaseStage deriveStage(Long caseId) {
        LegalCase c = legalCaseRepository.findById(caseId).orElse(null);
        if (c == null || !isPersonalInjury(c)) {
            return null;
        }
        return deriveStage(c);
    }

    @Override
    @Transactional
    public void recomputeAndPersist(Long caseId) {
        LegalCase c = legalCaseRepository.findById(caseId).orElse(null);
        if (c == null || !isPersonalInjury(c)) {
            return;
        }
        if (Boolean.TRUE.equals(c.getStageManuallySet())) {
            log.debug("Skipping stage recompute for case {} — manually overridden", caseId);
            return;
        }

        CaseStage current = c.getStage();
        CaseStage next = deriveStage(c);

        if (next != null && next != current) {
            log.info("Case {} stage transition: {} -> {}", caseId, current, next);
            c.setStage(next);
            legalCaseRepository.save(c);
        }
    }

    /**
     * Order matters: most-advanced state wins. Mirrors the V61 backfill CASE
     * expression top-down so the migration result matches the live recompute.
     */
    private CaseStage deriveStage(LegalCase c) {
        Long caseId = c.getId();
        Long orgId = c.getOrganizationId();

        if (c.getSettlementFinalAmount() != null) {
            return CaseStage.SETTLED;
        }
        if (settlementEventRepository.countCarrierResponses(caseId, orgId) > 0) {
            return CaseStage.NEGOTIATION;
        }
        if (settlementEventRepository.countByCaseIdAndOrganizationId(caseId, orgId) > 0) {
            return CaseStage.DEMAND_SENT;
        }

        // Medical records: most-recent treatment determines TREATMENT vs PRE_DEMAND.
        // findLatestTreatmentDate returns COALESCE(treatmentEndDate, treatmentDate),
        // matching the "is treatment ongoing?" semantic better than treatmentDate alone.
        long recordCount = medicalRecordRepository.countByCaseIdAndOrganizationId(caseId, orgId);
        if (recordCount == 0) {
            return CaseStage.INTAKE;
        }

        LocalDate latestTreatment = medicalRecordRepository.findLatestTreatmentDate(caseId, orgId);
        if (latestTreatment == null) {
            // Records exist but no treatment_date set on any of them — early scan state.
            return CaseStage.INVESTIGATION;
        }

        LocalDate cutoff = LocalDate.now().minusDays(RECENT_TREATMENT_WINDOW_DAYS);
        return latestTreatment.isBefore(cutoff)
                ? CaseStage.PRE_DEMAND
                : CaseStage.TREATMENT;
    }

    private boolean isPersonalInjury(LegalCase c) {
        // practice_area is the display label ("Personal Injury"). Older rows may have
        // type='PERSONAL_INJURY' (enum) without practice_area — accept both for safety.
        return PI_PRACTICE_AREA.equalsIgnoreCase(c.getPracticeArea())
                || "PERSONAL_INJURY".equalsIgnoreCase(c.getType());
    }
}
