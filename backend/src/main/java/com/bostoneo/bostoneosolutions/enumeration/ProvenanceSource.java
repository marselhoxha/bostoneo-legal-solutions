package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Source of a case-field value, used by the provenance markers shown next
 * to facts on the PI case detail UI. Stored on
 * {@code legal_cases.field_provenance} as a JSONB map keyed by field path
 * (e.g. {@code "parties.plaintiff_dob" -> INTAKE_FORM}).
 *
 * <p>Distinct from {@code DataSource} (which has unrelated semantics for
 * AI/document ingestion). This four-source taxonomy matches the design spec
 * §7.6 and the marker glyph mapping (i / c / A / m).
 *
 * <ul>
 *   <li>{@link #INTAKE_FORM}   — captured during the firm's intake form / questionnaire</li>
 *   <li>{@link #CLIENT_PORTAL} — supplied by the client through their self-service portal</li>
 *   <li>{@link #AI_EXTRACTED}  — derived by AI from medical records / scanned documents</li>
 *   <li>{@link #MANUAL}        — entered by attorney/paralegal staff after the fact</li>
 * </ul>
 */
public enum ProvenanceSource {
    INTAKE_FORM,
    CLIENT_PORTAL,
    AI_EXTRACTED,
    MANUAL
}
