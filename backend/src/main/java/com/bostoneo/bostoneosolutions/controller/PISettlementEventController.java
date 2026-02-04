package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PISettlementEventDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PISettlementEventService;
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
 * REST Controller for PI Settlement Events
 */
@RestController
@RequestMapping("/api/pi/settlement")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class PISettlementEventController {

    private final PISettlementEventService settlementService;

    /**
     * Get all settlement events for a case
     */
    @GetMapping("/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getEventsByCaseId(@PathVariable("caseId") Long caseId) {

        log.info("Getting settlement events for case: {}", caseId);

        List<PISettlementEventDTO> events = settlementService.getEventsByCaseId(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("events", events))
                        .message("Settlement events retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Create a new settlement event
     */
    @PostMapping("/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createEvent(
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody PISettlementEventDTO eventDTO) {

        log.info("Creating settlement event for case: {}", caseId);

        PISettlementEventDTO created = settlementService.createEvent(caseId, eventDTO);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("event", created))
                        .message("Settlement event created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Delete a settlement event
     */
    @DeleteMapping("/{eventId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteEvent(@PathVariable("eventId") Long eventId) {

        log.info("Deleting settlement event: {}", eventId);

        settlementService.deleteEvent(eventId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Settlement event deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Delete all settlement events for a case
     */
    @DeleteMapping("/case/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteAllByCaseId(@PathVariable("caseId") Long caseId) {

        log.info("Deleting all settlement events for case: {}", caseId);

        settlementService.deleteAllByCaseId(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("All settlement events deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
