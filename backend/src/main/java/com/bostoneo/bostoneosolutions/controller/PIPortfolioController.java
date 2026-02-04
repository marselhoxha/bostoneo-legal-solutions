package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PIPortfolioStatsDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.service.PIPortfolioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.OK;

/**
 * REST Controller for PI Portfolio Dashboard
 * Provides aggregate statistics and case list for PI practice area
 */
@RestController
@RequestMapping("/api/pi/portfolio")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class PIPortfolioController {

    private final PIPortfolioService portfolioService;

    /**
     * Get aggregate portfolio statistics for all PI cases
     */
    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getPortfolioStats() {
        log.info("Getting PI portfolio statistics");

        PIPortfolioStatsDTO stats = portfolioService.getPortfolioStats(null);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("stats", stats))
                        .message("Portfolio statistics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get paginated list of PI cases
     */
    @GetMapping("/cases")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getPICases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        log.info("Getting PI cases: page={}, size={}", page, size);

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Page<LegalCase> cases = portfolioService.getPICases(null, PageRequest.of(page, size, sort));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("cases", cases))
                        .message("PI cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Search PI cases
     */
    @GetMapping("/cases/search")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> searchPICases(
            @RequestParam String term,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("Searching PI cases with term: {}", term);

        Page<LegalCase> cases = portfolioService.searchPICases(null, term, PageRequest.of(page, size));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("cases", cases))
                        .message("Search results retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get PI cases filtered by status
     */
    @GetMapping("/cases/status/{status}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getPICasesByStatus(
            @PathVariable String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("Getting PI cases with status: {}", status);

        Page<LegalCase> cases = portfolioService.getPICasesByStatus(null, status, PageRequest.of(page, size));

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("cases", cases))
                        .message("Cases filtered by status retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
