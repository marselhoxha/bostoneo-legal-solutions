package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin endpoints for monitoring and managing AI research system
 */
@RestController
@RequestMapping("/api/admin/research")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class ResearchAdminController {

    private final CacheManagementService cacheManagementService;
    private final RateLimitService rateLimitService;
    private final ResearchAnalyticsService analyticsService;
    private final SmartModeSelector smartModeSelector;
    private final CostPredictionService costPredictionService;
    private final QuerySimilarityService similarityService;

    /**
     * Get cache statistics
     */
    @GetMapping("/cache/stats")
    public ResponseEntity<Map<String, Object>> getCacheStats() {
        try {
            Map<String, Object> stats = cacheManagementService.getCacheStatistics();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("stats", stats);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting cache stats: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get current hour analytics
     */
    @GetMapping("/analytics/current-hour")
    public ResponseEntity<Map<String, Object>> getCurrentHourAnalytics() {
        try {
            Map<String, Object> analytics = analyticsService.getCurrentHourAnalytics();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("analytics", analytics);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting analytics: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get user-specific analytics
     */
    @GetMapping("/analytics/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserAnalytics(@PathVariable Long userId) {
        try {
            Map<String, Object> analytics = analyticsService.getUserAnalytics(userId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("userAnalytics", analytics);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting user analytics: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get system cost summary
     */
    @GetMapping("/analytics/cost-summary")
    public ResponseEntity<Map<String, Object>> getCostSummary() {
        try {
            Map<String, Object> summary = analyticsService.getSystemCostSummary();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("costSummary", summary);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting cost summary: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get top users by query volume
     */
    @GetMapping("/analytics/top-users")
    public ResponseEntity<Map<String, Object>> getTopUsers(
        @RequestParam(defaultValue = "10") int limit) {
        try {
            var topUsers = analyticsService.getTopUsers(limit);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("topUsers", topUsers);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting top users: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get rate limit configuration
     */
    @GetMapping("/rate-limits/config")
    public ResponseEntity<Map<String, Object>> getRateLimitConfig() {
        try {
            Map<String, Object> config = rateLimitService.getRateLimitConfig();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("config", config);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting rate limit config: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get remaining requests for a user
     */
    @GetMapping("/rate-limits/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserRateLimits(
        @PathVariable Long userId,
        @RequestParam(defaultValue = "FAST") String mode) {
        try {
            Map<String, Integer> remaining = rateLimitService.getRemainingRequests(userId, mode);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("remaining", remaining);
            response.put("mode", mode);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting user rate limits: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Reset user rate limits (admin only)
     */
    @PostMapping("/rate-limits/reset/{userId}")
    public ResponseEntity<Map<String, Object>> resetUserRateLimits(@PathVariable Long userId) {
        try {
            rateLimitService.resetUserLimits(userId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Rate limits reset for user " + userId);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error resetting rate limits: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Reset user analytics (admin only)
     */
    @PostMapping("/analytics/reset/{userId}")
    public ResponseEntity<Map<String, Object>> resetUserAnalytics(@PathVariable Long userId) {
        try {
            analyticsService.resetUserAnalytics(userId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Analytics reset for user " + userId);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error resetting analytics: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Predict cost for a query (Phase 5)
     */
    @PostMapping("/cost/predict")
    public ResponseEntity<Map<String, Object>> predictCost(@RequestBody Map<String, Object> request) {
        try {
            String query = (String) request.get("query");
            String mode = (String) request.getOrDefault("mode", "FAST");
            Long userId = request.containsKey("userId") ?
                Long.valueOf(request.get("userId").toString()) : null;

            CostPredictionService.CostPrediction prediction =
                costPredictionService.predictCost(query, mode, userId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("prediction", prediction.toMap());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error predicting cost: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Compare costs between modes (Phase 5)
     */
    @PostMapping("/cost/compare")
    public ResponseEntity<Map<String, Object>> compareCosts(@RequestBody Map<String, Object> request) {
        try {
            String query = (String) request.get("query");
            Long userId = request.containsKey("userId") ?
                Long.valueOf(request.get("userId").toString()) : null;

            Map<String, Object> comparison = costPredictionService.compareModes(query, userId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("comparison", comparison);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error comparing costs: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get mode recommendation for a query (Phase 5)
     */
    @PostMapping("/mode/recommend")
    public ResponseEntity<Map<String, Object>> recommendMode(@RequestBody Map<String, Object> request) {
        try {
            String query = (String) request.get("query");
            String requestedMode = (String) request.getOrDefault("requestedMode", "FAST");
            Long userId = request.containsKey("userId") ?
                Long.valueOf(request.get("userId").toString()) : null;

            SmartModeSelector.ModeRecommendation recommendation =
                smartModeSelector.selectMode(query, userId, requestedMode);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("recommendation", recommendation.toMap());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error recommending mode: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Find duplicate queries for cache optimization (Phase 5)
     */
    @GetMapping("/cache/duplicates")
    public ResponseEntity<Map<String, Object>> findDuplicates() {
        try {
            List<QuerySimilarityService.DuplicateGroup> duplicates =
                similarityService.findDuplicateQueries();

            int totalDuplicates = duplicates.stream()
                .mapToInt(QuerySimilarityService.DuplicateGroup::getPotentialSavings)
                .sum();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("duplicateGroups", duplicates.size());
            response.put("totalDuplicates", totalDuplicates);
            response.put("potentialSavings", "$" + String.format("%.2f", totalDuplicates * 1.50));
            response.put("message", "Found " + totalDuplicates + " potential cache improvements");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error finding duplicates: ", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * System health check
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "AI Research Admin");
        response.put("timestamp", System.currentTimeMillis());
        response.put("features", Map.of(
            "rateLimit", "enabled",
            "analytics", "enabled",
            "caching", "enabled",
            "validation", "enabled",
            "smartMode", "enabled",
            "costPrediction", "enabled",
            "qualityScoring", "enabled",
            "similarityCache", "enabled"
        ));
        return ResponseEntity.ok(response);
    }
}
