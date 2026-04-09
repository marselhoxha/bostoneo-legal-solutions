package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenBlacklistService {

    private static final String BLACKLIST_PREFIX = "token:blacklist:";
    private static final String USER_BLACKLIST_PREFIX = "token:user-blacklist:";

    private final StringRedisTemplate redisTemplate;

    // Track whether Redis was ever successfully connected
    // If Redis was never available (local dev), fail open; if it went down (production outage), fail closed
    private volatile boolean redisEverConnected = false;

    /** In-memory fallback for user token blacklisting when Redis is unavailable.
     *  Maps userId → timestamp (millis) when all tokens were invalidated. */
    private static final ConcurrentHashMap<Long, Long> memoryBlacklist = new ConcurrentHashMap<>();

    /**
     * Blacklist a specific token (e.g., on logout)
     */
    public void blacklistToken(String token, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(BLACKLIST_PREFIX + token, "1", ttl);
            redisEverConnected = true;
            log.debug("Token blacklisted, expires in {}", ttl);
        } catch (Exception e) {
            log.error("Failed to blacklist token: {}", e.getMessage());
        }
    }

    /**
     * Blacklist all tokens for a user issued before now (e.g., on password change).
     */
    public void blacklistAllUserTokens(Long userId) {
        long now = System.currentTimeMillis();
        // Always write to in-memory fallback (works without Redis)
        memoryBlacklist.put(userId, now);
        // Also try Redis for cross-instance consistency
        try {
            redisTemplate.opsForValue().set(USER_BLACKLIST_PREFIX + userId, String.valueOf(now), Duration.ofHours(8));
            redisEverConnected = true;
            log.info("All tokens blacklisted for user {} (Redis + memory)", userId);
        } catch (Exception e) {
            log.warn("Redis unavailable — tokens blacklisted in memory only for user {}", userId);
        }
    }

    /**
     * SECURITY: If Redis was previously working and went down (production outage), fail closed.
     * If Redis was never available (local dev without Redis), fail open to avoid blocking all auth.
     */
    public boolean isTokenBlacklisted(String token) {
        try {
            boolean result = Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + token));
            redisEverConnected = true;
            return result;
        } catch (Exception e) {
            if (redisEverConnected) {
                log.error("SECURITY: Redis went down — failing closed (denying access): {}", e.getMessage());
                return true;
            }
            log.trace("Redis not available (not started) — skipping blacklist check: {}", e.getMessage());
            return false;
        }
    }

    /**
     * SECURITY: Same fail-closed/fail-open logic as isTokenBlacklisted
     */
    public boolean isUserTokenBlacklisted(Long userId, long tokenIssuedAtMillis) {
        // Check in-memory blacklist first (always available)
        Long memoryTimestamp = memoryBlacklist.get(userId);
        if (memoryTimestamp != null) {
            log.info("Memory blacklist check for user {}: tokenIssued={}, blacklistAt={}, blocked={}",
                userId, tokenIssuedAtMillis, memoryTimestamp, tokenIssuedAtMillis < memoryTimestamp);
            if (tokenIssuedAtMillis < memoryTimestamp) {
                return true;
            }
        }
        // Then check Redis
        try {
            String blacklistTimestamp = redisTemplate.opsForValue().get(USER_BLACKLIST_PREFIX + userId);
            redisEverConnected = true;
            if (blacklistTimestamp == null) return false;
            return tokenIssuedAtMillis < Long.parseLong(blacklistTimestamp);
        } catch (Exception e) {
            if (redisEverConnected) {
                log.error("SECURITY: Redis went down — failing closed (denying access): {}", e.getMessage());
                return true;
            }
            // Redis never connected — memory check already done above
            return false;
        }
    }
}
