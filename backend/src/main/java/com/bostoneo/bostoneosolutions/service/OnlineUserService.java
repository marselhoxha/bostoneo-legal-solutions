package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Tracks which users are currently online using Redis keys with TTL.
 * Every authenticated HTTP request refreshes the user's key with a 5-minute TTL.
 * If no requests arrive within 5 minutes, the key expires and the user is considered offline.
 *
 * Note: Uses Redis KEYS command for counting, which is safe for < 1000 concurrent users.
 * If the platform scales beyond that, replace with SCAN or a Redis SET-based approach.
 */
@Service
@Slf4j
public class OnlineUserService {

    private static final String PREFIX = "online:user:";
    private static final long TTL_MINUTES = 5;
    private static final Duration DEBOUNCE = Duration.ofSeconds(60);

    private final StringRedisTemplate redisTemplate;
    private final ConcurrentHashMap<Long, Instant> recentMarks = new ConcurrentHashMap<>();

    public OnlineUserService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Check if Redis is reachable. Used to decide whether to fall back to SQL-based session counting.
     */
    public boolean isAvailable() {
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Mark a user as online. Called from the JWT authorization filter on every authenticated request.
     * Debounces writes so we only hit Redis once per user per 60 seconds.
     */
    public void markOnline(Long userId, Long organizationId) {
        Instant lastMark = recentMarks.get(userId);
        if (lastMark != null && lastMark.plus(DEBOUNCE).isAfter(Instant.now())) {
            return; // Recently marked, skip Redis write
        }
        try {
            String key = PREFIX + userId;
            String value = organizationId != null ? organizationId.toString() : "platform";
            redisTemplate.opsForValue().set(key, value, Duration.ofMinutes(TTL_MINUTES));
            recentMarks.put(userId, Instant.now());
        } catch (Exception e) {
            log.debug("Redis unavailable — skipping online mark for user {}", userId);
        }
    }

    /**
     * Mark a user as offline (e.g., on logout). Removes the Redis key immediately.
     */
    public void markOffline(Long userId) {
        try {
            redisTemplate.delete(PREFIX + userId);
            recentMarks.remove(userId);
        } catch (Exception e) {
            log.debug("Redis unavailable — skipping offline mark for user {}", userId);
        }
    }

    /**
     * Count of currently online users (keys that haven't expired).
     */
    public int getOnlineUserCount() {
        try {
            Set<String> keys = redisTemplate.keys(PREFIX + "*");
            return keys != null ? keys.size() : 0;
        } catch (Exception e) {
            log.warn("Failed to get online user count: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * List of currently online user IDs.
     */
    public List<Long> getOnlineUserIds() {
        try {
            Set<String> keys = redisTemplate.keys(PREFIX + "*");
            if (keys == null || keys.isEmpty()) return Collections.emptyList();
            return keys.stream()
                    .map(k -> k.replace(PREFIX, ""))
                    .filter(s -> s.matches("\\d+"))
                    .map(Long::parseLong)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to get online user IDs: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Check if a specific user is currently online.
     */
    public boolean isUserOnline(Long userId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + userId));
        } catch (Exception e) {
            log.warn("Failed to check online status for user {}: {}", userId, e.getMessage());
            return false;
        }
    }
}
