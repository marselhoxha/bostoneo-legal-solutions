package com.bostoneo.bostoneosolutions.controller.ai;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Admin controller for monitoring cache performance and statistics
 * Provides insights into cost savings and cache effectiveness
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/cache")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('legal_research:admin')")
public class CacheAdminController {

    private final CacheManager cacheManager;

    /**
     * Get statistics for all caches
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getAllCacheStats() {
        Map<String, Object> allStats = new HashMap<>();

        // Get stats for each cache
        String[] cacheNames = {"constitution", "statutes", "case_searches"};

        for (String cacheName : cacheNames) {
            org.springframework.cache.Cache cache = cacheManager.getCache(cacheName);
            if (cache instanceof CaffeineCache caffeineCache) {
                Cache<Object, Object> nativeCache = caffeineCache.getNativeCache();
                CacheStats stats = nativeCache.stats();

                Map<String, Object> cacheStats = new HashMap<>();
                cacheStats.put("hitCount", stats.hitCount());
                cacheStats.put("missCount", stats.missCount());
                cacheStats.put("hitRate", String.format("%.2f%%", stats.hitRate() * 100));
                cacheStats.put("missRate", String.format("%.2f%%", stats.missRate() * 100));
                cacheStats.put("loadCount", stats.loadCount());
                cacheStats.put("evictionCount", stats.evictionCount());
                cacheStats.put("totalLoadTime", stats.totalLoadTime());
                cacheStats.put("averageLoadTime",
                    stats.loadCount() > 0
                        ? String.format("%.2f ms", stats.totalLoadTime() / (double) stats.loadCount() / 1_000_000)
                        : "N/A");

                // Calculate estimated cost savings
                // Assume: First query costs $6 (web search), cached query costs $0.50 (tool call only)
                double savingsPerHit = 5.50; // $6.00 - $0.50
                double estimatedSavings = stats.hitCount() * savingsPerHit;
                cacheStats.put("estimatedCostSavings", String.format("$%.2f", estimatedSavings));

                allStats.put(cacheName, cacheStats);
            }
        }

        // Calculate total savings
        double totalSavings = allStats.values().stream()
            .mapToDouble(stats -> {
                if (stats instanceof Map<?, ?> statsMap) {
                    Object savingsObj = statsMap.get("estimatedCostSavings");
                    if (savingsObj != null) {
                        String savingsStr = savingsObj.toString();
                        return Double.parseDouble(savingsStr.replace("$", ""));
                    }
                }
                return 0.0;
            })
            .sum();

        allStats.put("totalEstimatedSavings", String.format("$%.2f", totalSavings));

        log.info("Cache stats requested. Total estimated savings: ${}", totalSavings);

        return ResponseEntity.ok(allStats);
    }

    /**
     * Get statistics for a specific cache
     */
    @GetMapping("/stats/{cacheName}")
    public ResponseEntity<Map<String, Object>> getCacheStats(@PathVariable String cacheName) {
        org.springframework.cache.Cache cache = cacheManager.getCache(cacheName);

        if (cache == null) {
            return ResponseEntity.notFound().build();
        }

        if (cache instanceof CaffeineCache caffeineCache) {
            Cache<Object, Object> nativeCache = caffeineCache.getNativeCache();
            CacheStats stats = nativeCache.stats();

            Map<String, Object> cacheStats = new HashMap<>();
            cacheStats.put("cacheName", cacheName);
            cacheStats.put("hitCount", stats.hitCount());
            cacheStats.put("missCount", stats.missCount());
            cacheStats.put("hitRate", String.format("%.2f%%", stats.hitRate() * 100));
            cacheStats.put("missRate", String.format("%.2f%%", stats.missRate() * 100));
            cacheStats.put("loadCount", stats.loadCount());
            cacheStats.put("evictionCount", stats.evictionCount());
            cacheStats.put("totalLoadTime", stats.totalLoadTime());
            cacheStats.put("averageLoadTime",
                stats.loadCount() > 0
                    ? String.format("%.2f ms", stats.totalLoadTime() / (double) stats.loadCount() / 1_000_000)
                    : "N/A");

            // Estimate size
            cacheStats.put("estimatedSize", nativeCache.estimatedSize());

            return ResponseEntity.ok(cacheStats);
        }

        return ResponseEntity.badRequest().body(Map.of("error", "Not a Caffeine cache"));
    }

    /**
     * Clear a specific cache
     */
    @DeleteMapping("/clear/{cacheName}")
    public ResponseEntity<Map<String, String>> clearCache(@PathVariable String cacheName) {
        org.springframework.cache.Cache cache = cacheManager.getCache(cacheName);

        if (cache == null) {
            return ResponseEntity.notFound().build();
        }

        cache.clear();
        log.info("Cache cleared: {}", cacheName);

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "Cache '" + cacheName + "' has been cleared"
        ));
    }

    /**
     * Clear all caches
     */
    @DeleteMapping("/clear-all")
    public ResponseEntity<Map<String, String>> clearAllCaches() {
        String[] cacheNames = {"constitution", "statutes", "case_searches"};

        for (String cacheName : cacheNames) {
            org.springframework.cache.Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.clear();
            }
        }

        log.info("All caches cleared");

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "All caches have been cleared"
        ));
    }

    /**
     * Get cache configuration info
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getCacheConfig() {
        Map<String, Object> config = new HashMap<>();

        config.put("caches", Map.of(
            "constitution", Map.of(
                "ttl", "7 days",
                "maxSize", 500,
                "purpose", "Constitutional authority verification"
            ),
            "statutes", Map.of(
                "ttl", "7 days",
                "maxSize", 500,
                "purpose", "Statute scope verification"
            ),
            "case_searches", Map.of(
                "ttl", "48 hours",
                "maxSize", 1000,
                "purpose", "Recent case law searches (2020-2025)"
            )
        ));

        config.put("costModel", Map.of(
            "firstQuery", "$6.00 (web search + AI analysis)",
            "cachedQuery", "$0.50 (tool call only)",
            "savingsPerHit", "$5.50"
        ));

        return ResponseEntity.ok(config);
    }
}
