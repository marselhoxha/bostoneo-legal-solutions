package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.PIMedicalRecord;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalRecordRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalSummaryRepository;
import com.bostoneo.bostoneosolutions.service.PIMedicalRecordService;
import com.bostoneo.bostoneosolutions.service.PIDocumentChecklistService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
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
    private final FileItemRepository fileItemRepository;
    private final PIDocumentChecklistService documentChecklistService;
    private final TenantService tenantService;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    @Value("${app.uploads.path:uploads}")
    private String uploadsPath;

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
        repository.delete(record);

        // Mark summary as stale
        summaryRepository.markAsStale(caseId, orgId);

        log.info("Medical record deleted successfully");
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
                .recordType(entity.getRecordType())
                .treatmentDate(entity.getTreatmentDate())
                .treatmentEndDate(entity.getTreatmentEndDate())
                .diagnoses(entity.getDiagnoses())
                .procedures(entity.getProcedures())
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

    @Override
    public Map<String, Object> scanCaseDocuments(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Scanning documents for case: {} in org: {}", caseId, orgId);

        Map<String, Object> result = new HashMap<>();
        List<PIMedicalRecordDTO> createdRecords = new ArrayList<>();
        List<Map<String, Object>> scannedFiles = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        // Get all PDF files for this case
        List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);
        List<FileItem> pdfFiles = files.stream()
                .filter(f -> "application/pdf".equals(f.getMimeType()))
                .collect(Collectors.toList());

        log.info("Found {} PDF files to scan for case {}", pdfFiles.size(), caseId);

        for (FileItem file : pdfFiles) {
            try {
                Map<String, Object> fileResult = new HashMap<>();
                fileResult.put("fileId", file.getId());
                fileResult.put("fileName", file.getOriginalName());

                // Check if this document was already processed
                boolean alreadyProcessed = repository.existsByDocumentIdAndOrganizationId(file.getId(), orgId);
                if (alreadyProcessed) {
                    fileResult.put("status", "skipped");
                    fileResult.put("reason", "Already processed");
                    scannedFiles.add(fileResult);
                    continue;
                }

                // Analyze the file and create record
                PIMedicalRecordDTO record = analyzeFileAndCreateRecord(caseId, file.getId());
                if (record != null) {
                    createdRecords.add(record);
                    fileResult.put("status", "success");
                    fileResult.put("recordId", record.getId());
                    fileResult.put("provider", record.getProviderName());
                    fileResult.put("recordType", record.getRecordType());
                } else {
                    fileResult.put("status", "skipped");
                    fileResult.put("reason", "Not identified as medical document");
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
            }
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
        result.put("documentsScanned", pdfFiles.size());
        result.put("recordsCreated", createdRecords.size());
        result.put("records", createdRecords);
        result.put("files", scannedFiles);
        result.put("errors", errors);

        log.info("Document scan complete for case {}: {} records created from {} documents",
                caseId, createdRecords.size(), pdfFiles.size());

        return result;
    }

    @Override
    public PIMedicalRecordDTO analyzeFileAndCreateRecord(Long caseId, Long fileId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Analyzing file {} for case {} in org {}", fileId, caseId, orgId);

        // Get the file
        FileItem file = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found with ID: " + fileId));

        // Extract text from PDF
        String extractedText = extractTextFromFile(file);
        if (extractedText == null || extractedText.trim().isEmpty()) {
            log.warn("Could not extract text from file: {}", file.getOriginalName());
            return null;
        }

        // Limit text length for API
        String textForAnalysis = extractedText.length() > 15000
                ? extractedText.substring(0, 15000)
                : extractedText;

        // Use AI to analyze the document
        Map<String, Object> analysisResult = analyzeDocumentWithAI(file.getOriginalName(), textForAnalysis);

        if (analysisResult == null || !Boolean.TRUE.equals(analysisResult.get("isMedicalDocument"))) {
            log.info("File {} is not identified as a medical document", file.getOriginalName());
            return null;
        }

        // Create medical record from analysis
        PIMedicalRecord record = createRecordFromAnalysis(caseId, orgId, fileId, analysisResult);
        PIMedicalRecord saved = repository.save(record);

        log.info("Created medical record {} from file {}", saved.getId(), file.getOriginalName());
        return mapToDTO(saved);
    }

    private String extractTextFromFile(FileItem file) {
        try {
            Path filePath = Paths.get(uploadsPath, file.getFilePath());
            if (!Files.exists(filePath)) {
                // Try alternate path
                filePath = Paths.get(file.getFilePath());
            }
            if (!Files.exists(filePath)) {
                log.error("File not found at path: {}", file.getFilePath());
                return null;
            }

            try (InputStream stream = Files.newInputStream(filePath)) {
                BodyContentHandler handler = new BodyContentHandler(-1); // No limit
                Metadata metadata = new Metadata();
                AutoDetectParser parser = new AutoDetectParser();
                ParseContext context = new ParseContext();

                parser.parse(stream, handler, metadata, context);
                return handler.toString();
            }
        } catch (Exception e) {
            log.error("Error extracting text from file {}: {}", file.getId(), e.getMessage());
            return null;
        }
    }

    private Map<String, Object> analyzeDocumentWithAI(String fileName, String documentText) {
        String prompt = String.format("""
            Analyze this medical document and extract structured information WITH CITATION METADATA.

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
                "documentType": "ER|PT|IMAGING|CHIROPRACTIC|SURGERY|CONSULTATION|LAB|PRIMARY_CARE|OTHER",
                "providerName": "Name of the medical provider/facility",
                "providerType": "HOSPITAL|PHYSICAL_THERAPY|CHIROPRACTIC|RADIOLOGY|ORTHOPEDICS|NEUROLOGY|PRIMARY_CARE|OTHER",
                "treatmentDate": "YYYY-MM-DD format if found",
                "treatmentEndDate": "YYYY-MM-DD format if found (for PT, chiro, etc.)",
                "diagnoses": [
                    {"icd_code": "M54.5", "description": "Low back pain", "primary": true}
                ],
                "billedAmount": 0.00,
                "keyFindings": "Brief summary of key clinical findings",
                "treatmentProvided": "Summary of treatment/procedures performed",
                "prognosisNotes": "Any prognosis or outcome information",
                "workRestrictions": "Any work restrictions mentioned",
                "citationMetadata": {
                    "treatmentDate": {"page": 1, "excerpt": "Date of Service: 01/15/2024", "charOffset": 150},
                    "providerName": {"page": 1, "excerpt": "Boston Medical Center", "charOffset": 50},
                    "recordType": {"page": 1, "excerpt": "Emergency Department Visit", "charOffset": 200},
                    "keyFindings": {"page": 2, "excerpt": "Patient presents with acute low back pain...", "charOffset": 1500},
                    "diagnoses": [
                        {"icd_code": "M54.5", "page": 3, "excerpt": "Diagnosis: Lumbar strain (M54.5)", "charOffset": 2800}
                    ],
                    "procedures": [
                        {"cpt_code": "99283", "page": 3, "excerpt": "ED Visit Level III (99283)", "charOffset": 3200}
                    ],
                    "billedAmount": {"page": 4, "excerpt": "Total Charges: $2,450.00", "charOffset": 4100},
                    "treatmentProvided": {"page": 2, "excerpt": "Treatment: NSAIDs, muscle relaxants prescribed", "charOffset": 1800}
                }
            }

            Important:
            - If this is NOT a medical document (e.g., insurance form, legal document), set isMedicalDocument to false
            - Extract the most accurate provider name from the letterhead or document header
            - Include all diagnoses with ICD codes if available
            - Extract billing amounts if shown
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
            """, fileName, documentText);

        try {
            String response = claudeService.generateCompletion(prompt, false).get();

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

        // Dates
        String dateStr = (String) analysis.get("treatmentDate");
        if (dateStr != null && !dateStr.isEmpty()) {
            try {
                record.setTreatmentDate(LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE));
            } catch (Exception e) {
                record.setTreatmentDate(LocalDate.now()); // Fallback
            }
        } else {
            record.setTreatmentDate(LocalDate.now()); // Fallback
        }

        String endDateStr = (String) analysis.get("treatmentEndDate");
        if (endDateStr != null && !endDateStr.isEmpty()) {
            try {
                record.setTreatmentEndDate(LocalDate.parse(endDateStr, DateTimeFormatter.ISO_LOCAL_DATE));
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

        // Billing
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

        // Clinical notes
        record.setKeyFindings((String) analysis.get("keyFindings"));
        record.setTreatmentProvided((String) analysis.get("treatmentProvided"));
        record.setPrognosisNotes((String) analysis.get("prognosisNotes"));
        record.setWorkRestrictions((String) analysis.get("workRestrictions"));

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
            default -> "FOLLOW_UP";
        };
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
        String textForAnalysis = extractedText.length() > 15000
                ? extractedText.substring(0, 15000)
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
            String response = claudeService.generateCompletion(prompt, false).get();

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
