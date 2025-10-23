package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting service to prevent API abuse and control costs
 * Implements sliding window rate limiting per user
 */
@Service
@Slf4j
public class RateLimitService {

    // Rate limit configuration
    private static final int FAST_MODE_LIMIT_PER_HOUR = 100;
    private static final int THOROUGH_MODE_LIMIT_PER_HOUR = 20;
    private static final int FAST_MODE_LIMIT_PER_MINUTE = 10;
    private static final int THOROUGH_MODE_LIMIT_PER_MINUTE = 3;

    // User request tracking
    private static class RateLimitInfo {
        final ConcurrentHashMap<LocalDateTime, Integer> hourlyRequests = new ConcurrentHashMap<>();
        final ConcurrentHashMap<LocalDateTime, Integer> minuteRequests = new ConcurrentHashMap<>();
    }

    private final Map<Long, RateLimitInfo> userLimits = new ConcurrentHashMap<>();

    /**
     * Check if user can make a request in the specified mode
     * Returns true if allowed, false if rate limit exceeded
     */
    public boolean allowRequest(Long userId, String mode) {
        if (userId == null) {
            log.warn("⚠️ Rate limit check: No userId provided, allowing request");
            return true; // Allow anonymous requests but log them
        }

        RateLimitInfo limits = userLimits.computeIfAbsent(userId, k -> new RateLimitInfo());
        LocalDateTime now = LocalDateTime.now();

        // Cleanup old entries (older than 1 hour)
        cleanupOldEntries(limits, now);

        boolean isThorough = "THOROUGH".equalsIgnoreCase(mode);
        int hourlyLimit = isThorough ? THOROUGH_MODE_LIMIT_PER_HOUR : FAST_MODE_LIMIT_PER_HOUR;
        int minuteLimit = isThorough ? THOROUGH_MODE_LIMIT_PER_MINUTE : FAST_MODE_LIMIT_PER_MINUTE;

        // Check hourly limit
        int hourlyCount = countRequestsInWindow(limits.hourlyRequests, now, 60);
        if (hourlyCount >= hourlyLimit) {
            log.warn("🚫 RATE LIMIT EXCEEDED: User {} exceeded hourly {} limit ({}/{})",
                userId, mode, hourlyCount, hourlyLimit);
            return false;
        }

        // Check per-minute limit (burst protection)
        int minuteCount = countRequestsInWindow(limits.minuteRequests, now, 1);
        if (minuteCount >= minuteLimit) {
            log.warn("🚫 RATE LIMIT EXCEEDED: User {} exceeded per-minute {} limit ({}/{})",
                userId, mode, minuteCount, minuteLimit);
            return false;
        }

        // Record this request
        recordRequest(limits, now);

        log.debug("✓ Rate limit check passed: User {} {} mode ({}/{} hourly, {}/{} per min)",
            userId, mode, hourlyCount + 1, hourlyLimit, minuteCount + 1, minuteLimit);

        return true;
    }

    /**
     * Get remaining requests for a user
     */
    public Map<String, Integer> getRemainingRequests(Long userId, String mode) {
        if (userId == null) {
            return Map.of(
                "hourlyRemaining", 999,
                "minuteRemaining", 999,
                "hourlyLimit", 999,
                "minuteLimit", 999
            );
        }

        RateLimitInfo limits = userLimits.get(userId);
        if (limits == null) {
            boolean isThorough = "THOROUGH".equalsIgnoreCase(mode);
            int hourlyLimit = isThorough ? THOROUGH_MODE_LIMIT_PER_HOUR : FAST_MODE_LIMIT_PER_HOUR;
            int minuteLimit = isThorough ? THOROUGH_MODE_LIMIT_PER_MINUTE : FAST_MODE_LIMIT_PER_MINUTE;

            return Map.of(
                "hourlyRemaining", hourlyLimit,
                "minuteRemaining", minuteLimit,
                "hourlyLimit", hourlyLimit,
                "minuteLimit", minuteLimit
            );
        }

        LocalDateTime now = LocalDateTime.now();
        boolean isThorough = "THOROUGH".equalsIgnoreCase(mode);
        int hourlyLimit = isThorough ? THOROUGH_MODE_LIMIT_PER_HOUR : FAST_MODE_LIMIT_PER_HOUR;
        int minuteLimit = isThorough ? THOROUGH_MODE_LIMIT_PER_MINUTE : FAST_MODE_LIMIT_PER_MINUTE;

        int hourlyCount = countRequestsInWindow(limits.hourlyRequests, now, 60);
        int minuteCount = countRequestsInWindow(limits.minuteRequests, now, 1);

        return Map.of(
            "hourlyRemaining", Math.max(0, hourlyLimit - hourlyCount),
            "minuteRemaining", Math.max(0, minuteLimit - minuteCount),
            "hourlyLimit", hourlyLimit,
            "minuteLimit", minuteLimit
        );
    }

    /**
     * Reset rate limits for a user (admin function)
     */
    public void resetUserLimits(Long userId) {
        userLimits.remove(userId);
        log.info("🔄 Rate limits reset for user: {}", userId);
    }

    // === PRIVATE HELPER METHODS ===

    private void recordRequest(RateLimitInfo limits, LocalDateTime timestamp) {
        LocalDateTime hourKey = timestamp.withMinute(0).withSecond(0).withNano(0);
        LocalDateTime minuteKey = timestamp.withSecond(0).withNano(0);

        limits.hourlyRequests.merge(hourKey, 1, Integer::sum);
        limits.minuteRequests.merge(minuteKey, 1, Integer::sum);
    }

    private int countRequestsInWindow(Map<LocalDateTime, Integer> requests, LocalDateTime now, int windowMinutes) {
        LocalDateTime cutoff = now.minusMinutes(windowMinutes);

        return requests.entrySet().stream()
            .filter(entry -> entry.getKey().isAfter(cutoff))
            .mapToInt(Map.Entry::getValue)
            .sum();
    }

    private void cleanupOldEntries(RateLimitInfo limits, LocalDateTime now) {
        LocalDateTime hourlyCutoff = now.minusHours(2);
        LocalDateTime minuteCutoff = now.minusMinutes(5);

        limits.hourlyRequests.entrySet()
            .removeIf(entry -> entry.getKey().isBefore(hourlyCutoff));

        limits.minuteRequests.entrySet()
            .removeIf(entry -> entry.getKey().isBefore(minuteCutoff));
    }

    /**
     * Get rate limit configuration for display
     */
    public Map<String, Object> getRateLimitConfig() {
        return Map.of(
            "fastMode", Map.of(
                "hourlyLimit", FAST_MODE_LIMIT_PER_HOUR,
                "minuteLimit", FAST_MODE_LIMIT_PER_MINUTE
            ),
            "thoroughMode", Map.of(
                "hourlyLimit", THOROUGH_MODE_LIMIT_PER_HOUR,
                "minuteLimit", THOROUGH_MODE_LIMIT_PER_MINUTE
            ),
            "message", "Rate limits help control costs and ensure fair usage"
        );
    }
}
