package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.PIMedicalRecord;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.model.PIScannedDocument;
import com.bostoneo.bostoneosolutions.repository.PIScannedDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalRecordRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalSummaryRepository;
import com.bostoneo.bostoneosolutions.service.CaseDocumentService;
import com.bostoneo.bostoneosolutions.service.PIMedicalRecordService;
import com.bostoneo.bostoneosolutions.service.PIDocumentChecklistService;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Implementation of PI Medical Record Service
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PIMedicalRecordServiceImpl implements PIMedicalRecordService {

    private final PIMedicalRecordRepository repository;
    private final PIMedicalSummaryRepository summaryRepository;
    private final PIScannedDocumentRepository scannedDocumentRepository;
    private final FileItemRepository fileItemRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final PIDocumentChecklistService documentChecklistService;
    private final TenantService tenantService;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;
    private final FileStorageService fileStorageService;
    private final CaseDocumentService caseDocumentService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PIMedicalRecordDTO> getRecordsByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting medical records for case: {} in org: {}", caseId, orgId);

        return repository.findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Page<PIMedicalRecordDTO> getRecordsByCaseId(Long caseId, Pageable pageable) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdOrderByTreatmentDateDesc(caseId, orgId, pageable)
                .map(this::mapToDTO);
    }

    @Override
    public PIMedicalRecordDTO getRecordById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PIMedicalRecord record = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + id));
        return mapToDTO(record);
    }

    @Override
    public PIMedicalRecordDTO createRecord(Long caseId, PIMedicalRecordDTO recordDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating medical record for case: {} in org: {}", caseId, orgId);

        PIMedicalRecord record = mapToEntity(recordDTO);
        record.setCaseId(caseId);
        record.setOrganizationId(orgId);
        record.setIsComplete(determineCompleteness(record));

        PIMedicalRecord saved = repository.save(record);

        // Mark any existing summary as stale
        summaryRepository.markAsStale(caseId, orgId);

        log.info("Medical record created with ID: {}", saved.getId());
        return mapToDTO(saved);
    }

    @Override
    public PIMedicalRecordDTO updateRecord(Long id, PIMedicalRecordDTO recordDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating medical record: {} in org: {}", id, orgId);

        PIMedicalRecord existing = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + id));

        updateEntityFromDTO(existing, recordDTO);
        existing.setIsComplete(determineCompleteness(existing));

        PIMedicalRecord saved = repository.save(existing);

        // Mark summary as stale
        summaryRepository.markAsStale(existing.getCaseId(), orgId);

        return mapToDTO(saved);
    }

    @Override
    public void deleteRecord(Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting medical record: {} in org: {}", id, orgId);

        PIMedicalRecord record = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + id));

        Long caseId = record.getCaseId();

        // Clear tracking records BEFORE deleting the medical record to avoid orphans.
        // This ensures source files will be re-processed on the next scan.
        scannedDocumentRepository.deleteByMedicalRecordId(id);
        repository.delete(record);

        // Mark summary as stale
        summaryRepository.markAsStale(caseId, orgId);

        log.info("Medical record deleted successfully");
    }

    @Override
    public int deleteAllRecordsByCase(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting all medical records for case: {} in org: {}", caseId, orgId);
        repository.deleteByCaseIdAndOrganizationId(caseId, orgId);
        summaryRepository.deleteByCaseIdAndOrganizationId(caseId, orgId);
        // Clear tracking table so all files are re-processed on next scan
        scannedDocumentRepository.deleteByCaseIdAndOrganizationId(caseId, orgId);
        // Zero out the case-level medical total so the dashboard reflects the cleared state immediately
        legalCaseRepository.resetMedicalExpensesTotal(caseId, orgId);
        log.info("All medical records, summary, scan tracking, and medical total cleared for case {}", caseId);
        // Return count is best-effort; JPA deleteBy returns void so we return 0 to signal success
        return 0;
    }

    @Override
    public List<PIMedicalRecordDTO> getRecordsByProvider(Long caseId, String providerName) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdAndProviderNameContainingIgnoreCase(caseId, orgId, providerName)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIMedicalRecordDTO> getRecordsByType(Long caseId, String recordType) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdAndRecordType(caseId, orgId, recordType)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIMedicalRecordDTO> getRecordsByDateRange(Long caseId, LocalDate startDate, LocalDate endDate) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdAndTreatmentDateBetweenOrderByTreatmentDateAsc(
                        caseId, orgId, startDate, endDate)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<String> getProviderNames(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.findDistinctProviderNames(caseId, orgId);
    }

    @Override
    public BigDecimal getTotalBilledAmount(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.sumBilledAmountByCaseId(caseId, orgId);
    }

    @Override
    public List<Map<String, Object>> getProviderSummary(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        List<Object[]> results = repository.getProviderSummary(caseId, orgId);

        return results.stream().map(row -> {
            Map<String, Object> summary = new HashMap<>();
            summary.put("providerName", row[0]);
            summary.put("providerType", row[1]);
            summary.put("visitCount", row[2]);
            summary.put("totalBilled", row[3]);
            summary.put("firstVisit", row[4]);
            summary.put("lastVisit", row[5]);
            return summary;
        }).collect(Collectors.toList());
    }

    @Override
    public Map<String, LocalDate> getTreatmentDateRange(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        Map<String, LocalDate> range = new HashMap<>();
        range.put("firstDate", repository.findEarliestTreatmentDate(caseId, orgId));
        range.put("lastDate", repository.findLatestTreatmentDate(caseId, orgId));
        return range;
    }

    @Override
    public List<Map<String, Object>> extractDiagnosesFromText(String medicalText) {
        log.info("Extracting diagnoses from medical text using AI");

        String prompt = """
            Extract all diagnoses from the following medical record text.
            For each diagnosis, provide:
            1. ICD-10 code (if identifiable)
            2. Description
            3. Whether it appears to be the primary diagnosis

            Return as JSON array with format:
            [{"icd_code": "M54.5", "description": "Low back pain", "primary": true}, ...]

            Medical Text:
            """ + medicalText;

        try {
            String response = claudeService.generateCompletion(prompt, false).get();
            // Parse JSON response
            // This is simplified - in production, use proper JSON parsing
            return parseJsonArrayFromResponse(response);
        } catch (Exception e) {
            log.error("Error extracting diagnoses with AI: ", e);
            return Collections.emptyList();
        }
    }

    @Override
    public Map<String, Object> analyzeRecordWithAI(Long recordId) {
        Long orgId = getRequiredOrganizationId();
        PIMedicalRecord record = repository.findByIdAndOrganizationId(recordId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + recordId));

        log.info("Analyzing medical record {} with AI", recordId);

        StringBuilder recordContent = new StringBuilder();
        recordContent.append("Provider: ").append(record.getProviderName()).append("\n");
        recordContent.append("Type: ").append(record.getRecordType()).append("\n");
        recordContent.append("Date: ").append(record.getTreatmentDate()).append("\n");
        if (record.getKeyFindings() != null) {
            recordContent.append("Findings: ").append(record.getKeyFindings()).append("\n");
        }
        if (record.getTreatmentProvided() != null) {
            recordContent.append("Treatment: ").append(record.getTreatmentProvided()).append("\n");
        }

        String prompt = """
            Analyze this medical record and extract:
            1. Key clinical findings
            2. Treatment recommendations
            3. Work restrictions mentioned
            4. Prognosis indicators
            5. Any red flags or concerns

            Medical Record:
            """ + recordContent;

        Map<String, Object> analysis = new HashMap<>();
        try {
            String response = claudeService.generateCompletion(prompt, false).get();
            analysis.put("success", true);
            analysis.put("analysis", response);
            analysis.put("recordId", recordId);
        } catch (Exception e) {
            log.error("Error analyzing record with AI: ", e);
            analysis.put("success", false);
            analysis.put("error", e.getMessage());
        }

        return analysis;
    }

    // Helper methods

    private boolean determineCompleteness(PIMedicalRecord record) {
        List<String> missing = new ArrayList<>();

        if (record.getDiagnoses() == null || record.getDiagnoses().isEmpty()) {
            missing.add("diagnoses");
        }
        if (record.getBilledAmount() == null || record.getBilledAmount().compareTo(BigDecimal.ZERO) == 0) {
            missing.add("billedAmount");
        }
        if (record.getKeyFindings() == null || record.getKeyFindings().isEmpty()) {
            missing.add("keyFindings");
        }

        record.setMissingElements(missing);
        return missing.isEmpty();
    }

    private List<Map<String, Object>> parseJsonArrayFromResponse(String response) {
        // Simplified parsing - in production use Jackson ObjectMapper
        List<Map<String, Object>> result = new ArrayList<>();
        // Extract JSON array from response and parse
        // This is a placeholder implementation
        return result;
    }

    private PIMedicalRecordDTO mapToDTO(PIMedicalRecord entity) {
        return PIMedicalRecordDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .providerName(entity.getProviderName())
                .providerNpi(entity.getProviderNpi())
                .providerType(entity.getProviderType())
                .providerAddress(entity.getProviderAddress())
                .providerPhone(entity.getProviderPhone())
                .providerFax(entity.getProviderFax())
                .treatingClinician(entity.getTreatingClinician())
                .treatingRole(entity.getTreatingRole())
                .recordType(entity.getRecordType())
                .treatmentDate(entity.getTreatmentDate())
                .treatmentEndDate(entity.getTreatmentEndDate())
                .diagnoses(entity.getDiagnoses())
                .procedures(entity.getProcedures())
                .vitals(entity.getVitals())
                .rangeOfMotion(entity.getRangeOfMotion())
                .specialTests(entity.getSpecialTests())
                .medicationsAdministered(entity.getMedicationsAdministered())
                .medicationsPrescribed(entity.getMedicationsPrescribed())
                .billedAmount(entity.getBilledAmount())
                .adjustedAmount(entity.getAdjustedAmount())
                .paidAmount(entity.getPaidAmount())
                .lienHolder(entity.getLienHolder())
                .lienAmount(entity.getLienAmount())
                .keyFindings(entity.getKeyFindings())
                .treatmentProvided(entity.getTreatmentProvided())
                .prognosisNotes(entity.getPrognosisNotes())
                .workRestrictions(entity.getWorkRestrictions())
                .followUpRecommendations(entity.getFollowUpRecommendations())
                .causationStatement(entity.getCausationStatement())
                .causationSource(entity.getCausationSource())
                .isComplete(entity.getIsComplete())
                .missingElements(entity.getMissingElements())
                .documentId(entity.getDocumentId())
                .citationMetadata(entity.getCitationMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }

    private PIMedicalRecord mapToEntity(PIMedicalRecordDTO dto) {
        return PIMedicalRecord.builder()
                .providerName(dto.getProviderName())
                .providerNpi(dto.getProviderNpi())
                .providerType(dto.getProviderType())
                .providerAddress(dto.getProviderAddress())
                .providerPhone(dto.getProviderPhone())
                .providerFax(dto.getProviderFax())
                .recordType(dto.getRecordType())
                .treatmentDate(dto.getTreatmentDate())
                .treatmentEndDate(dto.getTreatmentEndDate())
                .diagnoses(dto.getDiagnoses())
                .procedures(dto.getProcedures())
                .billedAmount(dto.getBilledAmount())
                .adjustedAmount(dto.getAdjustedAmount())
                .paidAmount(dto.getPaidAmount())
                .lienHolder(dto.getLienHolder())
                .lienAmount(dto.getLienAmount())
                .keyFindings(dto.getKeyFindings())
                .treatmentProvided(dto.getTreatmentProvided())
                .prognosisNotes(dto.getPrognosisNotes())
                .workRestrictions(dto.getWorkRestrictions())
                .followUpRecommendations(dto.getFollowUpRecommendations())
                .documentId(dto.getDocumentId())
                .createdBy(dto.getCreatedBy())
                .build();
    }

    private void updateEntityFromDTO(PIMedicalRecord entity, PIMedicalRecordDTO dto) {
        if (dto.getProviderName() != null) entity.setProviderName(dto.getProviderName());
        if (dto.getProviderNpi() != null) entity.setProviderNpi(dto.getProviderNpi());
        if (dto.getProviderType() != null) entity.setProviderType(dto.getProviderType());
        if (dto.getProviderAddress() != null) entity.setProviderAddress(dto.getProviderAddress());
        if (dto.getProviderPhone() != null) entity.setProviderPhone(dto.getProviderPhone());
        if (dto.getProviderFax() != null) entity.setProviderFax(dto.getProviderFax());
        if (dto.getRecordType() != null) entity.setRecordType(dto.getRecordType());
        if (dto.getTreatmentDate() != null) entity.setTreatmentDate(dto.getTreatmentDate());
        if (dto.getTreatmentEndDate() != null) entity.setTreatmentEndDate(dto.getTreatmentEndDate());
        if (dto.getDiagnoses() != null) entity.setDiagnoses(dto.getDiagnoses());
        if (dto.getProcedures() != null) entity.setProcedures(dto.getProcedures());
        if (dto.getBilledAmount() != null) entity.setBilledAmount(dto.getBilledAmount());
        if (dto.getAdjustedAmount() != null) entity.setAdjustedAmount(dto.getAdjustedAmount());
        if (dto.getPaidAmount() != null) entity.setPaidAmount(dto.getPaidAmount());
        if (dto.getLienHolder() != null) entity.setLienHolder(dto.getLienHolder());
        if (dto.getLienAmount() != null) entity.setLienAmount(dto.getLienAmount());
        if (dto.getKeyFindings() != null) entity.setKeyFindings(dto.getKeyFindings());
        if (dto.getTreatmentProvided() != null) entity.setTreatmentProvided(dto.getTreatmentProvided());
        if (dto.getPrognosisNotes() != null) entity.setPrognosisNotes(dto.getPrognosisNotes());
        if (dto.getWorkRestrictions() != null) entity.setWorkRestrictions(dto.getWorkRestrictions());
        if (dto.getFollowUpRecommendations() != null) entity.setFollowUpRecommendations(dto.getFollowUpRecommendations());
        if (dto.getDocumentId() != null) entity.setDocumentId(dto.getDocumentId());
    }

    // ==========================================
    // Document Scanning & Auto-Population Methods
    // ==========================================

    private boolean isScannable(FileItem f) {
        return f.getMimeType() != null;
    }

    public Map<String, Object> getScanStatus(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);
        long totalScannable = files.stream().filter(this::isScannable).count();
        long scanned = files.stream()
                .filter(this::isScannable)
                .filter(f -> scannedDocumentRepository.existsByDocumentIdAndOrganizationId(f.getId(), orgId))
                .count();
        long unscanned = totalScannable - scanned;

        Map<String, Object> status = new HashMap<>();
        status.put("totalCaseDocuments", totalScannable);
        status.put("scannedDocuments", scanned);
        status.put("unscannedDocuments", unscanned);
        status.put("hasUnscannedDocuments", unscanned > 0);
        return status;
    }

    @Override
    public Map<String, Object> scanCaseDocuments(Long caseId) {
        return scanCaseDocuments(caseId, null, false);
    }

    @Override
    public Map<String, Object> scanCaseDocuments(Long caseId, Consumer<Map<String, Object>> onProgress) {
        return scanCaseDocuments(caseId, onProgress, false);
    }

    @Override
    public Map<String, Object> scanCaseDocuments(Long caseId, Consumer<Map<String, Object>> onProgress, boolean force) {
        Long orgId = getRequiredOrganizationId();
        log.info("Scanning documents for case: {} in org: {} (force={})", caseId, orgId, force);

        // Force-rescan: wipe existing records/summary/tracking before scanning so every
        // file is re-analyzed by the current AI prompt. Reuses deleteAllRecordsByCase
        // which also resets the case-level medical-expenses total on LegalCase.
        if (force) {
            log.info("Force flag set — clearing existing medical records, summary, and scan tracking for case {}", caseId);
            deleteAllRecordsByCase(caseId);
        }

        Map<String, Object> result = new HashMap<>();
        List<PIMedicalRecordDTO> createdRecords = new ArrayList<>();
        Set<Long> countedRecordIds = new HashSet<>();
        List<Map<String, Object>> scannedFiles = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        // Get all scannable files (PDFs + images) for this case
        List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);
        List<FileItem> pdfFiles = files.stream()
                .filter(this::isScannable)
                .collect(Collectors.toList());

        int totalFiles = pdfFiles.size();
        log.info("Found {} scannable files (PDFs + images) to scan for case {}", totalFiles, caseId);

        // If the case has zero medical records, the scan-tracking table is stale (or the prior
        // scan legitimately found nothing). Either way, user clicking Scan with an empty record
        // list wants a fresh attempt — bypass the "already processed" fast path and reset tracking
        // so every document is re-analyzed.
        long existingRecordCount = repository.countByCaseIdAndOrganizationId(caseId, orgId);
        boolean forceRescan = existingRecordCount == 0;
        if (forceRescan) {
            scannedDocumentRepository.deleteByCaseIdAndOrganizationId(caseId, orgId);
            log.info("Case {} has 0 medical records — cleared scan tracking and forcing full re-scan", caseId);
        }

        // Send initial progress (0/total)
        sendProgress(onProgress, caseId, 0, totalFiles, "Starting scan...");

        // Process files sequentially with progress updates after each file.
        // Sequential avoids race conditions in the merge-dedup logic (same provider+date+type).
        // The Sonnet model switch (vs Opus) provides the major speedup (~3-5x faster AI calls).
        for (int i = 0; i < pdfFiles.size(); i++) {
            FileItem file = pdfFiles.get(i);
            try {
                Map<String, Object> fileResult = new HashMap<>();
                fileResult.put("fileId", file.getId());
                fileResult.put("fileName", file.getOriginalName());

                // Check if this document was already processed (using tracking table, not medical records).
                // Skipped entirely on forceRescan — tracking was just cleared above.
                boolean alreadyProcessed = !forceRescan
                        && scannedDocumentRepository.existsByDocumentIdAndOrganizationId(file.getId(), orgId);
                if (alreadyProcessed) {
                    fileResult.put("status", "skipped");
                    fileResult.put("reason", "Already processed");
                    scannedFiles.add(fileResult);
                    sendProgress(onProgress, caseId, i + 1, totalFiles, file.getOriginalName());
                    continue;
                }

                // Analyze the file and create record. Tracking (created/merged status + raw AI
                // extraction caching) happens INSIDE analyzeFileAndCreateRecord — the scan loop
                // only handles the non-medical/insurance/failed branches below.
                PIMedicalRecordDTO record = analyzeFileAndCreateRecord(caseId, file.getId());
                if (record != null && countedRecordIds.add(record.getId())) {
                    createdRecords.add(record);
                    fileResult.put("status", "success");
                    fileResult.put("recordId", record.getId());
                    fileResult.put("provider", record.getProviderName());
                    fileResult.put("recordType", record.getRecordType());
                } else if (record != null) {
                    // Merged into an existing record — mark as success but don't double-count
                    fileResult.put("status", "merged");
                    fileResult.put("recordId", record.getId());
                    fileResult.put("provider", record.getProviderName());
                    fileResult.put("recordType", record.getRecordType());
                } else {
                    // Not a medical document — check if it's an insurance document
                    boolean extractedInsurance = tryExtractInsuranceInfo(caseId, orgId, file);
                    if (extractedInsurance) {
                        fileResult.put("status", "insurance_extracted");
                        fileResult.put("reason", "Insurance policy information extracted");
                        trackScannedDocument(caseId, orgId, file.getId(), "insurance", null, null);
                    } else {
                        fileResult.put("status", "skipped");
                        fileResult.put("reason", "Not identified as medical or insurance document");
                        trackScannedDocument(caseId, orgId, file.getId(), "non_medical", null, null);
                    }
                }
                scannedFiles.add(fileResult);

            } catch (Exception e) {
                log.error("Error processing file {}: {}", file.getId(), e.getMessage());
                errors.add(String.format("File %s: %s", file.getOriginalName(), e.getMessage()));

                Map<String, Object> fileResult = new HashMap<>();
                fileResult.put("fileId", file.getId());
                fileResult.put("fileName", file.getOriginalName());
                fileResult.put("status", "error");
                fileResult.put("error", e.getMessage());
                scannedFiles.add(fileResult);
                // Track: file processing failed
                trackScannedDocument(caseId, orgId, file.getId(), "failed", null, e.getMessage());
            }

            // Send progress after each file
            sendProgress(onProgress, caseId, i + 1, totalFiles, file.getOriginalName());
        }

        // Mark summary as stale if records were created
        if (!createdRecords.isEmpty()) {
            summaryRepository.markAsStale(caseId, orgId);
        }

        // Sync document checklist with case files
        try {
            Map<String, Object> checklistSync = documentChecklistService.syncWithCaseDocuments(caseId);
            result.put("checklistSync", checklistSync);
        } catch (Exception e) {
            log.warn("Failed to sync document checklist: {}", e.getMessage());
            result.put("checklistSyncError", e.getMessage());
        }

        result.put("success", true);
        result.put("documentsScanned", totalFiles);
        result.put("recordsCreated", createdRecords.size());
        result.put("records", createdRecords);
        result.put("files", scannedFiles);
        result.put("errors", errors);

        log.info("Document scan complete for case {}: {} records created from {} documents",
                caseId, createdRecords.size(), totalFiles);

        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> reprocessCaseDocuments(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Reprocessing case {} from cached extractions (no AI calls) in org {}", caseId, orgId);

        // Pull cached extractions in original scan order. The order matters: mergeAnalysisIntoRecord
        // can produce different end-states depending on which doc lands first (e.g., a clinical doc
        // arriving before its bill upgrades the recordType differently than the reverse).
        List<PIScannedDocument> cached = scannedDocumentRepository.findCachedExtractionsByCase(caseId, orgId);
        Map<String, Object> result = new HashMap<>();

        if (cached.isEmpty()) {
            log.warn("Reprocess called for case {} but no cached extractions found — has the case been scanned with V55+?", caseId);
            result.put("success", false);
            result.put("message", "No cached AI extractions found for this case. Run a fresh scan first to populate the cache.");
            result.put("replayedDocuments", 0);
            result.put("recordsCreated", 0);
            return result;
        }

        // Wipe existing records + summary so we replay onto a clean slate.
        // We deliberately KEEP the pi_scanned_documents rows (cache survives) — only clear the
        // medical-records side. Without this, mergeAnalysisIntoRecord would compose with whatever
        // stale state the previous reprocess/scan left behind.
        log.info("Reprocess: clearing {} existing medical records for case {} before replay",
                repository.countByCaseIdAndOrganizationId(caseId, orgId), caseId);
        repository.deleteByCaseIdAndOrganizationId(caseId, orgId);
        summaryRepository.deleteByCaseIdAndOrganizationId(caseId, orgId);
        // Reset case-level medical-expenses total so the dashboard reflects the cleared state.
        legalCaseRepository.resetMedicalExpensesTotal(caseId, orgId);

        List<PIMedicalRecordDTO> replayedRecords = new ArrayList<>();
        Set<Long> countedRecordIds = new HashSet<>();
        List<String> errors = new ArrayList<>();

        for (PIScannedDocument scan : cached) {
            try {
                Map<String, Object> analysis = scan.getRawExtraction();
                if (analysis == null) continue;  // defensive — query already filters but belt-and-suspenders

                // Replay the full creation/merge flow against the cached analysis.
                // We bypass extractTextFromFile + analyzeDocumentWithAI entirely — those are the
                // expensive steps. The cheap deterministic part (provider normalization, date
                // validation, find-or-merge, persist) runs fresh against the current Java code.
                PIMedicalRecordDTO record = replayAnalysisAsRecord(caseId, orgId, scan.getDocumentId(), analysis);
                if (record == null) continue;

                if (countedRecordIds.add(record.getId())) {
                    replayedRecords.add(record);
                }
            } catch (Exception e) {
                log.error("Failed to replay scan {} for case {}: {}", scan.getId(), caseId, e.getMessage(), e);
                errors.add(String.format("scanId=%d documentId=%d: %s", scan.getId(), scan.getDocumentId(), e.getMessage()));
            }
        }

        // Mark summary stale so next /medical-summary call regenerates it from the new records
        summaryRepository.markAsStale(caseId, orgId);

        result.put("success", true);
        result.put("replayedDocuments", cached.size());
        result.put("recordsCreated", replayedRecords.size());
        result.put("records", replayedRecords);
        result.put("errors", errors);
        result.put("usedCache", true);
        result.put("aiCallsAvoided", cached.size());

        log.info("Reprocess complete for case {}: {} records from {} cached extractions ({} errors). " +
                "AI calls avoided: {}", caseId, replayedRecords.size(), cached.size(), errors.size(), cached.size());
        return result;
    }

    /**
     * Replay a single cached AI extraction through the create/merge pipeline. Mirrors the body
     * of analyzeFileAndCreateRecord but skips text extraction + AI call — the analysis Map is
     * already in hand. Does NOT update the cache (the cache is the source).
     */
    private PIMedicalRecordDTO replayAnalysisAsRecord(Long caseId, Long orgId, Long fileId,
                                                       Map<String, Object> analysisResult) {
        if (analysisResult == null || !Boolean.TRUE.equals(analysisResult.get("isMedicalDocument"))) {
            return null;
        }

        // Same provider normalization that the live scan path uses
        String rawProviderName = (String) analysisResult.getOrDefault("providerName", "Unknown Provider");
        String normalizedProvider = normalizeProviderName(rawProviderName);
        analysisResult.put("providerName", normalizedProvider);

        // Same date parsing + future-date guard as the live scan path
        String dateStr = (String) analysisResult.get("treatmentDate");
        LocalDate treatmentDate = null;
        if (dateStr != null && !dateStr.isEmpty()) {
            try {
                treatmentDate = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ignore) {}
        }
        if (treatmentDate != null && treatmentDate.isAfter(LocalDate.now())) {
            treatmentDate = null;
        }

        String newDocType = (String) analysisResult.getOrDefault("documentType", "OTHER");
        String mappedRecordType = mapDocumentTypeToRecordType(newDocType);
        boolean isBillingDoc = "BILLING".equals(mappedRecordType);
        boolean isInsuranceLedger = "INSURANCE_LEDGER".equals(mappedRecordType);

        if (treatmentDate != null && !isInsuranceLedger) {
            Optional<PIMedicalRecord> existingOpt;
            if (isBillingDoc) {
                existingOpt = repository.findByCaseAndProviderAndDate(caseId, orgId, normalizedProvider, treatmentDate);
            } else {
                existingOpt = repository.findByCaseAndProviderAndDateAndRecordType(
                        caseId, orgId, normalizedProvider, treatmentDate, mappedRecordType);
                if (existingOpt.isEmpty()) {
                    Optional<PIMedicalRecord> billingOnly = repository.findByCaseAndProviderAndDate(
                            caseId, orgId, normalizedProvider, treatmentDate);
                    if (billingOnly.isPresent() && "BILLING".equals(billingOnly.get().getRecordType())) {
                        existingOpt = billingOnly;
                    }
                }
            }
            if (existingOpt.isPresent()) {
                PIMedicalRecord existing = existingOpt.get();
                mergeAnalysisIntoRecord(existing, fileId, analysisResult);
                if (!isBillingDoc && "BILLING".equals(existing.getRecordType())) {
                    existing.setRecordType(mappedRecordType);
                }
                PIMedicalRecord saved = repository.save(existing);
                return mapToDTO(saved);
            }
        }

        PIMedicalRecord record = createRecordFromAnalysis(caseId, orgId, fileId, analysisResult);
        PIMedicalRecord saved = repository.save(record);
        return mapToDTO(saved);
    }

    private void sendProgress(Consumer<Map<String, Object>> onProgress, Long caseId,
                               int current, int total, String currentFile) {
        if (onProgress == null) return;
        try {
            Map<String, Object> progress = new HashMap<>();
            progress.put("type", "MEDICAL_SCAN_PROGRESS");
            progress.put("caseId", caseId);
            progress.put("current", current);
            progress.put("total", total);
            progress.put("currentFile", currentFile);
            progress.put("percentComplete", total > 0 ? (int) Math.round((current * 100.0) / total) : 0);
            onProgress.accept(progress);
        } catch (Exception e) {
            log.warn("Failed to send scan progress: {}", e.getMessage());
        }
    }

    /**
     * Track the processing outcome of a file in the pi_scanned_documents table.
     * Prevents re-processing on subsequent scans. Uses upsert semantics via unique constraint.
     * Backward-compat overload — calls the variant that accepts rawExtraction with null.
     */
    private void trackScannedDocument(Long caseId, Long orgId, Long documentId,
                                       String status, Long medicalRecordId, String errorMessage) {
        trackScannedDocument(caseId, orgId, documentId, status, medicalRecordId, errorMessage, null);
    }

    /**
     * Track the processing outcome of a file, including the raw AI response for caching.
     * The cached rawExtraction lets the /reprocess endpoint (dev/staging only) re-run
     * persistence/merge logic without re-calling Bedrock. NULL is fine for outcomes that
     * didn't produce AI output (non_medical via insurance fallback, no_text, failed).
     */
    private void trackScannedDocument(Long caseId, Long orgId, Long documentId,
                                       String status, Long medicalRecordId, String errorMessage,
                                       Map<String, Object> rawExtraction) {
        try {
            PIScannedDocument tracked = PIScannedDocument.builder()
                    .caseId(caseId)
                    .organizationId(orgId)
                    .documentId(documentId)
                    .status(status)
                    .medicalRecordId(medicalRecordId)
                    .errorMessage(errorMessage)
                    .rawExtraction(rawExtraction)
                    .build();
            scannedDocumentRepository.save(tracked);
        } catch (Exception e) {
            // Log but don't fail the scan — tracking is best-effort, not blocking
            log.warn("Failed to track scanned document {} (status={}): {}", documentId, status, e.getMessage());
        }
    }

    @Override
    public PIMedicalRecordDTO analyzeFileAndCreateRecord(Long caseId, Long fileId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Analyzing file {} for case {} in org {}", fileId, caseId, orgId);

        // Get the file
        FileItem file = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found with ID: " + fileId));

        // Guard: if a record already exists for this document, return it without re-processing.
        // Prevents billing amounts from doubling if the same file is analyzed more than once.
        Optional<PIMedicalRecord> existingByDoc = repository.findByDocumentIdAndOrganizationId(fileId, orgId);
        if (existingByDoc.isPresent()) {
            log.info("Record already exists for document {}, returning existing record {}", fileId, existingByDoc.get().getId());
            return mapToDTO(existingByDoc.get());
        }

        // Extract text from PDF
        String extractedText = extractTextFromFile(file);
        if (extractedText == null || extractedText.trim().isEmpty()) {
            log.warn("Could not extract text from file: {}", file.getOriginalName());
            return null;
        }

        // Limit text length for API
        // 30K char cap — large enough to capture vitals/ROM/special tests across multi-page
        // clinical notes (Tier 2 extraction needs more context than the legacy 15K cap allowed).
        String textForAnalysis = extractedText.length() > 30000
                ? extractedText.substring(0, 30000)
                : extractedText;

        // Use AI to analyze the document
        Map<String, Object> analysisResult = analyzeDocumentWithAI(file.getOriginalName(), textForAnalysis);

        if (analysisResult == null || !Boolean.TRUE.equals(analysisResult.get("isMedicalDocument"))) {
            log.info("File {} is not identified as a medical document", file.getOriginalName());
            return null;
        }

        // Normalize provider name for consistent matching
        String rawProviderName = (String) analysisResult.getOrDefault("providerName", "Unknown Provider");
        String normalizedProvider = normalizeProviderName(rawProviderName);
        analysisResult.put("providerName", normalizedProvider);

        // Parse treatment date from analysis — leave null if AI couldn't extract one.
        // A null date is better than defaulting to today which corrupts timeline analysis.
        String dateStr = (String) analysisResult.get("treatmentDate");
        LocalDate treatmentDate = null;
        if (dateStr != null && !dateStr.isEmpty()) {
            try {
                treatmentDate = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception e) {
                log.warn("Could not parse treatment date '{}' from AI response — leaving null", dateStr);
                treatmentDate = null;
            }
        }
        // Reject future dates — almost always a hallucination from page-footer "Print Date"
        // bleeding into the service-date field. A null treatment date is recoverable; a wrong
        // one corrupts the timeline silently.
        if (treatmentDate != null && treatmentDate.isAfter(LocalDate.now())) {
            log.warn("AI returned future treatment date '{}' for file {} — likely page-footer " +
                    "bleed-through, setting to null for manual review", treatmentDate, fileId);
            treatmentDate = null;
        }

        // Check for existing record from same provider + same date — merge instead of duplicating.
        //
        // Merge semantics:
        //   * BILLING docs absorb into ANY clinical record from same provider+date.
        //     A "PT visit" clinical note + "PT visit" bill = one encounter, not two rows.
        //   * Non-billing clinical docs require exact recordType match (provider+date+recordType)
        //     so an ER record never absorbs a PT record that happens to share provider+date.
        //   * INSURANCE_LEDGER (PIP logs / EOBs) NEVER merge — they're meta-documents and
        //     always live as their own row, but excluded from totals/chronology by recordType filter.
        String newDocType = (String) analysisResult.getOrDefault("documentType", "OTHER");
        String mappedRecordType = mapDocumentTypeToRecordType(newDocType);
        boolean isBillingDoc = "BILLING".equals(mappedRecordType);
        boolean isInsuranceLedger = "INSURANCE_LEDGER".equals(mappedRecordType);
        if (treatmentDate != null && !isInsuranceLedger) {
            Optional<PIMedicalRecord> existingOpt;
            if (isBillingDoc) {
                // Billing docs collapse into any same-day, same-provider clinical encounter
                existingOpt = repository.findByCaseAndProviderAndDate(
                        caseId, orgId, normalizedProvider, treatmentDate);
            } else {
                // Non-billing clinical docs: try exact-recordType match first
                existingOpt = repository.findByCaseAndProviderAndDateAndRecordType(
                        caseId, orgId, normalizedProvider, treatmentDate, mappedRecordType);
                // Fallback: if no clinical record exists yet but a BILLING-only record was
                // created earlier (bill processed before clinical note), absorb that BILLING.
                // We only accept BILLING here — never absorb across different clinical types
                // (e.g., would never merge ER into PT, even at same provider+date).
                if (existingOpt.isEmpty()) {
                    Optional<PIMedicalRecord> billingOnly = repository.findByCaseAndProviderAndDate(
                            caseId, orgId, normalizedProvider, treatmentDate);
                    if (billingOnly.isPresent() && "BILLING".equals(billingOnly.get().getRecordType())) {
                        existingOpt = billingOnly;
                    }
                }
            }
            if (existingOpt.isPresent()) {
                PIMedicalRecord existing = existingOpt.get();
                mergeAnalysisIntoRecord(existing, fileId, analysisResult);
                // If a clinical doc is absorbing an existing BILLING-only record, upgrade
                // the recordType to the clinical type (PT/ER/etc.) so the chronology shows
                // a meaningful encounter type instead of "BILLING".
                if (!isBillingDoc && "BILLING".equals(existing.getRecordType())) {
                    existing.setRecordType(mappedRecordType);
                }
                PIMedicalRecord saved = repository.save(existing);
                log.info("Merged file {} into existing record {} (provider '{}', date {}, billing={})",
                        fileId, saved.getId(), normalizedProvider, treatmentDate, isBillingDoc);
                // Cache the AI extraction so /reprocess can replay merge logic without re-calling Bedrock
                trackScannedDocument(caseId, orgId, fileId, "merged", saved.getId(), null, analysisResult);
                return mapToDTO(saved);
            }
        }

        // No existing record — create new
        PIMedicalRecord record = createRecordFromAnalysis(caseId, orgId, fileId, analysisResult);
        PIMedicalRecord saved = repository.save(record);

        log.info("Created medical record {} from file {}", saved.getId(), file.getOriginalName());
        // Cache the AI extraction so /reprocess can re-create the record without re-calling Bedrock
        trackScannedDocument(caseId, orgId, fileId, "created", saved.getId(), null, analysisResult);
        return mapToDTO(saved);
    }

    private String extractTextFromFile(FileItem file) {
        // Primary: Tika text extraction (fast, works for text-based PDFs)
        try {
            org.springframework.core.io.Resource resource = fileStorageService.loadFileAsResource(file.getFilePath());
            try (InputStream stream = resource.getInputStream()) {
                BodyContentHandler handler = new BodyContentHandler(-1);
                Metadata metadata = new Metadata();
                metadata.set(org.apache.tika.metadata.TikaCoreProperties.RESOURCE_NAME_KEY, file.getOriginalName());
                if (file.getMimeType() != null) {
                    metadata.set(Metadata.CONTENT_TYPE, file.getMimeType());
                }
                // Use PDFParser directly for PDFs to avoid AutoDetectParser misidentifying them as archives
                boolean isPdf = "application/pdf".equals(file.getMimeType())
                        || (file.getOriginalName() != null && file.getOriginalName().toLowerCase().endsWith(".pdf"));
                org.apache.tika.parser.Parser parser = isPdf
                        ? new org.apache.tika.parser.pdf.PDFParser()
                        : new AutoDetectParser();
                ParseContext context = new ParseContext();
                parser.parse(stream, handler, metadata, context);
                String text = handler.toString();
                if (text != null && !text.trim().isEmpty()) {
                    log.info("Tika extracted {} chars from file {}", text.length(), file.getOriginalName());
                    return text;
                }
            }
        } catch (Exception e) {
            log.warn("Tika extraction failed for file {} (id={}): {}", file.getOriginalName(), file.getId(), e.getMessage());
        }

        // Fallback: CaseDocumentService has Vision OCR (PDF→JPEG + Claude Haiku) for scanned PDFs
        if ("application/pdf".equals(file.getMimeType())) {
            log.info("Tika returned empty for file {} — attempting OCR fallback via CaseDocumentService", file.getId());
            try {
                Long orgId = getRequiredOrganizationId();
                String ocrText = caseDocumentService.getDocumentText(file.getId(), orgId, 15000);
                if (ocrText != null && !ocrText.trim().isEmpty()
                        && !ocrText.startsWith("Error:")
                        && !ocrText.startsWith("No text content")
                        && !ocrText.startsWith("This file type")) {
                    log.info("OCR fallback extracted {} chars from file {}", ocrText.length(), file.getId());
                    return ocrText;
                }
            } catch (Exception e) {
                log.warn("OCR fallback also failed for file {}: {}", file.getId(), e.getMessage());
            }
        }

        log.warn("Could not extract any text from file: {} (id={})", file.getOriginalName(), file.getId());
        return null;
    }

    // Chunking config: when extracted text > 100K, split into 90K chunks with 10K overlap.
    // Caps total processed text at 5 chunks (450K chars / ~150 pages) to bound token cost
    // on pathologically large attachments. For Marsel's 59-page Team Rehab bundle (~180K chars),
    // this produces 3 chunks instead of silently dropping the back half of the document.
    private static final int SINGLE_PASS_MAX_CHARS = 100_000;
    private static final int CHUNK_SIZE_CHARS = 90_000;
    private static final int CHUNK_OVERLAP_CHARS = 10_000;
    private static final int MAX_CHUNKS = 5;

    private Map<String, Object> analyzeDocumentWithAI(String fileName, String documentText) {
        if (documentText.length() <= SINGLE_PASS_MAX_CHARS) {
            return analyzeChunkWithAI(fileName, documentText, null);
        }

        // Document too large for a single AI call — chunk with overlap and merge results.
        List<String> chunks = chunkText(documentText);
        log.info("Document '{}' ({} chars) split into {} chunks for AI analysis",
                fileName, documentText.length(), chunks.size());

        List<Map<String, Object>> chunkResults = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            String label = String.format("part %d of %d", i + 1, chunks.size());
            Map<String, Object> result = analyzeChunkWithAI(fileName, chunks.get(i), label);
            if (result != null) {
                chunkResults.add(result);
            } else {
                log.warn("Chunk {} of {} returned null for '{}'", i + 1, chunks.size(), fileName);
            }
        }

        if (chunkResults.isEmpty()) {
            log.error("All {} chunks failed analysis for '{}'", chunks.size(), fileName);
            return null;
        }
        return mergeChunkResults(chunkResults);
    }

    /**
     * Split text into overlapping chunks. Each chunk is up to CHUNK_SIZE_CHARS;
     * adjacent chunks share CHUNK_OVERLAP_CHARS so context isn't lost at boundaries
     * (e.g., a visit note that straddles chunks is visible to both AI calls).
     * Hard cap of MAX_CHUNKS bounds token cost; the tail of the document past that
     * is silently dropped — Tier 6 (visit-aware splitting) is the correct long-term fix.
     */
    private List<String> chunkText(String text) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < text.length() && chunks.size() < MAX_CHUNKS) {
            int end = Math.min(start + CHUNK_SIZE_CHARS, text.length());
            chunks.add(text.substring(start, end));
            if (end == text.length()) break;
            start = end - CHUNK_OVERLAP_CHARS;
        }
        return chunks;
    }

    /**
     * Merge per-chunk extraction results into a single record-shaped Map.
     * Per-field merge rules are tuned to how clinical-doc data actually distributes
     * across chunks of a long records bundle:
     *   - providerName / providerType: longest non-empty (consistent across chunks)
     *   - treatmentDate: earliest non-null (anchor on first encounter date)
     *   - treatmentEndDate: latest non-null (captures the document's full span)
     *   - diagnoses / procedures: union by code (ICD / CPT)
     *   - specialTests / medications*: union all (each chunk may surface different ones)
     *   - billedAmount / paidAmount: max (totals usually appear in only one chunk)
     *   - vitals / rangeOfMotion: from first chunk that has data (vitals are per-encounter,
     *     and the first chunk is most likely to contain the initial-eval vitals)
     *   - keyFindings / treatmentProvided: concatenate all non-empty (each chunk has different findings)
     *   - prognosisNotes / workRestrictions / causationStatement: longest non-empty (one strong quote beats fragments)
     *   - treatingClinician / treatingRole / causationSource: first non-empty
     *   - citationMetadata: from chunk with the most populated fields (best single citation set)
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeChunkResults(List<Map<String, Object>> chunks) {
        if (chunks.size() == 1) return chunks.get(0);

        Map<String, Object> merged = new java.util.LinkedHashMap<>();

        // Boolean: any chunk saying yes wins
        merged.put("isMedicalDocument", chunks.stream()
                .anyMatch(c -> Boolean.TRUE.equals(c.get("isMedicalDocument"))));

        // documentType: take from first chunk that returned a non-OTHER value
        String docType = chunks.stream()
                .map(c -> (String) c.get("documentType"))
                .filter(t -> t != null && !t.isBlank() && !"OTHER".equalsIgnoreCase(t))
                .findFirst()
                .orElseGet(() -> chunks.stream()
                        .map(c -> (String) c.get("documentType"))
                        .filter(t -> t != null && !t.isBlank())
                        .findFirst().orElse("OTHER"));
        merged.put("documentType", docType);

        // Strings — first / longest non-empty
        putLongestNonEmptyString(merged, chunks, "providerName");
        putLongestNonEmptyString(merged, chunks, "providerType");
        putFirstNonEmptyString(merged, chunks, "treatingClinician");
        putFirstNonEmptyString(merged, chunks, "treatingRole");
        putFirstNonEmptyString(merged, chunks, "causationSource");
        putLongestNonEmptyString(merged, chunks, "prognosisNotes");
        putLongestNonEmptyString(merged, chunks, "workRestrictions");
        putLongestNonEmptyString(merged, chunks, "causationStatement");

        // Concatenated findings (each chunk has unique findings)
        putConcatenatedString(merged, chunks, "keyFindings");
        putConcatenatedString(merged, chunks, "treatmentProvided");

        // Dates — earliest start, latest end
        putEarliestDateString(merged, chunks, "treatmentDate");
        putLatestDateString(merged, chunks, "treatmentEndDate");

        // Numeric — max (totals usually appear once)
        putMaxNumber(merged, chunks, "billedAmount");
        putMaxNumber(merged, chunks, "paidAmount");

        // List<Map> unions — by ICD/CPT for diagnoses/procedures, by structural identity otherwise
        putUnionByKey(merged, chunks, "diagnoses", "icd_code");
        putUnionByKey(merged, chunks, "procedures", "cpt_code");
        putUnionAll(merged, chunks, "specialTests");
        putUnionAll(merged, chunks, "medicationsAdministered");
        putUnionAll(merged, chunks, "medicationsPrescribed");

        // Map<String,Object> — first non-empty (vitals/ROM are per-encounter, take first observation)
        putFirstNonEmptyMap(merged, chunks, "vitals");
        putFirstNonEmptyMap(merged, chunks, "rangeOfMotion");

        // Citation metadata — take from chunk with the most populated fields (best single source)
        Map<String, Object> bestCitations = chunks.stream()
                .map(c -> (Map<String, Object>) c.get("citationMetadata"))
                .filter(m -> m != null && !m.isEmpty())
                .max(Comparator.comparingInt(Map::size))
                .orElse(null);
        if (bestCitations != null) merged.put("citationMetadata", bestCitations);

        return merged;
    }

    // --- mergeChunkResults helpers -------------------------------------------------

    private void putFirstNonEmptyString(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        chunks.stream()
                .map(c -> (String) c.get(key))
                .filter(s -> s != null && !s.isBlank())
                .findFirst()
                .ifPresent(s -> merged.put(key, s));
    }

    private void putLongestNonEmptyString(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        chunks.stream()
                .map(c -> (String) c.get(key))
                .filter(s -> s != null && !s.isBlank())
                .max(Comparator.comparingInt(String::length))
                .ifPresent(s -> merged.put(key, s));
    }

    private void putConcatenatedString(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        // Deduplicate near-identical findings (chunk overlap can produce them)
        java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>();
        for (Map<String, Object> c : chunks) {
            String s = (String) c.get(key);
            if (s != null && !s.isBlank()) {
                String trimmed = s.trim();
                // Skip if a longer version of this content is already present
                boolean isDup = seen.stream().anyMatch(existing ->
                        existing.toLowerCase().contains(trimmed.toLowerCase()) ||
                                trimmed.toLowerCase().contains(existing.toLowerCase()));
                if (!isDup) seen.add(trimmed);
            }
        }
        if (!seen.isEmpty()) merged.put(key, String.join(" | ", seen));
    }

    private void putEarliestDateString(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        chunks.stream()
                .map(c -> (String) c.get(key))
                .filter(s -> s != null && !s.isBlank())
                .min(Comparator.naturalOrder())  // ISO YYYY-MM-DD strings sort lexicographically
                .ifPresent(s -> merged.put(key, s));
    }

    private void putLatestDateString(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        chunks.stream()
                .map(c -> (String) c.get(key))
                .filter(s -> s != null && !s.isBlank())
                .max(Comparator.naturalOrder())
                .ifPresent(s -> merged.put(key, s));
    }

    private void putMaxNumber(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        chunks.stream()
                .map(c -> c.get(key))
                .filter(Objects::nonNull)
                .mapToDouble(o -> {
                    if (o instanceof Number) return ((Number) o).doubleValue();
                    if (o instanceof String) {
                        String s = ((String) o).replaceAll("[^\\d.]", "");
                        try { return s.isEmpty() ? 0.0 : Double.parseDouble(s); }
                        catch (Exception e) { return 0.0; }
                    }
                    return 0.0;
                })
                .max()
                .ifPresent(max -> { if (max > 0) merged.put(key, max); });
    }

    @SuppressWarnings("unchecked")
    private void putUnionByKey(Map<String, Object> merged, List<Map<String, Object>> chunks, String key, String dedupKey) {
        java.util.LinkedHashMap<String, Map<String, Object>> byKey = new java.util.LinkedHashMap<>();
        for (Map<String, Object> c : chunks) {
            List<Map<String, Object>> list = (List<Map<String, Object>>) c.get(key);
            if (list == null) continue;
            for (Map<String, Object> item : list) {
                String code = String.valueOf(item.getOrDefault(dedupKey, ""));
                if (code.isEmpty()) {
                    byKey.put("__no_key_" + byKey.size(), item);  // keep items lacking the dedup key
                } else if (!byKey.containsKey(code)) {
                    byKey.put(code, item);
                }
            }
        }
        if (!byKey.isEmpty()) merged.put(key, new ArrayList<>(byKey.values()));
    }

    @SuppressWarnings("unchecked")
    private void putUnionAll(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        // Dedup by structural equality: stringify each Map and check the set
        java.util.LinkedHashMap<String, Map<String, Object>> seen = new java.util.LinkedHashMap<>();
        for (Map<String, Object> c : chunks) {
            List<Map<String, Object>> list = (List<Map<String, Object>>) c.get(key);
            if (list == null) continue;
            for (Map<String, Object> item : list) {
                String sig = item.toString();  // good enough for small flat maps; identical objects produce identical strings
                seen.putIfAbsent(sig, item);
            }
        }
        if (!seen.isEmpty()) merged.put(key, new ArrayList<>(seen.values()));
    }

    @SuppressWarnings("unchecked")
    private void putFirstNonEmptyMap(Map<String, Object> merged, List<Map<String, Object>> chunks, String key) {
        chunks.stream()
                .map(c -> (Map<String, Object>) c.get(key))
                .filter(m -> m != null && !m.isEmpty())
                .findFirst()
                .ifPresent(m -> merged.put(key, m));
    }

    // --- AI call (single chunk) ---------------------------------------------------

    private Map<String, Object> analyzeChunkWithAI(String fileName, String documentText, String chunkLabel) {
        // When chunkLabel is non-null, this text is part of a multi-chunk document.
        // Inform the AI so it doesn't hallucinate "missing" fields and keeps citation metadata
        // page numbers relative to this chunk.
        String chunkContext = chunkLabel != null
                ? String.format("""

                IMPORTANT — DOCUMENT IS CHUNKED:
                This text is %s of a longer document split for analysis.
                - Extract fields visible in THIS section.
                - For fields requiring information that may be in OTHER chunks (e.g., total billed amount
                  if the bill summary isn't in this section, or a provider name if this section lacks the
                  letterhead), return null/empty rather than guessing.
                - Page numbers in citationMetadata are relative to THIS chunk only.

                """, chunkLabel)
                : "";

        String prompt = String.format("""
            Analyze this medical document and extract structured information WITH CITATION METADATA.
            %s
            DOCUMENT NAME: %s

            DOCUMENT CONTENT:
            %s

            ---

            IMPORTANT: For each field you extract, include citation metadata showing:
            - page: The page number where the information was found (estimate based on content position if multi-page)
            - excerpt: The exact text snippet (20-80 characters) from the document that contains this information
            - charOffset: Approximate character offset from the start of the document

            Provide a JSON response with the following structure:
            {
                "isMedicalDocument": true/false,
                "documentType": "ER|PT|IMAGING|CHIROPRACTIC|SURGERY|CONSULTATION|LAB|PRIMARY_CARE|BILLING|PIP_LOG|OTHER",
                "providerName": "Name of the medical provider/facility",
                "providerType": "HOSPITAL|PHYSICAL_THERAPY|CHIROPRACTIC|RADIOLOGY|ORTHOPEDICS|NEUROLOGY|PRIMARY_CARE|OTHER",
                "treatingClinician": "Person who signed/co-signed (e.g., 'Willy Moy, PA-C') or null",
                "treatingRole": "Credential: PA-C | DPT | DC | MD | DO | NP | PTA | RN | OTHER, or null",
                "treatmentDate": "YYYY-MM-DD format if found",
                "treatmentEndDate": "YYYY-MM-DD format if found (for PT, chiro, etc.)",
                "diagnoses": [
                    {"icd_code": "M54.5", "description": "Low back pain", "primary": true}
                ],
                "billedAmount": 0.00,
                "paidAmount": 0.00,
                "vitals": {
                    "bp": "129/80", "hr": 80, "weight_lbs": 133, "height": "5'5\\"",
                    "bmi": 22.13, "pain": "4/10", "temp_f": 98.0, "resp": 18, "spo2": 99
                },
                "rangeOfMotion": {
                    "cervical": {"flex": 60, "ext": 75, "lat_flex_R": 25, "lat_flex_L": 25, "rot": 80},
                    "lumbar":   {"flex": 45, "ext": 10, "lat_flex": 15, "rot": 45}
                },
                "specialTests": [
                    {"name": "Lasègue's", "side": "L", "result": "positive"},
                    {"name": "Kemp's",    "side": "bilateral", "result": "positive"}
                ],
                "medicationsAdministered": [
                    {"name": "Motrin", "dose": "600 mg", "route": "PO", "frequency": "once"}
                ],
                "medicationsPrescribed": [
                    {"name": "Ibuprofen", "dose": "600 mg", "frequency": "q8h", "duration": "10 days"}
                ],
                "causationStatement": "Verbatim quote about MVA causation, or null",
                "causationSource": "Clinician + date attribution (e.g., 'PA Moy 11/11/2025'), or null",
                "keyFindings": "Brief summary of key clinical findings",
                "treatmentProvided": "Summary of treatment/procedures performed",
                "prognosisNotes": "Any prognosis or outcome information",
                "workRestrictions": "Any work restrictions mentioned",
                "citationMetadata": {
                    "treatmentDate":    {"page": 1, "excerpt": "Date of Service: 01/15/2024", "charOffset": 150},
                    "providerName":     {"page": 1, "excerpt": "Boston Medical Center", "charOffset": 50},
                    "treatingClinician":{"page": 1, "excerpt": "Electronically signed by: Willy Moy, PA-C", "charOffset": 75},
                    "vitals":           {"page": 1, "excerpt": "BP 129/80 HR 80 BMI 22.13", "charOffset": 220},
                    "specialTests":     {"page": 2, "excerpt": "(+) L Lasègue's, (+) bilateral Kemp's", "charOffset": 1100},
                    "diagnoses": [
                        {"icd_code": "M54.5", "page": 3, "excerpt": "Diagnosis: Lumbar strain (M54.5)", "charOffset": 2800}
                    ],
                    "procedures": [
                        {"cpt_code": "99283", "page": 3, "excerpt": "ED Visit Level III (99283)", "charOffset": 3200}
                    ],
                    "billedAmount":    {"page": 4, "excerpt": "Total Charges: $2,450.00", "charOffset": 4100},
                    "causationStatement": {"page": 3, "excerpt": "to a reasonable degree of medical certainty", "charOffset": 2950}
                }
            }

            Important:
            - If this is NOT a medical document (e.g., insurance form, legal document), set isMedicalDocument to false
            - Work excuse letters, work excuse notes, return-to-work letters, administrative correspondence, attorney letters, and authorizations are NOT medical documents — set isMedicalDocument to false
            - ORIGINAL provider BILLING documents (invoices, billing statements, itemized charges from a SINGLE provider) ARE medical documents — always set isMedicalDocument to true for them. They track costs tied to treatment. Set documentType to BILLING.
            - SPECIAL CASE — PIP LOGS / INSURANCE PAYMENT LEDGERS / EOB SUMMARIES:
              A PIP Log, Insurance Payment Activity Log, Explanation of Benefits, or any aggregate payment
              ledger lists payments made by an INSURER across MULTIPLE provider visits. These are NOT a
              single bill — they SUMMARIZE amounts already billed by individual provider documents that
              are uploaded separately. Treating them as a regular BILLING doc causes DOUBLE-COUNTING.
              Detection signs (any one is enough):
                * Insurer letterhead (e.g., "Commerce Insurance", "Liberty Mutual", "Geico")
                * Phrases like "PIP Payment Log", "Payment Activity", "Claim Number", "Claim #"
                * Multiple rows showing (date, provider, amount paid, payee)
                * References to "PIP limit", "deductible paid", "PIP remaining", "amount paid"
              When you detect any of these:
                * Set documentType to "PIP_LOG"
                * Set isMedicalDocument to true (still useful — provides paid-amounts and coverage state)
                * Set billedAmount to 0 (the same line-item amounts appear on individual provider bills uploaded separately)
                * Set paidAmount to the TOTAL paid-to-date shown on the log (this is real data we want to capture)
                * Set providerName to the INSURER name (e.g., "Commerce Insurance Company"), NOT the line-item provider names
                * Set treatmentDate to null (the log spans many encounters)
            - For providerName, always use the OFFICIAL institution name exactly as it appears on the letterhead/header of the document. Do not combine or abbreviate differently across documents from the same facility. NEVER concatenate provider names from different facilities.
            - Extract the most accurate provider name from the letterhead or document header
            - Include all diagnoses with ICD codes if available
            - BILLING AMOUNTS MUST BE EXACT — NEVER round, estimate, or approximate dollar amounts. Copy the exact amount from the document to the cent. An incorrect billing amount could have serious legal consequences. If the document shows $2,399.50, report exactly $2,399.50, NOT $2,400. If you cannot determine the exact amount, set billedAmount to 0 rather than guessing.
            - treatingClinician: extract from "Electronically signed by:" / signature line. Include the credential suffix (e.g., "Willy Moy, PA-C", "Ian Giuttari, DC", "Vivian Bui, DPT"). If absent, return null — DO NOT guess.
            - treatingRole: clinician's PRIMARY credential. PA-C = Physician Assistant, DPT = Doctor of Physical Therapy, DC = Doctor of Chiropractic, MD = Medical Doctor, DO = Doctor of Osteopathy, NP = Nurse Practitioner, PTA = Physical Therapy Assistant, RN = Registered Nurse. If uncertain, return null.
            - vitals: ONLY if a vitals strip / vital signs section is present. Use the EXACT NUMBERS from the document. Use null for any field not documented (do not invent).
            - rangeOfMotion: ONLY measured ROM values, grouped by region (cervical / thoracic / lumbar / shoulder / hip / knee / ankle / wrist). Copy the EXACT degrees. Use null when not measured.
            - specialTests: orthopedic special tests with side ("L" / "R" / "bilateral") and result ("positive" / "negative"). Common tests: Lasègue's / SLR, Kemp's, Milgram's, Soto Hall, Patrick's / FABER, Hoffmann's, Hawkins, Neer's, Jobe's, MNCT. Empty array if none performed.
            - medicationsAdministered: meds GIVEN during the encounter (e.g., ED gave Motrin 600mg PO). Empty array if none.
            - medicationsPrescribed: meds prescribed for HOME USE (e.g., "Rx Ibuprofen 600mg q8h x 10 days"). Empty array if none.
            - causationStatement: extract VERBATIM any statement explicitly tying findings to the MVA "to a reasonable degree of medical certainty" or "directly related to the accident on..." or "are a direct result of the accident". Copy the exact words. null if no such statement.
            - causationSource: clinician name + date format like "PA Moy 11/11/2025" or "DC Giuttari 12/04/2025". Pulls from the clinician who issued the causation statement.
            - For ANY field whose data is not in the document text: set null (string fields), [] (array fields), or omit (object fields). NEVER hallucinate clinical content.
            - Be thorough with key findings
            - ALWAYS include citationMetadata with page numbers and excerpts for traceability
            - Page numbers should be 1-indexed

            CRITICAL FOR CITATION EXCERPTS:
            - The "excerpt" field MUST be COPIED VERBATIM from the document text - do NOT paraphrase or summarize
            - Copy the exact characters, punctuation, and formatting as they appear in the document
            - For dates, copy exactly as shown (e.g., if document says "DATE: 10/14/2025" copy "DATE: 10/14/2025", NOT "date on 10/14/2025")
            - For provider names, copy the exact text from the letterhead (e.g., "CITY DIAGNOSTIC IMAGING" not "City Diagnostic Imaging")
            - The excerpt must be searchable in the original document - if you search for it, it must match exactly

            Return ONLY the JSON, no additional text.
            """, chunkContext, fileName, documentText);

        try {
            // Use Sonnet for structured data extraction — 3-5x faster than Opus, equally capable for JSON extraction
            String response = claudeService.generateCompletionWithModel(prompt, null, false, null, null, "claude-sonnet-4-6").get();

            // Parse JSON response
            String jsonContent = extractJsonFromResponse(response);
            return objectMapper.readValue(jsonContent, new TypeReference<Map<String, Object>>() {});

        } catch (Exception e) {
            log.error("Error analyzing document with AI: {}", e.getMessage());
            return null;
        }
    }

    private String extractJsonFromResponse(String response) {
        // Find JSON object in response
        int start = response.indexOf('{');
        int end = response.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return response.substring(start, end + 1);
        }
        return response;
    }

    private PIMedicalRecord createRecordFromAnalysis(Long caseId, Long orgId, Long fileId,
                                                      Map<String, Object> analysis) {
        PIMedicalRecord record = new PIMedicalRecord();
        record.setCaseId(caseId);
        record.setOrganizationId(orgId);
        record.setDocumentId(fileId);

        // Provider info
        record.setProviderName((String) analysis.getOrDefault("providerName", "Unknown Provider"));
        record.setProviderType((String) analysis.get("providerType"));

        // Record type
        String docType = (String) analysis.getOrDefault("documentType", "OTHER");
        record.setRecordType(mapDocumentTypeToRecordType(docType));

        // Dates — leave null if AI couldn't extract a date; today's date would corrupt timeline analysis
        String dateStr = (String) analysis.get("treatmentDate");
        if (dateStr != null && !dateStr.isEmpty()) {
            try {
                LocalDate parsed = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
                // Reject future dates (page-footer bleed-through hallucination)
                if (parsed.isAfter(LocalDate.now())) {
                    log.warn("AI returned future treatment date '{}' for file {} — setting null", parsed, fileId);
                    record.setTreatmentDate(null);
                } else {
                    record.setTreatmentDate(parsed);
                }
            } catch (Exception e) {
                log.warn("Could not parse treatment date '{}' — storing null", dateStr);
                record.setTreatmentDate(null);
            }
        } else {
            record.setTreatmentDate(null);
        }

        String endDateStr = (String) analysis.get("treatmentEndDate");
        if (endDateStr != null && !endDateStr.isEmpty()) {
            try {
                LocalDate parsedEnd = LocalDate.parse(endDateStr, DateTimeFormatter.ISO_LOCAL_DATE);
                if (parsedEnd.isAfter(LocalDate.now())) {
                    log.warn("AI returned future treatment-end date '{}' for file {} — ignoring", parsedEnd, fileId);
                } else {
                    record.setTreatmentEndDate(parsedEnd);
                }
            } catch (Exception e) {
                // Ignore
            }
        }

        // Diagnoses
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diagnoses = (List<Map<String, Object>>) analysis.get("diagnoses");
        if (diagnoses != null && !diagnoses.isEmpty()) {
            record.setDiagnoses(diagnoses);
        }

        // Billing — ONLY persist billedAmount on BILLING-type records.
        // Clinical documents (ER, PT, etc.) sometimes incidentally contain a "Total Charges" line
        // (e.g., a discharge summary appended to clinical records). The AI extracts that as
        // billedAmount, and we'd then double-count it against the actual bill document. The bill
        // is the single source of truth for charges; clinical records contribute clinical content
        // only. If a clinical doc is later merged with a billing doc (Tier 1 logic), the merge
        // path applies the bill's amount via mergeAnalysisIntoRecord.
        if ("BILLING".equals(record.getRecordType())) {
            Object billedObj = analysis.get("billedAmount");
            if (billedObj != null) {
                try {
                    if (billedObj instanceof Number) {
                        record.setBilledAmount(BigDecimal.valueOf(((Number) billedObj).doubleValue()));
                    } else if (billedObj instanceof String) {
                        String billedStr = ((String) billedObj).replaceAll("[^\\d.]", "");
                        if (!billedStr.isEmpty()) {
                            record.setBilledAmount(new BigDecimal(billedStr));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Could not parse billed amount: {}", billedObj);
                }
            }
        }

        // Paid amount: ONLY persist for INSURANCE_LEDGER records (PIP logs / EOBs).
        // Individual provider bills often show "Amount Paid" line items that reflect the SAME
        // payments already counted in the PIP log's running total — persisting them here would
        // double-count when the frontend sums paidAmount across all records. The PIP log is the
        // single source of truth for paid-to-date.
        if ("INSURANCE_LEDGER".equals(record.getRecordType())) {
            Object paidObj = analysis.get("paidAmount");
            if (paidObj != null) {
                try {
                    if (paidObj instanceof Number) {
                        record.setPaidAmount(BigDecimal.valueOf(((Number) paidObj).doubleValue()));
                    } else if (paidObj instanceof String) {
                        String paidStr = ((String) paidObj).replaceAll("[^\\d.]", "");
                        if (!paidStr.isEmpty()) {
                            record.setPaidAmount(new BigDecimal(paidStr));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Could not parse paid amount: {}", paidObj);
                }
            }
        }

        // Clinical notes
        record.setKeyFindings((String) analysis.get("keyFindings"));
        record.setTreatmentProvided((String) analysis.get("treatmentProvided"));
        record.setPrognosisNotes((String) analysis.get("prognosisNotes"));
        record.setWorkRestrictions((String) analysis.get("workRestrictions"));

        // Tier 2: clinician + clinical detail fields
        record.setTreatingClinician(emptyToNull((String) analysis.get("treatingClinician")));
        record.setTreatingRole(emptyToNull((String) analysis.get("treatingRole")));
        record.setCausationStatement(emptyToNull((String) analysis.get("causationStatement")));
        record.setCausationSource(emptyToNull((String) analysis.get("causationSource")));

        // Vitals & ROM (Map<String,Object> — Hibernate handles JSONB via @JdbcTypeCode)
        @SuppressWarnings("unchecked")
        Map<String, Object> vitals = (Map<String, Object>) analysis.get("vitals");
        if (vitals != null && !vitals.isEmpty()) record.setVitals(vitals);

        @SuppressWarnings("unchecked")
        Map<String, Object> rom = (Map<String, Object>) analysis.get("rangeOfMotion");
        if (rom != null && !rom.isEmpty()) record.setRangeOfMotion(rom);

        // Special tests + medications (List<Map> — same pattern as diagnoses)
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> specialTests = (List<Map<String, Object>>) analysis.get("specialTests");
        if (specialTests != null && !specialTests.isEmpty()) record.setSpecialTests(specialTests);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> medsAdmin = (List<Map<String, Object>>) analysis.get("medicationsAdministered");
        if (medsAdmin != null && !medsAdmin.isEmpty()) record.setMedicationsAdministered(medsAdmin);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> medsRx = (List<Map<String, Object>>) analysis.get("medicationsPrescribed");
        if (medsRx != null && !medsRx.isEmpty()) record.setMedicationsPrescribed(medsRx);

        // Citation metadata for smart citations feature
        @SuppressWarnings("unchecked")
        Map<String, Object> citationMetadata = (Map<String, Object>) analysis.get("citationMetadata");
        if (citationMetadata != null && !citationMetadata.isEmpty()) {
            record.setCitationMetadata(citationMetadata);
            log.info("Citation metadata extracted with {} fields", citationMetadata.size());
        }

        // Completeness
        record.setIsComplete(determineCompleteness(record));

        return record;
    }

    /** Treats the empty string as null. Useful for AI responses where "" and null are both "no data". */
    private static String emptyToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private String mapDocumentTypeToRecordType(String docType) {
        return switch (docType.toUpperCase()) {
            case "ER" -> "ER";
            case "PT", "PHYSICAL_THERAPY" -> "PT";
            case "IMAGING", "MRI", "XRAY", "CT" -> "IMAGING";
            case "CHIROPRACTIC", "CHIRO" -> "CHIROPRACTIC";
            case "SURGERY" -> "SURGERY";
            case "CONSULTATION" -> "CONSULTATION";
            case "LAB" -> "LAB";
            case "PRIMARY_CARE" -> "PRIMARY_CARE";
            case "BILLING", "INVOICE" -> "BILLING";
            // Insurance summary docs (PIP logs, EOBs) — never sum into billing totals;
            // their billedAmount is set to 0 by the AI prompt to prevent double-counting.
            case "PIP_LOG", "INSURANCE_LEDGER", "EOB" -> "INSURANCE_LEDGER";
            default -> "FOLLOW_UP";
        };
    }

    /**
     * Normalize provider name to title case for consistent matching.
     * "NORTHEAST IMAGING" and "Northeast Imaging" both become "Northeast Imaging".
     * Strips trailing punctuation per word so "IPS, LLC" and "IPS LLC" canonicalize identically —
     * different document letterheads often vary in punctuation, and these variations would
     * otherwise prevent the merge logic from recognizing same-provider records.
     */
    private String normalizeProviderName(String name) {
        if (name == null || name.isBlank()) return "Unknown Provider";
        // Strip non-alphanumeric chars except spaces, hyphens, and apostrophes — punctuation
        // (commas, periods) varies across documents from the same provider; legitimate
        // distinguishers like apostrophes ("St. Mary's") and hyphens ("Cedars-Sinai") are kept.
        String cleaned = name.trim().replaceAll("[^\\p{Alnum}\\s\\-']+", "");
        String[] words = cleaned.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            if (word.isEmpty()) continue;
            // Keep true abbreviations uppercase: all letters, all caps, 2-3 chars (e.g., CHA, MRI, PT)
            if (word.length() <= 3 && word.matches("[A-Z]{2,3}")) {
                sb.append(word);
            } else {
                sb.append(Character.toUpperCase(word.charAt(0)));
                if (word.length() > 1) {
                    sb.append(word.substring(1).toLowerCase());
                }
            }
            if (i < words.length - 1) sb.append(" ");
        }
        return sb.toString();
    }

    /**
     * Merge new analysis data into an existing record (same provider + same date).
     * Appends key findings and billing, updates fields that were previously empty.
     */
    private void mergeAnalysisIntoRecord(PIMedicalRecord existing, Long newFileId,
                                          Map<String, Object> analysis) {
        // Append key findings
        String newFindings = (String) analysis.get("keyFindings");
        if (newFindings != null && !newFindings.isBlank()) {
            String existingFindings = existing.getKeyFindings();
            if (existingFindings == null || existingFindings.isBlank()) {
                existing.setKeyFindings(newFindings);
            } else if (!existingFindings.toLowerCase().contains(newFindings.toLowerCase().substring(0, Math.min(30, newFindings.length())))) {
                existing.setKeyFindings(existingFindings + " | " + newFindings);
            }
        }

        // Append treatment provided
        String newTreatment = (String) analysis.get("treatmentProvided");
        if (newTreatment != null && !newTreatment.isBlank()) {
            String existingTreatment = existing.getTreatmentProvided();
            if (existingTreatment == null || existingTreatment.isBlank()) {
                existing.setTreatmentProvided(newTreatment);
            } else if (!existingTreatment.toLowerCase().contains(newTreatment.toLowerCase().substring(0, Math.min(30, newTreatment.length())))) {
                existing.setTreatmentProvided(existingTreatment + " | " + newTreatment);
            }
        }

        // Add billing amount — ONLY when the new doc is a BILLING document.
        // Clinical notes that incidentally mention a charge are not authoritative; we never want
        // their billedAmount to influence the record's stored value, even during merge.
        String newDocTypeForBilling = (String) analysis.getOrDefault("documentType", "OTHER");
        boolean newIsBilling = "BILLING".equalsIgnoreCase(newDocTypeForBilling)
                || "INVOICE".equalsIgnoreCase(newDocTypeForBilling);
        if (newIsBilling) {
            Object billedObj = analysis.get("billedAmount");
            if (billedObj != null) {
                BigDecimal newAmount = null;
                try {
                    if (billedObj instanceof Number) {
                        newAmount = BigDecimal.valueOf(((Number) billedObj).doubleValue());
                    } else if (billedObj instanceof String) {
                        String billedStr = ((String) billedObj).replaceAll("[^\\d.]", "");
                        if (!billedStr.isEmpty()) newAmount = new BigDecimal(billedStr);
                    }
                } catch (Exception e) {
                    log.warn("Could not parse billed amount during merge: {}", billedObj);
                }
                if (newAmount != null && newAmount.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal existingAmount = existing.getBilledAmount() != null ? existing.getBilledAmount() : BigDecimal.ZERO;
                    // MAX rather than SUM — two billing docs for the same encounter typically reference
                    // the same total (e.g., a statement and an itemized bill). Max preserves the
                    // authoritative figure without inflating totals.
                    existing.setBilledAmount(newAmount.max(existingAmount));
                }
            }
        }

        // Note: paidAmount intentionally NOT merged here. Merge is only invoked for
        // non-INSURANCE_LEDGER records (see analyzeFileAndCreateRecord), and individual
        // provider bills' "Amount Paid" fields would double-count payments already
        // captured by the PIP log's running total. The PIP log (INSURANCE_LEDGER) is
        // the single source of truth for paid-to-date.

        // Fill in prognosis if empty
        String newPrognosis = (String) analysis.get("prognosisNotes");
        if (newPrognosis != null && !newPrognosis.isBlank() &&
                (existing.getPrognosisNotes() == null || existing.getPrognosisNotes().isBlank())) {
            existing.setPrognosisNotes(newPrognosis);
        }

        // Fill in work restrictions if empty
        String newRestrictions = (String) analysis.get("workRestrictions");
        if (newRestrictions != null && !newRestrictions.isBlank() &&
                (existing.getWorkRestrictions() == null || existing.getWorkRestrictions().isBlank())) {
            existing.setWorkRestrictions(newRestrictions);
        }

        // Merge diagnoses
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newDiagnoses = (List<Map<String, Object>>) analysis.get("diagnoses");
        if (newDiagnoses != null && !newDiagnoses.isEmpty()) {
            List<Map<String, Object>> existingDiagnoses = existing.getDiagnoses();
            if (existingDiagnoses == null || existingDiagnoses.isEmpty()) {
                existing.setDiagnoses(newDiagnoses);
            } else {
                // Add only new diagnoses (by ICD code) — copy to mutable list first
                List<Map<String, Object>> merged = new ArrayList<>(existingDiagnoses);
                java.util.Set<String> existingCodes = existingDiagnoses.stream()
                        .map(d -> String.valueOf(d.getOrDefault("icd_code", "")))
                        .collect(java.util.stream.Collectors.toSet());
                for (Map<String, Object> diag : newDiagnoses) {
                    String code = String.valueOf(diag.getOrDefault("icd_code", ""));
                    if (!code.isEmpty() && !existingCodes.contains(code)) {
                        merged.add(diag);
                    }
                }
                existing.setDiagnoses(merged);
            }
        }

        // Tier 2: merge clinical detail fields. Strategy: fill if empty (don't overwrite existing data).
        // Two docs for the same encounter typically agree on these — when they disagree, the first
        // doc to populate the field wins, which preserves provenance from the most-complete source.
        if (existing.getTreatingClinician() == null || existing.getTreatingClinician().isBlank()) {
            String newClinician = (String) analysis.get("treatingClinician");
            if (newClinician != null && !newClinician.isBlank()) existing.setTreatingClinician(newClinician);
        }
        if (existing.getTreatingRole() == null || existing.getTreatingRole().isBlank()) {
            String newRole = (String) analysis.get("treatingRole");
            if (newRole != null && !newRole.isBlank()) existing.setTreatingRole(newRole);
        }
        if (existing.getCausationStatement() == null || existing.getCausationStatement().isBlank()) {
            String newCausation = (String) analysis.get("causationStatement");
            if (newCausation != null && !newCausation.isBlank()) {
                existing.setCausationStatement(newCausation);
                String src = (String) analysis.get("causationSource");
                if (src != null && !src.isBlank()) existing.setCausationSource(src);
            }
        }

        // Vitals/ROM: take first populated set (encounter snapshot)
        @SuppressWarnings("unchecked")
        Map<String, Object> newVitals = (Map<String, Object>) analysis.get("vitals");
        if (newVitals != null && !newVitals.isEmpty()
                && (existing.getVitals() == null || existing.getVitals().isEmpty())) {
            existing.setVitals(newVitals);
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> newRom = (Map<String, Object>) analysis.get("rangeOfMotion");
        if (newRom != null && !newRom.isEmpty()
                && (existing.getRangeOfMotion() == null || existing.getRangeOfMotion().isEmpty())) {
            existing.setRangeOfMotion(newRom);
        }

        // Special tests / medications: union (each doc may surface different ones for same encounter)
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newTests = (List<Map<String, Object>>) analysis.get("specialTests");
        if (newTests != null && !newTests.isEmpty()) {
            existing.setSpecialTests(unionLists(existing.getSpecialTests(), newTests));
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newMedsAdmin = (List<Map<String, Object>>) analysis.get("medicationsAdministered");
        if (newMedsAdmin != null && !newMedsAdmin.isEmpty()) {
            existing.setMedicationsAdministered(unionLists(existing.getMedicationsAdministered(), newMedsAdmin));
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newMedsRx = (List<Map<String, Object>>) analysis.get("medicationsPrescribed");
        if (newMedsRx != null && !newMedsRx.isEmpty()) {
            existing.setMedicationsPrescribed(unionLists(existing.getMedicationsPrescribed(), newMedsRx));
        }

        existing.setIsComplete(determineCompleteness(existing));
    }

    /**
     * Union two List<Map> using stringified equality for dedup.
     * Used when merging specialTests / medications across multiple documents for the same encounter.
     */
    private List<Map<String, Object>> unionLists(List<Map<String, Object>> a, List<Map<String, Object>> b) {
        java.util.LinkedHashMap<String, Map<String, Object>> seen = new java.util.LinkedHashMap<>();
        if (a != null) for (Map<String, Object> m : a) seen.putIfAbsent(m.toString(), m);
        if (b != null) for (Map<String, Object> m : b) seen.putIfAbsent(m.toString(), m);
        return new ArrayList<>(seen.values());
    }

    // ==========================================
    // Insurance Document Auto-Extraction
    // ==========================================

    /**
     * Attempt to extract insurance information (policy limit, company, adjuster, etc.)
     * from a non-medical document. If found, saves directly to the case entity.
     *
     * @return true if insurance information was extracted and saved
     */
    private boolean tryExtractInsuranceInfo(Long caseId, Long orgId, FileItem file) {
        try {
            String extractedText = extractTextFromFile(file);
            if (extractedText == null || extractedText.trim().isEmpty()) {
                return false;
            }

            String textForAnalysis = extractedText.length() > 15000
                    ? extractedText.substring(0, 15000)
                    : extractedText;

            Map<String, Object> insuranceData = analyzeInsuranceDocumentWithAI(file.getOriginalName(), textForAnalysis);
            if (insuranceData == null || !Boolean.TRUE.equals(insuranceData.get("isInsuranceDocument"))) {
                return false;
            }

            // Load the case with tenant isolation
            Optional<LegalCase> caseOpt = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId);
            if (caseOpt.isEmpty()) {
                log.warn("Case {} not found in org {} for insurance extraction", caseId, orgId);
                return false;
            }

            LegalCase legalCase = caseOpt.get();
            boolean updated = false;

            // Extract policy limit — always overwrite since document is the source of truth
            Object policyLimitObj = insuranceData.get("policyLimit");
            if (policyLimitObj != null) {
                Double policyLimit = parseDoubleValue(policyLimitObj);
                if (policyLimit != null && policyLimit > 0) {
                    legalCase.setInsurancePolicyLimit(policyLimit);
                    updated = true;
                    log.info("Extracted policy limit ${} from file '{}' for case {}",
                            String.format("%,.2f", policyLimit), file.getOriginalName(), caseId);
                }
            }

            // Extract insurance company (only if not already set)
            String company = safeString(insuranceData.get("insuranceCompany"));
            if (company != null && !company.isBlank() &&
                    (legalCase.getInsuranceCompany() == null || legalCase.getInsuranceCompany().isBlank())) {
                legalCase.setInsuranceCompany(company);
                updated = true;
            }

            // Extract policy number (only if not already set)
            String policyNumber = safeString(insuranceData.get("policyNumber"));
            if (policyNumber != null && !policyNumber.isBlank() &&
                    (legalCase.getInsurancePolicyNumber() == null || legalCase.getInsurancePolicyNumber().isBlank())) {
                legalCase.setInsurancePolicyNumber(policyNumber);
                updated = true;
            }

            // NOTE: We intentionally do NOT extract adjuster name/phone/email.
            // These are high hallucination risk — the AI fabricates names that don't exist
            // in the document. Only verifiable data (policy limit, company, policy number)
            // is safe to auto-extract.

            if (updated) {
                legalCaseRepository.save(legalCase);
                log.info("Saved insurance information to case {} from file '{}'", caseId, file.getOriginalName());
            }

            return updated;

        } catch (Exception e) {
            log.error("Error extracting insurance info from file {}: {}", file.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Use AI to determine if a document is an insurance policy/declaration and extract relevant fields.
     */
    private Map<String, Object> analyzeInsuranceDocumentWithAI(String fileName, String documentText) {
        String prompt = String.format("""
            Analyze this document and determine if it is an insurance-related document
            (e.g., insurance declaration page, policy summary, coverage letter, claim correspondence,
            adjuster letter, or any document containing insurance policy information).

            DOCUMENT NAME: %s

            DOCUMENT CONTENT:
            %s

            ---

            Return a JSON response with the following structure:
            {
                "isInsuranceDocument": true/false,
                "documentSubtype": "DECLARATION_PAGE|POLICY_SUMMARY|CLAIM_LETTER|ADJUSTER_CORRESPONDENCE|COVERAGE_VERIFICATION|OTHER",
                "policyLimit": 50000.00,
                "insuranceCompany": "Company name exactly as printed on the document",
                "policyNumber": "Policy number exactly as printed on the document",
                "coverageType": "Type of coverage (e.g., bodily injury, property damage, UM/UIM)"
            }

            CRITICAL RULES:
            - Set isInsuranceDocument to true ONLY if this is genuinely an insurance document
            - For policyLimit, extract the BODILY INJURY per-person limit if multiple limits are shown
            - If the document shows limits like "$50,000/$100,000", the policyLimit should be 50000 (per-person)
            - If a combined single limit (CSL) is shown, use that value
            - Parse dollar amounts as numbers without commas or dollar signs
            - If a field is not found in the document, set it to null — do NOT guess
            - NEVER fabricate or infer names, phone numbers, emails, or any contact information
            - Only extract data that is LITERALLY PRINTED on the document — no inference

            Return ONLY the JSON, no additional text.
            """, fileName, documentText);

        try {
            String response = claudeService.generateCompletionWithModel(prompt, null, false, null, null, "claude-sonnet-4-6").get();
            String jsonContent = extractJsonFromResponse(response);
            return objectMapper.readValue(jsonContent, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Error analyzing insurance document with AI: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Safely parse a numeric value from AI response (could be Integer, Double, String, etc.)
     */
    private Double parseDoubleValue(Object value) {
        if (value == null) return null;
        try {
            if (value instanceof Number) {
                return ((Number) value).doubleValue();
            } else if (value instanceof String) {
                String str = ((String) value).replaceAll("[^\\d.]", "");
                if (!str.isEmpty()) return Double.parseDouble(str);
            }
        } catch (Exception e) {
            log.warn("Could not parse numeric value: {}", value);
        }
        return null;
    }

    /**
     * Safely extract a String from an AI response map value.
     * AI may return non-String types (numbers, nested objects) for fields expected to be strings.
     */
    private String safeString(Object value) {
        if (value == null) return null;
        if (value instanceof String) return (String) value;
        return String.valueOf(value);
    }

    // ==========================================
    // Citation Re-scan Methods
    // ==========================================

    @Override
    public PIMedicalRecordDTO rescanRecordForCitations(Long recordId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Re-scanning record {} for citation metadata", recordId);

        PIMedicalRecord record = repository.findByIdAndOrganizationId(recordId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + recordId));

        // Check if the record has a linked document
        if (record.getDocumentId() == null) {
            log.warn("Record {} has no linked document, cannot extract citations", recordId);
            return mapToDTO(record);
        }

        // Get the file
        FileItem file = fileItemRepository.findByIdAndOrganizationId(record.getDocumentId(), orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Linked document not found with ID: " + record.getDocumentId()));

        // Extract text from PDF
        String extractedText = extractTextFromFile(file);
        if (extractedText == null || extractedText.trim().isEmpty()) {
            log.warn("Could not extract text from file: {}", file.getOriginalName());
            return mapToDTO(record);
        }

        // Limit text length for API
        // 30K char cap — large enough to capture vitals/ROM/special tests across multi-page
        // clinical notes (Tier 2 extraction needs more context than the legacy 15K cap allowed).
        String textForAnalysis = extractedText.length() > 30000
                ? extractedText.substring(0, 30000)
                : extractedText;

        // Use AI to extract citation metadata only
        Map<String, Object> citationMetadata = extractCitationMetadataWithAI(file.getOriginalName(), textForAnalysis, record);

        if (citationMetadata != null && !citationMetadata.isEmpty()) {
            record.setCitationMetadata(citationMetadata);
            repository.save(record);
            log.info("Updated record {} with citation metadata ({} fields)", recordId, citationMetadata.size());
        }

        return mapToDTO(record);
    }

    @Override
    public List<Long> getRecordsWithoutCitations() {
        Long orgId = getRequiredOrganizationId();
        return repository.findRecordIdsWithoutCitationMetadata(orgId);
    }

    /**
     * Extract citation metadata from document text for an existing record.
     * This is a targeted extraction that focuses only on finding the source locations
     * for data that has already been extracted.
     */
    private Map<String, Object> extractCitationMetadataWithAI(String fileName, String documentText, PIMedicalRecord record) {
        String prompt = String.format("""
            I need to find the exact source locations in this medical document for the following extracted data.
            For each piece of data, provide the page number, the exact text excerpt (20-80 characters), and character offset.

            DOCUMENT NAME: %s

            PREVIOUSLY EXTRACTED DATA:
            - Provider Name: %s
            - Record Type: %s
            - Treatment Date: %s
            - Key Findings: %s
            - Treatment Provided: %s

            DOCUMENT CONTENT:
            %s

            ---

            Find where each of these values appears in the document and return a JSON object with citation metadata:
            {
                "treatmentDate": {"page": 1, "excerpt": "exact text containing the date", "charOffset": 150},
                "providerName": {"page": 1, "excerpt": "exact text containing provider name", "charOffset": 50},
                "recordType": {"page": 1, "excerpt": "exact text indicating record type", "charOffset": 200},
                "keyFindings": {"page": 2, "excerpt": "exact text from clinical findings section", "charOffset": 1500},
                "treatmentProvided": {"page": 2, "excerpt": "exact text describing treatment", "charOffset": 1800}
            }

            Important:
            - The excerpt should be the EXACT text from the document (not paraphrased)
            - Page numbers should be 1-indexed
            - Only include fields that you can definitively locate in the document
            - If a field cannot be found, omit it from the response

            Return ONLY the JSON, no additional text.
            """,
                fileName,
                record.getProviderName() != null ? record.getProviderName() : "N/A",
                record.getRecordType() != null ? record.getRecordType() : "N/A",
                record.getTreatmentDate() != null ? record.getTreatmentDate().toString() : "N/A",
                record.getKeyFindings() != null ? truncateText(record.getKeyFindings(), 100) : "N/A",
                record.getTreatmentProvided() != null ? truncateText(record.getTreatmentProvided(), 100) : "N/A",
                documentText);

        try {
            String response = claudeService.generateCompletionWithModel(prompt, null, false, null, null, "claude-sonnet-4-6").get();

            // Parse JSON response
            String jsonContent = extractJsonFromResponse(response);
            return objectMapper.readValue(jsonContent, new TypeReference<Map<String, Object>>() {});

        } catch (Exception e) {
            log.error("Error extracting citation metadata with AI: {}", e.getMessage());
            return null;
        }
    }

    private String truncateText(String text, int maxLength) {
        if (text == null) return "";
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
