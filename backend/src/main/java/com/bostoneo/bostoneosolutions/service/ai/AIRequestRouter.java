package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.AIRoutingRequest;
import com.bostoneo.bostoneosolutions.dto.ai.AIRoutingResult;
import com.bostoneo.bostoneosolutions.dto.ai.ConversationMessage;
import com.bostoneo.bostoneosolutions.enumeration.AIOperationType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Centralized AI request router. ALL AI operations should flow through this service.
 *
 * Responsibilities:
 * 1. Check router-level cache before making API calls
 * 2. Score complexity and select model (Sonnet vs Opus) + mode (FAST vs THOROUGH)
 * 3. Prune conversation history if present
 * 4. Delegate to ClaudeSonnet4Service with selected configuration
 * 5. Cache responses for cacheable operations
 * 6. Return result with routing metadata for logging/metrics
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIRequestRouter {

    private final ClaudeSonnet4Service claudeService;
    private final AIComplexityScorer complexityScorer;
    private final ConversationHistoryPruner historyPruner;

    /** In-memory response cache: cacheKey → CachedEntry. Max 500 entries to prevent OOM. */
    private final ConcurrentHashMap<String, CachedEntry> responseCache = new ConcurrentHashMap<>();
    private static final int MAX_CACHE_SIZE = 500;

    // ===== MAIN ROUTING METHOD =====

    /**
     * Route an AI request through the optimization pipeline.
     * This is the primary entry point for all non-streaming, non-tool AI operations.
     */
    public CompletableFuture<AIRoutingResult> route(AIRoutingRequest request) {
        AIOperationType opType = request.getOperationType();
        String query = request.getQuery();

        // 1. Check cache
        if (opType.isCacheable()) {
            String cacheKey = buildCacheKey(opType, query, request.getCaseId());
            CachedEntry cached = responseCache.get(cacheKey);
            if (cached != null && !cached.isExpired()) {
                log.info("Cache HIT for {} (key: {}...)", opType, cacheKey.substring(0, 8));
                return CompletableFuture.completedFuture(AIRoutingResult.builder()
                        .response(cached.response)
                        .modelUsed(cached.modelUsed)
                        .modeUsed(cached.modeUsed)
                        .cacheHit(true)
                        .operationType(opType.name())
                        .build());
            }
        }

        // 2. Score complexity → pick model + mode
        AIComplexityScorer.RoutingDecision decision = complexityScorer.decide(opType, query);
        String selectedModel = decision.modelId();
        String selectedMode = decision.mode();

        log.info("Routing {} → model={}, mode={}, complexity={}",
                opType,
                selectedModel.contains("sonnet") ? "Sonnet" : "Opus",
                selectedMode,
                String.format("%.2f", decision.complexityScore()));

        // 3. Prune conversation history if present
        // Note: history pruning only applies when history is passed as ConversationMessage objects
        // The actual history-in-prompt pruning happens in AILegalResearchService

        // 4. Delegate to ClaudeSonnet4Service with selected model
        CompletableFuture<String> aiResponse = claudeService.generateCompletionWithModel(
                query,
                request.getSystemMessage(),
                request.isUseDeepThinking(),
                request.getSessionId(),
                request.getTemperature(),
                selectedModel
        );

        // 5. Wrap result and cache if applicable
        return aiResponse.thenApply(response -> {
            AIRoutingResult result = AIRoutingResult.builder()
                    .response(response)
                    .modelUsed(selectedModel)
                    .modeUsed(selectedMode)
                    .cacheHit(false)
                    .operationType(opType.name())
                    .build();

            // Cache if cacheable (with max size enforcement)
            if (opType.isCacheable() && response != null && !response.isBlank()) {
                // Evict oldest entries if cache is at max capacity
                if (responseCache.size() >= MAX_CACHE_SIZE) {
                    responseCache.entrySet().stream()
                            .min(java.util.Comparator.comparing(e -> e.getValue().cachedAt()))
                            .ifPresent(oldest -> responseCache.remove(oldest.getKey()));
                }
                String cacheKey = buildCacheKey(opType, query, request.getCaseId());
                responseCache.put(cacheKey, new CachedEntry(
                        response, selectedModel, selectedMode,
                        LocalDateTime.now(),
                        opType.getCacheTtlDays()
                ));
                log.debug("Cached response for {} (TTL: {} days, cache size: {})", opType, opType.getCacheTtlDays(), responseCache.size());
            }

            return result;
        });
    }

    // ===== STREAMING ROUTING =====

    /**
     * Route a streaming AI request. No caching for streaming operations.
     */
    public void routeStreaming(
            AIRoutingRequest request,
            Consumer<String> tokenConsumer,
            Runnable onComplete,
            Consumer<Throwable> onError
    ) {
        AIOperationType opType = request.getOperationType();
        AIComplexityScorer.RoutingDecision decision = complexityScorer.decide(opType, request.getQuery());

        log.info("Routing streaming {} → model={}",
                opType, decision.modelId().contains("sonnet") ? "Sonnet" : "Opus");

        claudeService.generateCompletionStreamingWithModel(
                request.getQuery(),
                request.getSystemMessage(),
                request.getSessionId(),
                tokenConsumer,
                onComplete,
                onError,
                decision.modelId()
        );
    }

    // ===== CONVENIENCE METHODS =====

    /**
     * Quick route for simple operations. Builds the request internally.
     */
    public CompletableFuture<String> routeSimple(
            AIOperationType operationType,
            String query,
            String systemMessage,
            boolean useDeepThinking,
            Long sessionId
    ) {
        AIRoutingRequest request = AIRoutingRequest.builder()
                .operationType(operationType)
                .query(query)
                .systemMessage(systemMessage)
                .useDeepThinking(useDeepThinking)
                .sessionId(sessionId)
                .build();

        return route(request).thenApply(AIRoutingResult::getResponse);
    }

    /**
     * Quick route with temperature control.
     */
    public CompletableFuture<String> routeSimple(
            AIOperationType operationType,
            String query,
            String systemMessage,
            boolean useDeepThinking,
            Long sessionId,
            Double temperature
    ) {
        AIRoutingRequest request = AIRoutingRequest.builder()
                .operationType(operationType)
                .query(query)
                .systemMessage(systemMessage)
                .useDeepThinking(useDeepThinking)
                .sessionId(sessionId)
                .temperature(temperature)
                .build();

        return route(request).thenApply(AIRoutingResult::getResponse);
    }

    // ===== CACHE MANAGEMENT =====

    /**
     * Build a deterministic cache key from operation type, query, and context.
     */
    private String buildCacheKey(AIOperationType opType, String query, String caseId) {
        String raw = opType.name() + "|" + (query != null ? query.trim() : "") + "|" + (caseId != null ? caseId : "");
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            // Fallback to simple hash
            return String.valueOf(raw.hashCode());
        }
    }

    /**
     * Cleanup expired cache entries. Runs every hour.
     */
    @Scheduled(fixedRate = 3600000)
    public void cleanupExpiredCache() {
        int before = responseCache.size();
        responseCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
        int removed = before - responseCache.size();
        if (removed > 0) {
            log.info("Cache cleanup: removed {} expired entries ({} remaining)", removed, responseCache.size());
        }
    }

    /**
     * Get current cache statistics.
     */
    public Map<String, Object> getCacheStats() {
        long total = responseCache.size();
        long expired = responseCache.values().stream().filter(CachedEntry::isExpired).count();
        return Map.of(
                "totalEntries", total,
                "activeEntries", total - expired,
                "expiredEntries", expired
        );
    }

    /**
     * Clear all cached responses.
     */
    public void clearCache() {
        int size = responseCache.size();
        responseCache.clear();
        log.info("Router cache cleared ({} entries removed)", size);
    }

    // ===== INNER CLASSES =====

    private record CachedEntry(
            String response,
            String modelUsed,
            String modeUsed,
            LocalDateTime cachedAt,
            int ttlDays
    ) {
        boolean isExpired() {
            return LocalDateTime.now().isAfter(cachedAt.plusDays(ttlDays));
        }
    }
}
