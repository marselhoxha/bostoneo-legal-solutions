package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PIDocumentChecklistDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PIDocumentChecklistService;
import jakarta.validation.Valid;
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
 * REST Controller for PI Document Checklist
 */
@RestController
@RequestMapping("/api/pi/cases/{caseId}/document-checklist")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class PIDocumentChecklistController {

    private final PIDocumentChecklistService checklistService;

    /**
     * Get document checklist for a case
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getChecklist(@PathVariable("caseId") Long caseId) {

        log.info("Getting document checklist for case: {}", caseId);

        List<PIDocumentChecklistDTO> checklist = checklistService.getChecklistByCaseId(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("checklist", checklist))
                        .message("Checklist retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get a specific checklist item
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getChecklistItemById(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Getting checklist item {} for case: {}", id, caseId);

        PIDocumentChecklistDTO item = checklistService.getChecklistItemById(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", item))
                        .message("Checklist item retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Create a new checklist item
     */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createChecklistItem(
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody PIDocumentChecklistDTO itemDTO) {

        log.info("Creating checklist item for case: {}", caseId);

        PIDocumentChecklistDTO created = checklistService.createChecklistItem(caseId, itemDTO);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", created))
                        .message("Checklist item created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Update a checklist item
     */
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> updateChecklistItem(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id,
            @Valid @RequestBody PIDocumentChecklistDTO itemDTO) {

        log.info("Updating checklist item {} for case: {}", id, caseId);

        PIDocumentChecklistDTO updated = checklistService.updateChecklistItem(id, itemDTO);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", updated))
                        .message("Checklist item updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Delete a checklist item
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteChecklistItem(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Deleting checklist item {} for case: {}", id, caseId);

        checklistService.deleteChecklistItem(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Checklist item deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Initialize default checklist for a case
     */
    @PostMapping("/initialize")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> initializeChecklist(@PathVariable("caseId") Long caseId) {

        log.info("Initializing default checklist for case: {}", caseId);

        List<PIDocumentChecklistDTO> checklist = checklistService.initializeDefaultChecklist(caseId);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("checklist", checklist))
                        .message("Checklist initialized successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Get missing documents for a case
     */
    @GetMapping("/missing")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getMissingDocuments(@PathVariable("caseId") Long caseId) {

        log.info("Getting missing documents for case: {}", caseId);

        List<PIDocumentChecklistDTO> missing = checklistService.getMissingDocuments(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("missing", missing))
                        .message("Missing documents retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get overdue follow-ups
     */
    @GetMapping("/overdue")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getOverdueFollowUps(@PathVariable("caseId") Long caseId) {

        log.info("Getting overdue follow-ups for case: {}", caseId);

        List<PIDocumentChecklistDTO> overdue = checklistService.getOverdueFollowUps(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("overdue", overdue))
                        .message("Overdue follow-ups retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get completeness score
     */
    @GetMapping("/completeness")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getCompletenessScore(@PathVariable("caseId") Long caseId) {

        log.info("Getting completeness score for case: {}", caseId);

        Map<String, Object> completeness = checklistService.getCompletenessScore(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("completeness", completeness))
                        .message("Completeness score retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Mark document as received
     */
    @PostMapping("/{id}/receive")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> markAsReceived(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id,
            @RequestBody(required = false) Map<String, Long> request) {

        log.info("Marking checklist item {} as received for case: {}", id, caseId);

        Long documentId = request != null ? request.get("documentId") : null;
        PIDocumentChecklistDTO updated = checklistService.markAsReceived(id, documentId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", updated))
                        .message("Document marked as received")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Request a document
     */
    @PostMapping("/{id}/request")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> requestDocument(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> request) {

        log.info("Requesting document for checklist item {} in case: {}", id, caseId);

        String requestSentTo = request.get("requestSentTo");
        PIDocumentChecklistDTO updated = checklistService.requestDocument(id, requestSentTo);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", updated))
                        .message("Document request logged")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Log a follow-up
     */
    @PostMapping("/{id}/follow-up")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> logFollowUp(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Logging follow-up for checklist item {} in case: {}", id, caseId);

        PIDocumentChecklistDTO updated = checklistService.logFollowUp(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", updated))
                        .message("Follow-up logged")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
