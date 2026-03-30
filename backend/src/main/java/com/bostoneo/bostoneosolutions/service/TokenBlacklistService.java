package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

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
        try {
            String timestamp = String.valueOf(System.currentTimeMillis());
            redisTemplate.opsForValue().set(USER_BLACKLIST_PREFIX + userId, timestamp, Duration.ofHours(8));
            redisEverConnected = true;
            log.info("All tokens blacklisted for user {}", userId);
        } catch (Exception e) {
            log.error("Failed to blacklist user tokens for {}: {}", userId, e.getMessage());
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
            log.warn("Redis not available (not started) — skipping blacklist check: {}", e.getMessage());
            return false;
        }
    }

    /**
     * SECURITY: Same fail-closed/fail-open logic as isTokenBlacklisted
     */
    public boolean isUserTokenBlacklisted(Long userId, long tokenIssuedAtMillis) {
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
            log.warn("Redis not available (not started) — skipping blacklist check: {}", e.getMessage());
            return false;
        }
    }
}
