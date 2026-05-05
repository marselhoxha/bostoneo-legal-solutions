package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PIMedicalSummaryDTO;

import java.util.List;
import java.util.Map;

/**
 * Service interface for PI Medical Summary operations
 */
public interface PIMedicalSummaryService {

    /**
     * Get the medical summary for a case
     */
    PIMedicalSummaryDTO getMedicalSummary(Long caseId);

    /**
     * Generate a new medical summary using AI
     */
    PIMedicalSummaryDTO generateMedicalSummary(Long caseId);

    /**
     * Check if summary exists and is current (not stale)
     */
    boolean isSummaryCurrent(Long caseId);

    /**
     * Get treatment chronology
     */
    String getTreatmentChronology(Long caseId);

    /**
     * Get provider summary
     */
    List<Map<String, Object>> getProviderSummary(Long caseId);

    /**
     * Get diagnosis list with ICD codes
     */
    List<Map<String, Object>> getDiagnosisList(Long caseId);

    /**
     * Get red flags identified in medical records
     */
    List<Map<String, Object>> getRedFlags(Long caseId);

    /**
     * Get missing records alert
     */
    List<Map<String, Object>> getMissingRecords(Long caseId);

    /**
     * Get prognosis assessment
     */
    String getPrognosisAssessment(Long caseId);

    /**
     * Get completeness metrics
     */
    Map<String, Object> getCompletenessMetrics(Long caseId);

    /**
     * Analyze treatment gaps
     */
    List<Map<String, Object>> analyzeTreatmentGaps(Long caseId);

    /**
     * Generate an AI-powered adjuster defense analysis that predicts how an insurance
     * adjuster will attack the case and provides specific counter-arguments.
     */
    Map<String, Object> generateAdjusterDefenseAnalysis(Long caseId);

    /**
     * Retrieve saved adjuster defense analysis from database
     */
    Map<String, Object> getSavedAdjusterAnalysis(Long caseId);

    /**
     * P5.4 — Persist the attorney's demand calculator scenario.
     * Replaces the entire scenario blob each call (PUT semantics).
     * Returns the updated DTO so the caller can use the saved-at timestamp.
     */
    PIMedicalSummaryDTO updateDemandScenario(Long caseId, Map<String, Object> scenario);

    /**
     * Delete medical summary for a case
     */
    void deleteMedicalSummary(Long caseId);

    /**
     * P11.a — Detect cross-document anomalies for a case. Pure rules-based
     * pass over medical records + scanned documents + the linked case's
     * intake fields. Returns a list of anomaly maps:
     * { id, type, severity (HIGH|MEDIUM|LOW), title, message, source, recommendation }.
     */
    java.util.List<java.util.Map<String, Object>> detectDocumentAnomalies(Long caseId);

    /**
     * P11.d — AI-generated 3-tier risk register: pre-suit settlement
     * likelihood, suit (post-filing) risk, trial verdict risk. Persisted
     * to pi_medical_summaries.risk_register so it survives page navigation.
     */
    java.util.Map<String, Object> generateRiskRegister(Long caseId);

    /**
     * P11.d — Retrieve persisted risk register for a case (no AI call).
     */
    java.util.Map<String, Object> getSavedRiskRegister(Long caseId);
}
