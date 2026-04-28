package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PIMedicalRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.OK;

/**
 * Dev/staging-only controller exposing the /reprocess endpoint.
 *
 * <p>Reprocess re-runs persistence + merge logic against the cached AI extractions
 * stored on {@code pi_scanned_documents.raw_extraction} — no Bedrock calls, no token
 * cost. Used during prompt/extraction-logic iteration to validate Java-side changes
 * (createRecordFromAnalysis, mergeAnalysisIntoRecord, mapDocumentTypeToRecordType,
 * etc.) without re-billing AI for every test.
 *
 * <p><b>Why a separate controller class instead of a method-level guard:</b>
 * Spring's {@code @Profile} is a bean-creation gate. Annotating the entire controller
 * means the bean is never instantiated in production — the request mapping table
 * doesn't even know the URL exists, so prod returns a clean 404 from Spring's router
 * rather than a permission-denied error from inside our code. That's both more secure
 * (no exposure surface) and cleaner than method-level checks.
 *
 * <p>The cache column itself ({@code raw_extraction}) ships everywhere; this endpoint
 * is the only thing scoped to dev+staging. Production scans still populate the cache
 * for audit/debug; only the consumption path is gated.
 */
@RestController
@RequestMapping("/api/pi/cases/{caseId}/medical-records")
@RequiredArgsConstructor
@Slf4j
@Profile({"dev", "staging"})
public class PIReprocessController {

    private final PIMedicalRecordService medicalRecordService;

    /**
     * Re-run persistence/merge logic against cached AI extractions.
     *
     * <p>Effects:
     * <ul>
     *   <li>Deletes existing PIMedicalRecord rows + summary for the case</li>
     *   <li>Replays each cached extraction (in original scan order) through
     *       createRecordFromAnalysis / mergeAnalysisIntoRecord</li>
     *   <li>Preserves the {@code pi_scanned_documents} table — only medical-records
     *       state is rebuilt</li>
     * </ul>
     *
     * <p>Returns 404 in production (controller bean doesn't exist there).
     */
    @PostMapping("/reprocess")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> reprocessFromCache(@PathVariable("caseId") Long caseId) {
        log.info("Reprocess requested for case {} (re-running persistence/merge from cached AI extractions)", caseId);

        Map<String, Object> result = medicalRecordService.reprocessCaseDocuments(caseId);

        boolean success = Boolean.TRUE.equals(result.get("success"));
        String message = success
                ? String.format("Reprocessed %s cached extractions into %s records (no AI calls).",
                        result.getOrDefault("replayedDocuments", 0),
                        result.getOrDefault("recordsCreated", 0))
                : String.valueOf(result.getOrDefault("message", "Reprocess failed."));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(result)
                        .message(message)
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
