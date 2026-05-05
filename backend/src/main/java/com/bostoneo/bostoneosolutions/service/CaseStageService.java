package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.CaseStage;

/**
 * Derives the workflow stage of a Personal Injury case from its data signals
 * (medical records + settlement events + final settlement amount) and persists
 * the change.
 *
 * The same rules also run as the V61 migration backfill, so attorneys see the
 * same value whether the case was created before or after this service shipped.
 *
 * Triggers (callers of {@link #recomputeAndPersist(Long)}):
 *   - PIMedicalRecord create / update / delete / batch scan completion
 *   - PISettlementEvent create / delete
 *   - LegalCase update where settlement_final_amount changes
 *
 * Stickiness: when the legal_cases.stage_manually_set flag is true, the user
 * has explicitly overridden the auto-derivation and recomputeAndPersist becomes
 * a no-op. The flag is cleared by an explicit "Reset to auto" action (UI in P4+).
 */
public interface CaseStageService {

    /**
     * Pure-derivation: queries DB and returns what stage SHOULD be based on
     * current data signals. Does not persist. Returns INTAKE for a brand-new
     * PI case with no data; ignored entirely for non-PI cases (returns null).
     */
    CaseStage deriveStage(Long caseId);

    /**
     * Recompute the stage for this case and persist if (a) the case is PI,
     * (b) stage_manually_set is not true, and (c) the computed stage differs
     * from the stored stage. Logs every transition for audit visibility.
     *
     * Safe to call from any trigger point — internally short-circuits on
     * non-PI cases and on manually-set cases. Idempotent.
     */
    void recomputeAndPersist(Long caseId);
}
