package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Service interface for PI Medical Record operations
 */
public interface PIMedicalRecordService {

    /**
     * Get all medical records for a case
     */
    List<PIMedicalRecordDTO> getRecordsByCaseId(Long caseId);

    /**
     * Get paginated medical records for a case
     */
    Page<PIMedicalRecordDTO> getRecordsByCaseId(Long caseId, Pageable pageable);

    /**
     * Get a specific medical record by ID
     */
    PIMedicalRecordDTO getRecordById(Long id);

    /**
     * Create a new medical record
     */
    PIMedicalRecordDTO createRecord(Long caseId, PIMedicalRecordDTO recordDTO);

    /**
     * Update an existing medical record
     */
    PIMedicalRecordDTO updateRecord(Long id, PIMedicalRecordDTO recordDTO);

    /**
     * Delete a medical record
     */
    void deleteRecord(Long id);

    /**
     * Get records by provider name
     */
    List<PIMedicalRecordDTO> getRecordsByProvider(Long caseId, String providerName);

    /**
     * Get records by record type
     */
    List<PIMedicalRecordDTO> getRecordsByType(Long caseId, String recordType);

    /**
     * Get records within a date range
     */
    List<PIMedicalRecordDTO> getRecordsByDateRange(Long caseId, LocalDate startDate, LocalDate endDate);

    /**
     * Get distinct provider names for a case
     */
    List<String> getProviderNames(Long caseId);

    /**
     * Get total billed amount for a case
     */
    BigDecimal getTotalBilledAmount(Long caseId);

    /**
     * Get provider summary for a case
     */
    List<Map<String, Object>> getProviderSummary(Long caseId);

    /**
     * Get treatment date range for a case
     */
    Map<String, LocalDate> getTreatmentDateRange(Long caseId);

    /**
     * Extract diagnoses from medical record text using AI
     */
    List<Map<String, Object>> extractDiagnosesFromText(String medicalText);

    /**
     * Analyze medical record and extract key findings using AI
     */
    Map<String, Object> analyzeRecordWithAI(Long recordId);

    /**
     * Scan all documents attached to a case and auto-populate medical records.
     * Uses AI to analyze PDFs and extract medical record data.
     *
     * @param caseId The case ID to scan documents for
     * @return Map containing scan results (recordsCreated, documentsScanned, errors)
     */
    Map<String, Object> scanCaseDocuments(Long caseId);

    /**
     * Analyze a specific file and extract medical record data using AI
     *
     * @param caseId The case ID
     * @param fileId The file ID to analyze
     * @return The created medical record DTO, or null if not a medical document
     */
    PIMedicalRecordDTO analyzeFileAndCreateRecord(Long caseId, Long fileId);
}
