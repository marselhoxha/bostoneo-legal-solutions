package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Attorney-facing case workflow stage.
 *
 * Stage is auto-derived by {@code CaseStageService} from data signals:
 * <ul>
 *   <li>{@link #INTAKE}        — case created, no medical records yet</li>
 *   <li>{@link #INVESTIGATION} — at least one medical record uploaded and analyzed</li>
 *   <li>{@link #TREATMENT}     — has medical record with treatmentDate within last 30 days</li>
 *   <li>{@link #PRE_DEMAND}    — has medical records but none in last 30 days (treatment plateaued)</li>
 *   <li>{@link #DEMAND_SENT}   — at least one PISettlementEvent has been logged</li>
 *   <li>{@link #NEGOTIATION}   — settlement event has offerAmount or counterAmount</li>
 *   <li>{@link #SETTLED}       — settlementFinalAmount is set on LegalCase</li>
 * </ul>
 *
 * Auto-derivation runs on write (when records analyzed or settlement events logged).
 * Attorney can override manually; manual overrides are sticky and won't be reverted by AI.
 */
public enum CaseStage {
    INTAKE,
    INVESTIGATION,
    TREATMENT,
    PRE_DEMAND,
    DEMAND_SENT,
    NEGOTIATION,
    SETTLED
}
