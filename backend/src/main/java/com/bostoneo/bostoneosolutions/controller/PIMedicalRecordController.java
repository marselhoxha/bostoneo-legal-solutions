package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PIMedicalRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

/**
 * REST Controller for PI Medical Records
 */
@RestController
@RequestMapping("/api/pi/cases/{caseId}/medical-records")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class PIMedicalRecordController {

    private final PIMedicalRecordService medicalRecordService;

    /**
     * Get all medical records for a case
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getRecords(
            @PathVariable("caseId") Long caseId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size) {

        log.info("Getting medical records for case: {}", caseId);

        if (page > 0 || size < 50) {
            Page<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByCaseId(caseId, PageRequest.of(page, size));
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of(
                                    "records", records.getContent(),
                                    "totalElements", records.getTotalElements(),
                                    "totalPages", records.getTotalPages(),
                                    "currentPage", records.getNumber()
                            ))
                            .message("Medical records retrieved successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        }

        List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByCaseId(caseId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("records", records))
                        .message("Medical records retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get a specific medical record
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getRecordById(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Getting medical record {} for case: {}", id, caseId);

        PIMedicalRecordDTO record = medicalRecordService.getRecordById(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("record", record))
                        .message("Medical record retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Create a new medical record
     */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createRecord(
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody PIMedicalRecordDTO recordDTO) {

        log.info("Creating medical record for case: {}", caseId);

        PIMedicalRecordDTO created = medicalRecordService.createRecord(caseId, recordDTO);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("record", created))
                        .message("Medical record created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Update an existing medical record
     */
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> updateRecord(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id,
            @Valid @RequestBody PIMedicalRecordDTO recordDTO) {

        log.info("Updating medical record {} for case: {}", id, caseId);

        PIMedicalRecordDTO updated = medicalRecordService.updateRecord(id, recordDTO);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("record", updated))
                        .message("Medical record updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Delete a medical record
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteRecord(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Deleting medical record {} for case: {}", id, caseId);

        medicalRecordService.deleteRecord(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Medical record deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get records by provider name
     */
    @GetMapping("/by-provider")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getRecordsByProvider(
            @PathVariable("caseId") Long caseId,
            @RequestParam("providerName") String providerName) {

        log.info("Getting records for provider: {} in case: {}", providerName, caseId);

        List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByProvider(caseId, providerName);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("records", records))
                        .message("Records retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get records by date range
     */
    @GetMapping("/by-date-range")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getRecordsByDateRange(
            @PathVariable("caseId") Long caseId,
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("Getting records between {} and {} for case: {}", startDate, endDate, caseId);

        List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByDateRange(caseId, startDate, endDate);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("records", records))
                        .message("Records retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get provider summary for a case
     */
    @GetMapping("/provider-summary")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getProviderSummary(@PathVariable("caseId") Long caseId) {

        log.info("Getting provider summary for case: {}", caseId);

        List<Map<String, Object>> summary = medicalRecordService.getProviderSummary(caseId);
        List<String> providerNames = medicalRecordService.getProviderNames(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "summary", summary,
                                "providerNames", providerNames,
                                "totalBilled", medicalRecordService.getTotalBilledAmount(caseId),
                                "dateRange", medicalRecordService.getTreatmentDateRange(caseId)
                        ))
                        .message("Provider summary retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Extract diagnoses from text using AI
     */
    @PostMapping("/extract-diagnoses")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> extractDiagnoses(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, String> request) {

        log.info("Extracting diagnoses from text for case: {}", caseId);

        String medicalText = request.get("text");
        List<Map<String, Object>> diagnoses = medicalRecordService.extractDiagnosesFromText(medicalText);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("diagnoses", diagnoses))
                        .message("Diagnoses extracted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Analyze a record with AI
     */
    @PostMapping("/{id}/analyze")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> analyzeRecord(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Analyzing medical record {} with AI for case: {}", id, caseId);

        Map<String, Object> analysis = medicalRecordService.analyzeRecordWithAI(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("analysis", analysis))
                        .message("Record analyzed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Scan all case documents and auto-populate medical records
     * This analyzes PDFs attached to the case and creates medical records from them
     */
    @PostMapping("/scan-documents")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> scanCaseDocuments(@PathVariable("caseId") Long caseId) {

        log.info("Scanning documents for case: {}", caseId);

        Map<String, Object> scanResult = medicalRecordService.scanCaseDocuments(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(scanResult)
                        .message(String.format("Scanned %d documents, created %d records",
                                scanResult.get("documentsScanned"),
                                scanResult.get("recordsCreated")))
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Analyze a specific file and create a medical record from it
     */
    @PostMapping("/analyze-file/{fileId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> analyzeFileAndCreateRecord(
            @PathVariable("caseId") Long caseId,
            @PathVariable("fileId") Long fileId) {

        log.info("Analyzing file {} for case: {}", fileId, caseId);

        var record = medicalRecordService.analyzeFileAndCreateRecord(caseId, fileId);

        if (record != null) {
            return ResponseEntity.status(CREATED)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("record", record))
                            .message("Medical record created from document")
                            .status(CREATED)
                            .statusCode(CREATED.value())
                            .build());
        } else {
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Document is not a medical record or could not be processed")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        }
    }
}
