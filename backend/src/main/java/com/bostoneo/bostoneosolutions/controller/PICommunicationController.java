package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PICommunicationDTO;
import com.bostoneo.bostoneosolutions.dto.PICommunicationHealthDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PICommunicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

/**
 * P9e — REST controller for PI Communications Log.
 *
 * URL pattern mirrors PISettlementEventController (/api/pi/settlement) →
 * /api/pi/communications. All endpoints require auth and inherit org-scope
 * filtering through the service layer.
 */
@RestController
@RequestMapping("/api/pi/communications")
@RequiredArgsConstructor
@Slf4j
public class PICommunicationController {

    private final PICommunicationService communicationService;

    @GetMapping("/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getByCaseId(@PathVariable("caseId") Long caseId) {
        log.info("Getting communications for case: {}", caseId);
        List<PICommunicationDTO> entries = communicationService.getByCaseId(caseId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("communications", entries))
                        .message("Communications retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> create(
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody PICommunicationDTO dto) {
        log.info("Creating communication for case: {}", caseId);
        PICommunicationDTO created = communicationService.create(caseId, dto);
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("communication", created))
                        .message("Communication logged successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> update(
            @PathVariable("id") Long id,
            @Valid @RequestBody PICommunicationDTO dto) {
        log.info("Updating communication: {}", id);
        PICommunicationDTO updated = communicationService.update(id, dto);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("communication", updated))
                        .message("Communication updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> delete(@PathVariable("id") Long id) {
        log.info("Deleting communication: {}", id);
        communicationService.delete(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Communication deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * P5 — Communication Health summary for the Activity-tab 3-card band.
     * Derived from the case's tenant-filtered communication timeline; no
     * caching, cheap to compute on every Activity-tab open since cases
     * carry at most a few hundred comm rows.
     */
    @GetMapping("/{caseId}/health")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getCommunicationHealth(@PathVariable("caseId") Long caseId) {
        log.info("Computing communication health for case: {}", caseId);
        PICommunicationHealthDTO health = communicationService.getCommunicationHealth(caseId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("health", health))
                        .message("Communication health retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
