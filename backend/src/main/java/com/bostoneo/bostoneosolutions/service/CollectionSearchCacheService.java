package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.CollectionSearchCache;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.CollectionSearchCacheRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service for managing search result caching.
 * Caches semantic search results to avoid repeated API calls.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CollectionSearchCacheService {

    private final CollectionSearchCacheRepository cacheRepository;
    private final ObjectMapper objectMapper;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Default cache time-to-live: 24 hours.
     */
    private static final Duration CACHE_TTL = Duration.ofHours(24);

    /**
     * Get cached search results if available and not expired.
     *
     * @param collectionId Collection ID
     * @param query Search query
     * @param userId User ID
     * @return Optional containing cached results if found and valid
     */
    public Optional<CachedSearchResult> getCachedResults(Long collectionId, String query, Long userId) {
        Long orgId = getRequiredOrganizationId();
        String queryHash = hashQuery(query);

        Optional<CollectionSearchCache> cached = cacheRepository
                .findByOrganizationIdAndCollectionIdAndQueryHashAndUserId(orgId, collectionId, queryHash, userId);

        if (cached.isPresent()) {
            CollectionSearchCache cache = cached.get();

            // Check if expired
            if (cache.isExpired()) {
                log.debug("Cache expired for query '{}' in collection {}", query, collectionId);
                return Optional.empty();
            }

            // Parse cached results
            try {
                List<Map<String, Object>> results = objectMapper.readValue(
                        cache.getResultsJson(),
                        new TypeReference<List<Map<String, Object>>>() {}
                );

                log.info("Cache HIT for query '{}' in collection {} - {} results",
                        query, collectionId, results.size());

                return Optional.of(new CachedSearchResult(
                        results,
                        cache.getExpandedQuery(),
                        cache.getCreatedAt()
                ));
            } catch (JsonProcessingException e) {
                log.error("Failed to parse cached results: {}", e.getMessage());
                return Optional.empty();
            }
        }

        log.debug("Cache MISS for query '{}' in collection {}", query, collectionId);
        return Optional.empty();
    }

    /**
     * Cache search results for future use.
     *
     * @param collectionId Collection ID
     * @param query Original search query
     * @param userId User ID
     * @param results Search results to cache
     * @param expandedQuery Query expanded with synonyms
     */
    @Transactional
    public void cacheResults(Long collectionId, String query, Long userId,
                             List<Map<String, Object>> results, String expandedQuery) {
        Long orgId = getRequiredOrganizationId();
        String queryHash = hashQuery(query);

        try {
            String resultsJson = objectMapper.writeValueAsString(results);

            // Check if cache entry already exists
            Optional<CollectionSearchCache> existing = cacheRepository
                    .findByOrganizationIdAndCollectionIdAndQueryHashAndUserId(orgId, collectionId, queryHash, userId);

            CollectionSearchCache cache;
            if (existing.isPresent()) {
                // Update existing cache entry
                cache = existing.get();
                cache.setResultsJson(resultsJson);
                cache.setExpandedQuery(expandedQuery);
                cache.setResultCount(results.size());
                cache.setExpiresAt(LocalDateTime.now().plus(CACHE_TTL));
            } else {
                // Create new cache entry
                cache = CollectionSearchCache.builder()
                        .organizationId(orgId)
                        .collectionId(collectionId)
                        .userId(userId)
                        .query(query)
                        .queryHash(queryHash)
                        .expandedQuery(expandedQuery)
                        .resultsJson(resultsJson)
                        .resultCount(results.size())
                        .expiresAt(LocalDateTime.now().plus(CACHE_TTL))
                        .build();
            }

            cacheRepository.save(cache);
            log.info("Cached {} results for query '{}' in collection {}", results.size(), query, collectionId);

        } catch (JsonProcessingException e) {
            log.error("Failed to serialize results for caching: {}", e.getMessage());
        }
    }

    /**
     * Invalidate all cache entries for a collection.
     * Called when documents are added or removed from the collection.
     *
     * @param collectionId Collection ID to invalidate cache for
     */
    @Transactional
    public void invalidateCollectionCache(Long collectionId) {
        Long orgId = getRequiredOrganizationId();
        cacheRepository.deleteByOrganizationIdAndCollectionId(orgId, collectionId);
        log.info("Invalidated search cache for collection {}", collectionId);
    }

    /**
     * Clean up expired cache entries.
     * Runs every hour.
     */
    @Scheduled(fixedRate = 3600000) // Every hour
    @Transactional
    public void cleanupExpiredCache() {
        // Note: This scheduled job cleans all orgs - using deprecated method intentionally
        // In production, consider iterating over all orgs or using a global cleanup
        int deleted = cacheRepository.deleteExpiredCache(LocalDateTime.now());
        if (deleted > 0) {
            log.info("Cleaned up {} expired cache entries", deleted);
        }
    }

    /**
     * Generate SHA-256 hash of query for consistent cache keys.
     */
    private String hashQuery(String query) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(query.toLowerCase().trim().getBytes(StandardCharsets.UTF_8));

            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            // Fallback to simple hash
            return String.valueOf(query.toLowerCase().trim().hashCode());
        }
    }

    /**
     * Get cache statistics for monitoring.
     */
    public Map<String, Object> getCacheStats(Long collectionId) {
        Long orgId = getRequiredOrganizationId();
        long count = cacheRepository.countByOrganizationIdAndCollectionId(orgId, collectionId);
        return Map.of(
                "collectionId", collectionId,
                "cacheEntries", count,
                "cacheTtlHours", CACHE_TTL.toHours()
        );
    }

    /**
     * Cached search result wrapper.
     */
    public record CachedSearchResult(
            List<Map<String, Object>> results,
            String expandedQuery,
            LocalDateTime cachedAt
    ) {}
}
