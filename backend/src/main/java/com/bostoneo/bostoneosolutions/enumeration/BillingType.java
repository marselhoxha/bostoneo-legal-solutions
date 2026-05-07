package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Billing arrangement for a legal case. Drives whether time-tracking UI
 * is surfaced on tasks linked to the case.
 *
 * <ul>
 *   <li>{@link #CONTINGENCY} — % of recovery; common for PI. Time-log UI hidden.</li>
 *   <li>{@link #HOURLY} — billed by the hour. Time-log UI shown.</li>
 *   <li>{@link #FLAT_FEE} — fixed total fee. Time-log shown for internal cost tracking.</li>
 *   <li>{@link #PRO_BONO} — no fee; time-log shown for value-given reporting.</li>
 * </ul>
 *
 * Spec: docs/superpowers/specs/2026-05-06-tasks-list-view-flow-design.md
 */
public enum BillingType {
    CONTINGENCY,
    HOURLY,
    FLAT_FEE,
    PRO_BONO
}
