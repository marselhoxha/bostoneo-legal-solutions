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

    /**
     * Blacklist a specific token (e.g., on logout)
     */
    public void blacklistToken(String token, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(BLACKLIST_PREFIX + token, "1", ttl);
            log.debug("Token blacklisted, expires in {}", ttl);
        } catch (Exception e) {
            log.error("Failed to blacklist token: {}", e.getMessage());
        }
    }

    /**
     * Blacklist all tokens for a user issued before now (e.g., on password change).
     * Stores a timestamp; any token issued before this time is invalid.
     */
    public void blacklistAllUserTokens(Long userId) {
        try {
            String timestamp = String.valueOf(System.currentTimeMillis());
            // TTL matches max refresh token lifetime (8 hours)
            redisTemplate.opsForValue().set(USER_BLACKLIST_PREFIX + userId, timestamp, Duration.ofHours(8));
            log.info("All tokens blacklisted for user {}", userId);
        } catch (Exception e) {
            log.error("Failed to blacklist user tokens for {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Check if a specific token is blacklisted
     */
    public boolean isTokenBlacklisted(String token) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + token));
        } catch (Exception e) {
            log.error("Failed to check token blacklist: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Check if a token was issued before the user's blacklist timestamp
     */
    public boolean isUserTokenBlacklisted(Long userId, long tokenIssuedAtMillis) {
        try {
            String blacklistTimestamp = redisTemplate.opsForValue().get(USER_BLACKLIST_PREFIX + userId);
            if (blacklistTimestamp == null) return false;
            return tokenIssuedAtMillis < Long.parseLong(blacklistTimestamp);
        } catch (Exception e) {
            log.error("Failed to check user token blacklist: {}", e.getMessage());
            return false;
        }
    }
}
