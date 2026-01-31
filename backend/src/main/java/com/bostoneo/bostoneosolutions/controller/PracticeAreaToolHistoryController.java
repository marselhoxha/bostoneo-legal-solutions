package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.CreateToolHistoryRequest;
import com.bostoneo.bostoneosolutions.dto.PracticeAreaToolHistoryDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PracticeAreaToolHistoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

/**
 * REST Controller for Practice Area Tool History
 * Provides CRUD operations for tool history entries
 */
@RestController
@RequestMapping("/api/practice-areas/{practiceArea}/history")
@RequiredArgsConstructor
@Slf4j
public class PracticeAreaToolHistoryController {

    private final PracticeAreaToolHistoryService historyService;

    /**
     * Get all history items for a practice area
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getHistory(
            @PathVariable("practiceArea") String practiceArea,
            @RequestParam(value = "toolType", required = false) String toolType,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size) {

        log.info("Getting history for practice area: {}, toolType: {}", practiceArea, toolType);

        List<PracticeAreaToolHistoryDTO> history;

        if (toolType != null && !toolType.isEmpty()) {
            history = historyService.getHistoryByToolType(practiceArea, toolType);
        } else {
            history = historyService.getHistoryByPracticeArea(practiceArea);
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("history", history))
                        .message("History retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get paginated history items for a practice area
     */
    @GetMapping("/paginated")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getHistoryPaginated(
            @PathVariable("practiceArea") String practiceArea,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {

        log.info("Getting paginated history for practice area: {}, page: {}, size: {}", practiceArea, page, size);

        Pageable pageable = PageRequest.of(page, size);
        Page<PracticeAreaToolHistoryDTO> historyPage = historyService.getHistoryByPracticeArea(practiceArea, pageable);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "history", historyPage.getContent(),
                                "totalElements", historyPage.getTotalElements(),
                                "totalPages", historyPage.getTotalPages(),
                                "currentPage", historyPage.getNumber()
                        ))
                        .message("History retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get a specific history item by ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getHistoryById(
            @PathVariable("practiceArea") String practiceArea,
            @PathVariable("id") Long id) {

        log.info("Getting history item ID: {} for practice area: {}", id, practiceArea);

        PracticeAreaToolHistoryDTO item = historyService.getHistoryById(practiceArea, id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", item))
                        .message("History item retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Create a new history entry
     */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createHistory(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("practiceArea") String practiceArea,
            @Valid @RequestBody CreateToolHistoryRequest request) {

        log.info("Creating history entry for practice area: {}, tool: {}", practiceArea, request.getToolType());

        PracticeAreaToolHistoryDTO created = historyService.createHistory(practiceArea, userId, request);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("item", created))
                        .message("History entry created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Delete a history item
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteHistory(
            @PathVariable("practiceArea") String practiceArea,
            @PathVariable("id") Long id) {

        log.info("Deleting history item ID: {} for practice area: {}", id, practiceArea);

        historyService.deleteHistory(practiceArea, id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("History item deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get history items linked to a specific case
     */
    @GetMapping("/case/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getHistoryByCase(
            @PathVariable("practiceArea") String practiceArea,
            @PathVariable("caseId") Long caseId) {

        log.info("Getting history for case ID: {} in practice area: {}", caseId, practiceArea);

        List<PracticeAreaToolHistoryDTO> history = historyService.getHistoryByCase(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("history", history))
                        .message("Case history retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
