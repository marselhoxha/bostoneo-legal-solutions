package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import com.bostoneo.bostoneosolutions.handler.AuthenticatedWebSocketHandler;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.PIMedicalRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

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
public class PIMedicalRecordController {

    private final PIMedicalRecordService medicalRecordService;
    private final AuthenticatedWebSocketHandler webSocketHandler;

    // Prevent concurrent scans of the same case (double-click, multiple users)
    private static final Set<Long> activeScanCases = ConcurrentHashMap.newKeySet();

    /**
     * Get all medical records for a case
     */
    @AuditLog(action = "VIEW", entityType = "MEDICAL_RECORD", description = "Viewed medical records for case")
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
    @AuditLog(action = "VIEW", entityType = "MEDICAL_RECORD", description = "Viewed medical record", includeParams = true)
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
    @AuditLog(action = "CREATE", entityType = "MEDICAL_RECORD", description = "Created medical record", includeParams = true)
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
    @AuditLog(action = "UPDATE", entityType = "MEDICAL_RECORD", description = "Updated medical record", includeParams = true)
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
    @AuditLog(action = "DELETE", entityType = "MEDICAL_RECORD", description = "Deleted medical record", includeParams = true)
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
     * Delete ALL medical records for a case — allows a fresh re-scan
     */
    @AuditLog(action = "DELETE", entityType = "MEDICAL_RECORD", description = "Deleted all medical records for case", includeParams = true)
    @DeleteMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteAllRecords(
            @PathVariable("caseId") Long caseId) {

        log.info("Deleting all medical records for case: {}", caseId);

        medicalRecordService.deleteAllRecordsByCase(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("All medical records deleted. You can now re-scan documents.")
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
    @AuditLog(action = "VIEW", entityType = "MEDICAL_RECORD", description = "AI analysis performed on medical record", includeParams = true)
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
     * Check how many case documents have not been scanned yet.
     * Frontend uses this to show "X new documents found" banner.
     */
    @GetMapping("/scan-status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getScanStatus(@PathVariable("caseId") Long caseId) {
        Map<String, Object> status = medicalRecordService.getScanStatus(caseId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("scanStatus", status))
                        .message("Scan status retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Scan all case documents and auto-populate medical records.
     * Returns immediately (HTTP 202) and processes in background via async thread.
     * Sends WebSocket notification when scan completes.
     * OCR on scanned PDFs takes ~25s/file — synchronous would timeout on the ALB.
     */
    @PostMapping("/scan-documents")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> scanCaseDocuments(@PathVariable("caseId") Long caseId) {

        log.info("Scanning documents for case: {}", caseId);

        // Prevent concurrent scans of the same case
        if (!activeScanCases.add(caseId)) {
            return ResponseEntity.status(CONFLICT).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("A scan is already in progress for this case. Please wait for it to complete.")
                            .status(CONFLICT)
                            .statusCode(CONFLICT.value())
                            .build());
        }

        // Capture context for the async thread
        Long orgId = TenantContext.getCurrentTenant();
        SecurityContext securityContext = SecurityContextHolder.getContext();
        String userId = extractUserId(securityContext);

        if (userId == null) {
            activeScanCases.remove(caseId);
            log.warn("Could not extract user ID — WebSocket notifications will not be sent");
        }

        CompletableFuture.runAsync(() -> {
            try {
                // Restore tenant + security context in async thread
                TenantContext.setCurrentTenant(orgId);
                SecurityContextHolder.setContext(securityContext);

                // Progress callback: send via "data" channel (bypasses notification bell)
                java.util.function.Consumer<Map<String, Object>> onProgress = progress -> {
                    if (userId != null) {
                        webSocketHandler.sendDataToUser(userId, progress);
                    }
                };

                Map<String, Object> scanResult = medicalRecordService.scanCaseDocuments(caseId, onProgress);

                // Send completion via data channel (NOT notification bell).
                // The frontend BackgroundTaskService handles the toast notification.
                if (userId != null) {
                    int recordsCreated = scanResult.get("recordsCreated") != null
                            ? (int) scanResult.get("recordsCreated") : 0;
                    int documentsScanned = scanResult.get("documentsScanned") != null
                            ? (int) scanResult.get("documentsScanned") : 0;
                    Map<String, Object> wsPayload = new HashMap<>();
                    wsPayload.put("type", "MEDICAL_SCAN_COMPLETE");
                    wsPayload.put("caseId", caseId);
                    wsPayload.put("success", true);
                    wsPayload.put("recordsCreated", recordsCreated);
                    wsPayload.put("documentsScanned", documentsScanned);
                    webSocketHandler.sendDataToUser(userId, wsPayload);
                }

                log.info("Async scan complete for case {}: {} records created",
                        caseId, scanResult.get("recordsCreated"));
            } catch (Exception e) {
                log.error("Async scan failed for case {}: {}", caseId, e.getMessage(), e);
                if (userId != null) {
                    Map<String, Object> errorPayload = new HashMap<>();
                    errorPayload.put("type", "MEDICAL_SCAN_COMPLETE");
                    errorPayload.put("caseId", caseId);
                    errorPayload.put("success", false);
                    errorPayload.put("message", "Failed to scan documents: " + e.getMessage());
                    webSocketHandler.sendDataToUser(userId, errorPayload);
                }
            } finally {
                activeScanCases.remove(caseId);
                TenantContext.clear();
                SecurityContextHolder.clearContext();
            }
        });

        return ResponseEntity.accepted().body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("status", "scanning"))
                        .message("Document scan started. You will be notified when it completes.")
                        .status(ACCEPTED)
                        .statusCode(ACCEPTED.value())
                        .build());
    }

    private String extractUserId(SecurityContext securityContext) {
        try {
            var auth = securityContext.getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof com.bostoneo.bostoneosolutions.dto.UserDTO userDTO) {
                return String.valueOf(userDTO.getId());
            }
        } catch (Exception e) {
            log.warn("Could not extract user ID from security context: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Analyze a specific file and create a medical record from it
     */
    @AuditLog(action = "CREATE", entityType = "MEDICAL_RECORD", description = "Medical record created from AI file analysis", includeParams = true)
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
