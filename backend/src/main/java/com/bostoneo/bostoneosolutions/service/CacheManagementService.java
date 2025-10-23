package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.repository.AIResearchCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for managing AI research cache lifecycle and monitoring
 * Handles automated cleanup and statistics logging
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CacheManagementService {

    private final AIResearchCacheRepository cacheRepository;

    /**
     * Cleanup expired cache entries
     * Runs every hour
     */
    @Scheduled(cron = "0 0 * * * *") // Every hour at :00
    @Transactional
    public void cleanupExpiredCaches() {
        try {
            LocalDateTime now = LocalDateTime.now();
            long expiredCount = cacheRepository.countExpiredCaches(now);

            if (expiredCount > 0) {
                log.info("🧹 Starting cache cleanup - {} expired entries found", expiredCount);
                cacheRepository.deleteByExpiresAtBefore(now);
                log.info("✅ Cache cleanup complete - {} entries removed", expiredCount);
            } else {
                log.debug("✓ Cache cleanup: No expired entries");
            }
        } catch (Exception e) {
            log.error("❌ Cache cleanup failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Log cache statistics
     * Runs every 6 hours
     */
    @Scheduled(cron = "0 0 */6 * * *") // Every 6 hours
    public void logCacheStatistics() {
        try {
            Map<String, Object> stats = getCacheStatistics();

            log.info("📊 === CACHE STATISTICS ===");
            log.info("  Valid entries: {}", stats.get("validEntries"));
            log.info("  Expired entries: {}", stats.get("expiredEntries"));
            log.info("  Total cache hits: {}", stats.get("totalHits"));
            log.info("  Average hits per entry: {}", String.format("%.2f", stats.get("averageHits")));
            log.info("  Cache hit rate estimate: {}%", stats.get("estimatedHitRate"));

            @SuppressWarnings("unchecked")
            Map<String, Long> byType = (Map<String, Long>) stats.get("entriesByType");
            log.info("  Breakdown by query type:");
            byType.forEach((type, count) -> log.info("    - {}: {}", type, count));

            log.info("  Estimated cost savings: ${}", String.format("%.2f", stats.get("estimatedSavings")));
            log.info("========================");

        } catch (Exception e) {
            log.error("❌ Failed to log cache statistics: {}", e.getMessage(), e);
        }
    }

    /**
     * Get comprehensive cache statistics
     */
    public Map<String, Object> getCacheStatistics() {
        Map<String, Object> stats = new HashMap<>();

        long validEntries = cacheRepository.countValidCaches();
        long expiredEntries = cacheRepository.countExpiredCaches(LocalDateTime.now());
        Long totalHits = cacheRepository.getTotalCacheHits();
        Double averageHits = cacheRepository.getAverageCacheHits();

        stats.put("validEntries", validEntries);
        stats.put("expiredEntries", expiredEntries);
        stats.put("totalHits", totalHits != null ? totalHits : 0L);
        stats.put("averageHits", averageHits != null ? averageHits : 0.0);

        // Calculate estimated hit rate
        // If average hits > 1, it means queries are being served from cache
        double estimatedHitRate = 0.0;
        if (averageHits != null && averageHits > 1.0) {
            // For example: avg hits = 2.5 means 60% hit rate ((2.5-1)/2.5)
            estimatedHitRate = ((averageHits - 1.0) / averageHits) * 100;
        }
        stats.put("estimatedHitRate", Math.round(estimatedHitRate));

        // Get breakdown by query type
        List<Object[]> byTypeRaw = cacheRepository.getCacheCountByQueryType();
        Map<String, Long> byType = new HashMap<>();
        for (Object[] row : byTypeRaw) {
            String type = row[0] != null ? row[0].toString() : "UNKNOWN";
            Long count = ((Number) row[1]).longValue();
            byType.put(type, count);
        }
        stats.put("entriesByType", byType);

        // Estimate cost savings
        // Assume average THOROUGH query costs $1.50
        // Each cache hit saves $1.50
        long cacheHits = totalHits != null ? totalHits - validEntries : 0;
        double estimatedSavings = cacheHits * 1.50;
        stats.put("estimatedSavings", estimatedSavings);

        return stats;
    }

    /**
     * Invalidate all caches for a specific query type
     * Useful for clearing cache after significant law changes
     */
    @Transactional
    public void invalidateCachesByType(String queryType) {
        try {
            // This would require a custom method, but for now we can log
            log.info("⚠️ Cache invalidation requested for type: {}", queryType);
            // Implementation would mark caches as invalid or delete them
            // cacheRepository.updateIsValidByQueryType(queryType, false);
        } catch (Exception e) {
            log.error("❌ Cache invalidation failed: {}", e.getMessage(), e);
        }
    }
}
