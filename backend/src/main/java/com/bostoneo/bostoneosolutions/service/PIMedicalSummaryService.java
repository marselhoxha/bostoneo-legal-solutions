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
     * Delete medical summary for a case
     */
    void deleteMedicalSummary(Long caseId);
}
