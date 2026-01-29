package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.SearchHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Analytics service for tracking research usage patterns and costs
 * Provides insights for optimization and cost control
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ResearchAnalyticsService {

    private final SearchHistoryRepository searchHistoryRepository;
    private final TenantService tenantService;

    // Real-time analytics tracking
    private static class QueryMetrics {
        int fastCount = 0;
        int thoroughCount = 0;
        double totalCost = 0.0;
        long totalExecutionTime = 0;
        int cacheHits = 0;
        LocalDateTime periodStart = LocalDateTime.now();
    }

    // SECURITY: Metrics are tracked per-organization for tenant isolation
    // Key format: "{orgId}:{hourKey}" for hourly, "{orgId}:{userId}" for user
    private final Map<String, QueryMetrics> hourlyMetrics = new ConcurrentHashMap<>();
    private final Map<String, QueryMetrics> userMetrics = new ConcurrentHashMap<>();

    private String getOrgPrefix() {
        return tenantService.getCurrentOrganizationId()
                .map(id -> id + ":")
                .orElse("global:");
    }

    /**
     * Record a query execution for analytics
     * SECURITY: Metrics are recorded per-organization for tenant isolation
     */
    public void recordQuery(Long userId, String mode, long executionTimeMs,
                           boolean fromCache, double estimatedCost) {
        String orgPrefix = getOrgPrefix();
        String hourKey = orgPrefix + LocalDateTime.now().withMinute(0).withSecond(0).withNano(0).toString();

        // Update hourly metrics (per-organization)
        QueryMetrics hourly = hourlyMetrics.computeIfAbsent(hourKey, k -> new QueryMetrics());
        updateMetrics(hourly, mode, executionTimeMs, fromCache, estimatedCost);

        // Update user metrics (per-organization)
        if (userId != null) {
            String userKey = orgPrefix + userId;
            QueryMetrics userStats = userMetrics.computeIfAbsent(userKey, k -> new QueryMetrics());
            updateMetrics(userStats, mode, executionTimeMs, fromCache, estimatedCost);
        }
    }

    private void updateMetrics(QueryMetrics metrics, String mode, long executionTimeMs,
                              boolean fromCache, double estimatedCost) {
        synchronized (metrics) {
            if ("THOROUGH".equalsIgnoreCase(mode)) {
                metrics.thoroughCount++;
            } else {
                metrics.fastCount++;
            }

            if (fromCache) {
                metrics.cacheHits++;
            }

            metrics.totalCost += estimatedCost;
            metrics.totalExecutionTime += executionTimeMs;
        }
    }

    /**
     * Get current hour analytics for the current organization
     * SECURITY: Returns only metrics for the current tenant
     */
    public Map<String, Object> getCurrentHourAnalytics() {
        String orgPrefix = getOrgPrefix();
        String currentHour = orgPrefix + LocalDateTime.now().withMinute(0).withSecond(0).withNano(0).toString();
        QueryMetrics metrics = hourlyMetrics.get(currentHour);

        if (metrics == null) {
            return Map.of(
                "period", "current_hour",
                "totalQueries", 0,
                "totalCost", 0.0,
                "cacheHitRate", 0.0
            );
        }

        int totalQueries = metrics.fastCount + metrics.thoroughCount;
        double cacheHitRate = totalQueries > 0
            ? (metrics.cacheHits * 100.0 / totalQueries)
            : 0.0;
        double avgExecutionTime = totalQueries > 0
            ? (metrics.totalExecutionTime / (double) totalQueries)
            : 0.0;

        return Map.of(
            "period", "current_hour",
            "totalQueries", totalQueries,
            "fastQueries", metrics.fastCount,
            "thoroughQueries", metrics.thoroughCount,
            "totalCost", Math.round(metrics.totalCost * 100.0) / 100.0,
            "cacheHits", metrics.cacheHits,
            "cacheHitRate", Math.round(cacheHitRate * 10.0) / 10.0,
            "avgExecutionTimeMs", Math.round(avgExecutionTime),
            "periodStart", metrics.periodStart.toString()
        );
    }

    /**
     * Get user-specific analytics for the current organization
     * SECURITY: Returns only metrics for users in the current tenant
     */
    public Map<String, Object> getUserAnalytics(Long userId) {
        if (userId == null) {
            return Map.of("error", "No user ID provided");
        }

        String userKey = getOrgPrefix() + userId;
        QueryMetrics metrics = userMetrics.get(userKey);
        if (metrics == null) {
            return Map.of(
                "userId", userId,
                "totalQueries", 0,
                "totalCost", 0.0,
                "recommendation", "No usage data yet"
            );
        }

        int totalQueries = metrics.fastCount + metrics.thoroughCount;
        double cacheHitRate = totalQueries > 0
            ? (metrics.cacheHits * 100.0 / totalQueries)
            : 0.0;
        double avgCost = totalQueries > 0
            ? (metrics.totalCost / totalQueries)
            : 0.0;

        // Generate recommendation
        String recommendation = generateRecommendation(metrics, totalQueries, cacheHitRate);

        return Map.of(
            "userId", userId,
            "totalQueries", totalQueries,
            "fastQueries", metrics.fastCount,
            "thoroughQueries", metrics.thoroughCount,
            "totalCost", Math.round(metrics.totalCost * 100.0) / 100.0,
            "avgCostPerQuery", Math.round(avgCost * 100.0) / 100.0,
            "cacheHits", metrics.cacheHits,
            "cacheHitRate", Math.round(cacheHitRate * 10.0) / 10.0,
            "recommendation", recommendation
        );
    }

    /**
     * Generate optimization recommendation based on usage patterns
     */
    private String generateRecommendation(QueryMetrics metrics, int totalQueries, double cacheHitRate) {
        double thoroughRatio = totalQueries > 0
            ? (metrics.thoroughCount * 100.0 / totalQueries)
            : 0.0;

        if (cacheHitRate < 30 && totalQueries > 10) {
            return "Low cache hit rate (" + Math.round(cacheHitRate) + "%). " +
                   "Consider using FAST mode for common queries to build cache.";
        }

        if (thoroughRatio > 80 && totalQueries > 20) {
            return "Heavy THOROUGH mode usage (" + Math.round(thoroughRatio) + "%). " +
                   "Consider using FAST mode for simpler questions to reduce costs.";
        }

        if (cacheHitRate > 60 && totalQueries > 10) {
            return "Excellent cache hit rate (" + Math.round(cacheHitRate) + "%)! " +
                   "Your query patterns are optimized for cost savings.";
        }

        if (totalQueries < 5) {
            return "Build up your research history to see personalized recommendations.";
        }

        return "Usage is balanced. Continue using FAST for quick questions and THOROUGH for complex analysis.";
    }

    /**
     * Log analytics summary (runs every hour)
     */
    @Scheduled(cron = "0 0 * * * *") // Every hour at :00
    public void logHourlyAnalytics() {
        try {
            Map<String, Object> stats = getCurrentHourAnalytics();

            if ((int) stats.get("totalQueries") > 0) {
                log.info("📈 === HOURLY RESEARCH ANALYTICS ===");
                log.info("  Total queries: {}", stats.get("totalQueries"));
                log.info("  FAST: {} | THOROUGH: {}", stats.get("fastQueries"), stats.get("thoroughQueries"));
                log.info("  Total cost: ${}", stats.get("totalCost"));
                log.info("  Cache hit rate: {}%", stats.get("cacheHitRate"));
                log.info("  Avg execution: {}ms", stats.get("avgExecutionTimeMs"));
                log.info("===================================");
            } else {
                log.debug("📈 Hourly analytics: No queries in the past hour");
            }

            // Cleanup old hourly metrics (keep last 24 hours)
            cleanupOldMetrics();

        } catch (Exception e) {
            log.error("❌ Failed to log hourly analytics: {}", e.getMessage(), e);
        }
    }

    /**
     * Get top users by query volume (for admin monitoring)
     * SECURITY: Returns only users from the current organization
     */
    public List<Map<String, Object>> getTopUsers(int limit) {
        String orgPrefix = getOrgPrefix();

        return userMetrics.entrySet().stream()
            .filter(entry -> entry.getKey().startsWith(orgPrefix))  // SECURITY: Filter by org
            .sorted((a, b) -> {
                int totalA = a.getValue().fastCount + a.getValue().thoroughCount;
                int totalB = b.getValue().fastCount + b.getValue().thoroughCount;
                return Integer.compare(totalB, totalA);
            })
            .limit(limit)
            .map(entry -> {
                // Extract userId from key (format: "orgId:userId")
                String userIdStr = entry.getKey().substring(orgPrefix.length());
                Long userId = Long.parseLong(userIdStr);
                QueryMetrics metrics = entry.getValue();
                int totalQueries = metrics.fastCount + metrics.thoroughCount;

                return Map.<String, Object>of(
                    "userId", userId,
                    "totalQueries", totalQueries,
                    "totalCost", Math.round(metrics.totalCost * 100.0) / 100.0,
                    "thoroughCount", metrics.thoroughCount,
                    "cacheHits", metrics.cacheHits
                );
            })
            .toList();
    }

    /**
     * Get organization-wide cost summary
     * SECURITY: Returns only metrics for the current tenant
     */
    public Map<String, Object> getSystemCostSummary() {
        String orgPrefix = getOrgPrefix();

        // SECURITY: Filter metrics by current organization
        double totalCost = userMetrics.entrySet().stream()
            .filter(e -> e.getKey().startsWith(orgPrefix))
            .mapToDouble(e -> e.getValue().totalCost)
            .sum();

        int totalQueries = userMetrics.entrySet().stream()
            .filter(e -> e.getKey().startsWith(orgPrefix))
            .mapToInt(e -> e.getValue().fastCount + e.getValue().thoroughCount)
            .sum();

        int totalCacheHits = userMetrics.entrySet().stream()
            .filter(e -> e.getKey().startsWith(orgPrefix))
            .mapToInt(e -> e.getValue().cacheHits)
            .sum();

        long activeUsers = userMetrics.keySet().stream()
            .filter(k -> k.startsWith(orgPrefix))
            .count();

        double cacheHitRate = totalQueries > 0
            ? (totalCacheHits * 100.0 / totalQueries)
            : 0.0;

        double avgCost = totalQueries > 0
            ? (totalCost / totalQueries)
            : 0.0;

        // Estimate savings from cache
        double estimatedSavingsFromCache = totalCacheHits * 1.50; // Avg THOROUGH cost

        return Map.of(
            "totalCost", Math.round(totalCost * 100.0) / 100.0,
            "totalQueries", totalQueries,
            "avgCostPerQuery", Math.round(avgCost * 100.0) / 100.0,
            "cacheHitRate", Math.round(cacheHitRate * 10.0) / 10.0,
            "estimatedSavings", Math.round(estimatedSavingsFromCache * 100.0) / 100.0,
            "activeUsers", activeUsers
        );
    }

    /**
     * Reset user analytics (admin function)
     * SECURITY: Only resets metrics for the user in the current organization
     */
    public void resetUserAnalytics(Long userId) {
        String userKey = getOrgPrefix() + userId;
        userMetrics.remove(userKey);
        log.info("🔄 Analytics reset for user: {} in org context", userId);
    }

    /**
     * Cleanup old hourly metrics
     */
    private void cleanupOldMetrics() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        hourlyMetrics.entrySet().removeIf(entry ->
            entry.getValue().periodStart.isBefore(cutoff)
        );
    }
}
