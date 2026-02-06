package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AILegalResearchService;
import com.bostoneo.bostoneosolutions.service.ResearchProgressPublisher;
import com.bostoneo.bostoneosolutions.model.SearchHistory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/legal-research")
@RequiredArgsConstructor
@Slf4j
public class AILegalResearchController {

    private final AILegalResearchService legalResearchService;
    private final ResearchProgressPublisher progressPublisher;

    /**
     * SECURITY: Get current authenticated user's ID - never use hardcoded defaults
     */
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                return ((UserDTO) principal).getId();
            } else if (principal instanceof UserPrincipal) {
                return ((UserPrincipal) principal).getUser().getId();
            }
        }
        throw new RuntimeException("Authentication required - could not determine current user");
    }

    /**
     * Server-Sent Events endpoint for real-time research progress
     */
    @GetMapping(value = "/progress-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamResearchProgress(@RequestParam String sessionId) {
        log.info("Creating SSE stream for session: {}", sessionId);
        try {
            return progressPublisher.createEmitter(sessionId);
        } catch (Exception e) {
            log.error("Error creating SSE emitter for session {}: {}", sessionId, e.getMessage());
            // Return a basic emitter that will immediately send an error and complete
            SseEmitter errorEmitter = new SseEmitter(60000L);
            try {
                errorEmitter.send(SseEmitter.event()
                    .name("error")
                    .data("{\"message\":\"Failed to create progress stream\"}"));
                errorEmitter.complete();
            } catch (Exception ignored) {
                // If we can't even send an error, just return the emitter
            }
            return errorEmitter;
        }
    }

    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> performSearch(@RequestBody Map<String, Object> searchRequest) {
        try {
            log.info("Legal research search request: {}", searchRequest);

            Map<String, Object> searchResults = legalResearchService.performSearch(searchRequest);
            return ResponseEntity.ok(searchResults);

        } catch (Exception e) {
            log.error("Error performing legal research: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Search failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/search-history")
    public ResponseEntity<Map<String, Object>> getUserSearchHistory(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {

        try {
            // SECURITY: Always use authenticated user - never allow userId parameter override
            Long effectiveUserId = getCurrentUserId();

            List<SearchHistory> history = legalResearchService.getUserSearchHistory(effectiveUserId, limit);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("history", history);
            response.put("total", history.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error fetching search history: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to fetch search history: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/saved-searches")
    public ResponseEntity<Map<String, Object>> getSavedSearches() {

        try {
            // SECURITY: Always use authenticated user - never allow userId parameter override
            Long effectiveUserId = getCurrentUserId();

            List<SearchHistory> savedSearches = legalResearchService.getSavedSearches(effectiveUserId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("savedSearches", savedSearches);
            response.put("total", savedSearches.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error fetching saved searches: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to fetch saved searches: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/save-search/{searchId}")
    public ResponseEntity<Map<String, Object>> saveSearch(
            @PathVariable Long searchId,
            @AuthenticationPrincipal UserDTO user) {
        try {
            legalResearchService.saveSearch(searchId, user.getId());

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Search saved successfully");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error saving search: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to save search: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @DeleteMapping("/search-history/{searchId}")
    public ResponseEntity<Map<String, Object>> deleteSearchHistory(
            @PathVariable Long searchId) {

        try {
            // SECURITY: Always use authenticated user - never allow userId parameter override
            Long effectiveUserId = getCurrentUserId();

            legalResearchService.deleteSearchHistory(searchId, effectiveUserId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Search history deleted successfully");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error deleting search history: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to delete search history: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/search-suggestions")
    public ResponseEntity<Map<String, Object>> getSearchSuggestions(
            @RequestParam("query") String query) {

        try {
            // SECURITY: Always use authenticated user - never allow userId parameter override
            Long effectiveUserId = getCurrentUserId();

            // Get recent searches for suggestions
            List<SearchHistory> recentSearches = legalResearchService.getUserSearchHistory(effectiveUserId, 10);

            // Simple suggestion logic based on search history
            List<String> suggestions = recentSearches.stream()
                .map(SearchHistory::getSearchQuery)
                .filter(q -> q.toLowerCase().contains(query.toLowerCase()))
                .distinct()
                .limit(5)
                .toList();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("suggestions", suggestions);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting search suggestions: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get suggestions: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/search-types")
    public ResponseEntity<Map<String, Object>> getSearchTypes() {
        try {
            Map<String, Object> searchTypes = new HashMap<>();
            searchTypes.put("all", "All Legal Sources");
            searchTypes.put("statutes", "Massachusetts Statutes");
            searchTypes.put("rules", "Court Rules");
            searchTypes.put("regulations", "Regulations");
            searchTypes.put("guidelines", "Sentencing Guidelines");

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("searchTypes", searchTypes);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting search types: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get search types: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/external-api-status")
    public ResponseEntity<Map<String, Object>> getExternalApiStatus() {
        try {
            Map<String, Object> status = legalResearchService.getExternalApiStatus();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("status", status);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting external API status: ", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get API status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "AI Legal Research");
        response.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(response);
    }
}