package com.bostoneo.bostoneosolutions.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Cache configuration for legal research verification tools.
 *
 * Implements cost-effective caching strategy:
 * - Constitutional/statutory searches: 7 days (static content)
 * - Recent case law searches: 48 hours (more dynamic)
 *
 * Expected cost savings: 60-80% on cache hits
 * First query (cache miss): $5-7
 * Cached query (cache hit): $4-6
 */
@Slf4j
@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * Configure multiple cache managers with different TTLs based on content type
     */
    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager cacheManager = new SimpleCacheManager();

        cacheManager.setCaches(Arrays.asList(
            // Constitutional authority searches - 7 day TTL (static content)
            buildCache("constitution", 7, TimeUnit.DAYS, 500),

            // Statute scope verification - 7 day TTL (static content)
            buildCache("statutes", 7, TimeUnit.DAYS, 500),

            // Recent case law searches - 48 hour TTL (more dynamic)
            buildCache("case_searches", 48, TimeUnit.HOURS, 1000)
        ));

        log.info("✅ Initialized Caffeine cache manager with 3 caches");
        log.info("   - constitution: 7 day TTL, max 500 entries");
        log.info("   - statutes: 7 day TTL, max 500 entries");
        log.info("   - case_searches: 48 hour TTL, max 1000 entries");

        return cacheManager;
    }

    /**
     * Build a Caffeine cache with specific TTL and size limits
     */
    private CaffeineCache buildCache(String name, long duration, TimeUnit timeUnit, int maxSize) {
        return new CaffeineCache(name,
            Caffeine.newBuilder()
                .maximumSize(maxSize)
                .expireAfterWrite(duration, timeUnit)
                .recordStats()
                .build()
        );
    }
}
