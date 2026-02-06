package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PIMedicalSummaryDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PIMedicalSummaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

/**
 * REST Controller for PI Medical Summary
 */
@RestController
@RequestMapping("/api/pi/cases/{caseId}/medical-summary")
@RequiredArgsConstructor
@Slf4j
public class PIMedicalSummaryController {

    private final PIMedicalSummaryService summaryService;

    /**
     * Get the medical summary for a case
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getMedicalSummary(@PathVariable("caseId") Long caseId) {

        log.info("Getting medical summary for case: {}", caseId);

        PIMedicalSummaryDTO summary = summaryService.getMedicalSummary(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "summary", summary,
                                "exists", summary != null
                        ))
                        .message("Medical summary retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Generate a new medical summary using AI
     */
    @PostMapping("/generate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> generateMedicalSummary(@PathVariable("caseId") Long caseId) {

        log.info("Generating medical summary for case: {}", caseId);

        PIMedicalSummaryDTO summary = summaryService.generateMedicalSummary(caseId);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("summary", summary))
                        .message("Medical summary generated successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Check if summary is current
     */
    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getSummaryStatus(@PathVariable("caseId") Long caseId) {

        log.info("Checking summary status for case: {}", caseId);

        boolean isCurrent = summaryService.isSummaryCurrent(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "isCurrent", isCurrent,
                                "needsRefresh", !isCurrent
                        ))
                        .message("Summary status retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get treatment chronology
     */
    @GetMapping("/chronology")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getTreatmentChronology(@PathVariable("caseId") Long caseId) {

        log.info("Getting treatment chronology for case: {}", caseId);

        String chronology = summaryService.getTreatmentChronology(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("chronology", chronology))
                        .message("Chronology retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get provider summary
     */
    @GetMapping("/providers")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getProviderSummary(@PathVariable("caseId") Long caseId) {

        log.info("Getting provider summary for case: {}", caseId);

        List<Map<String, Object>> providers = summaryService.getProviderSummary(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("providers", providers))
                        .message("Provider summary retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get diagnosis list
     */
    @GetMapping("/diagnoses")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getDiagnosisList(@PathVariable("caseId") Long caseId) {

        log.info("Getting diagnosis list for case: {}", caseId);

        List<Map<String, Object>> diagnoses = summaryService.getDiagnosisList(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("diagnoses", diagnoses))
                        .message("Diagnosis list retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get red flags
     */
    @GetMapping("/red-flags")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getRedFlags(@PathVariable("caseId") Long caseId) {

        log.info("Getting red flags for case: {}", caseId);

        List<Map<String, Object>> redFlags = summaryService.getRedFlags(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("redFlags", redFlags))
                        .message("Red flags retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get missing records
     */
    @GetMapping("/missing-records")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getMissingRecords(@PathVariable("caseId") Long caseId) {

        log.info("Getting missing records for case: {}", caseId);

        List<Map<String, Object>> missingRecords = summaryService.getMissingRecords(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("missingRecords", missingRecords))
                        .message("Missing records retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get prognosis assessment
     */
    @GetMapping("/prognosis")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getPrognosisAssessment(@PathVariable("caseId") Long caseId) {

        log.info("Getting prognosis assessment for case: {}", caseId);

        String prognosis = summaryService.getPrognosisAssessment(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("prognosis", prognosis))
                        .message("Prognosis assessment retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get completeness metrics
     */
    @GetMapping("/completeness")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getCompletenessMetrics(@PathVariable("caseId") Long caseId) {

        log.info("Getting completeness metrics for case: {}", caseId);

        Map<String, Object> metrics = summaryService.getCompletenessMetrics(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("metrics", metrics))
                        .message("Completeness metrics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Analyze treatment gaps
     */
    @GetMapping("/treatment-gaps")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> analyzeTreatmentGaps(@PathVariable("caseId") Long caseId) {

        log.info("Analyzing treatment gaps for case: {}", caseId);

        List<Map<String, Object>> gaps = summaryService.analyzeTreatmentGaps(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("gaps", gaps))
                        .message("Treatment gaps analyzed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Delete medical summary
     */
    @DeleteMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteMedicalSummary(@PathVariable("caseId") Long caseId) {

        log.info("Deleting medical summary for case: {}", caseId);

        summaryService.deleteMedicalSummary(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Medical summary deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
