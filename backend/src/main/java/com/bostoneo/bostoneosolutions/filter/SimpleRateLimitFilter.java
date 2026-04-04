package com.bostoneo.bostoneosolutions.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
public class SimpleRateLimitFilter extends OncePerRequestFilter {

    // General API rate limits
    private static final int MAX_REQUESTS_PER_MINUTE = 300;
    private static final int MAX_REQUESTS_PER_HOUR = 5000;
    // SECURITY: Stricter limits for sensitive auth endpoints
    private static final int AUTH_REQUESTS_PER_MINUTE = 10;

    private static final Set<String> AUTH_PATHS = Set.of(
        "/user/login", "/user/register", "/user/resetpassword",
        "/user/new/password", "/user/verify/code"
    );

    private final Map<String, RequestCounter> minuteCounters = new ConcurrentHashMap<>();
    private final Map<String, RequestCounter> hourCounters = new ConcurrentHashMap<>();
    private final Map<String, RequestCounter> authCounters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {

        String clientIp = getClientIp(request);
        String path = request.getRequestURI();

        // Clean up old entries periodically
        cleanupOldEntries();

        // SECURITY: Stricter rate limit for auth endpoints (by IP only, not by URI)
        if (isAuthPath(path)) {
            RequestCounter authCounter = authCounters.computeIfAbsent(clientIp,
                k -> new RequestCounter(Instant.now()));
            if (!authCounter.tryAcquire(Instant.now(), Duration.ofMinutes(1), AUTH_REQUESTS_PER_MINUTE)) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.getWriter().write("Too many authentication attempts. Please wait and try again.");
                log.warn("SECURITY: Auth rate limit exceeded for IP: {} on path: {}", clientIp, path);
                return;
            }
        }

        // General rate limit (by IP only — not URI, to prevent bypass via URL variations)
        String clientKey = clientIp;
        if (!isAllowed(clientKey)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.getWriter().write("Too many requests. Please try again later.");
            log.warn("Rate limit exceeded for client: {} on path: {}", clientIp, path);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAuthPath(String path) {
        return AUTH_PATHS.stream().anyMatch(path::startsWith);
    }

    private boolean isAllowed(String clientKey) {
        Instant now = Instant.now();

        RequestCounter minuteCounter = minuteCounters.computeIfAbsent(clientKey,
            k -> new RequestCounter(now));
        if (!minuteCounter.tryAcquire(now, Duration.ofMinutes(1), MAX_REQUESTS_PER_MINUTE)) {
            return false;
        }

        RequestCounter hourCounter = hourCounters.computeIfAbsent(clientKey,
            k -> new RequestCounter(now));
        if (!hourCounter.tryAcquire(now, Duration.ofHours(1), MAX_REQUESTS_PER_HOUR)) {
            return false;
        }

        return true;
    }

    /**
     * SECURITY: Use remoteAddr as primary (set by ALB/proxy), only use X-Forwarded-For
     * as fallback when remoteAddr is a known private/loopback address.
     */
    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();

        // Only trust X-Forwarded-For if the direct connection is from a known proxy (private IP)
        if (isPrivateIp(remoteAddr)) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                // Take the LAST non-private IP (the one added by our ALB, not the client)
                String[] ips = xForwardedFor.split(",");
                for (int i = ips.length - 1; i >= 0; i--) {
                    String ip = ips[i].trim();
                    if (!isPrivateIp(ip)) {
                        return ip;
                    }
                }
                return ips[0].trim();
            }
        }

        return remoteAddr;
    }

    private boolean isPrivateIp(String ip) {
        if (ip == null) return false;
        if (ip.startsWith("10.") || ip.startsWith("192.168.") ||
            ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) return true;
        if (ip.startsWith("172.")) {
            try { int s = Integer.parseInt(ip.split("\\.")[1]); return s >= 16 && s <= 31; }
            catch (Exception e) { return false; }
        }
        return false;
    }

    private void cleanupOldEntries() {
        Instant cutoffTime = Instant.now().minus(Duration.ofHours(2));

        minuteCounters.entrySet().removeIf(entry ->
            entry.getValue().getWindowStart().isBefore(cutoffTime));
        hourCounters.entrySet().removeIf(entry ->
            entry.getValue().getWindowStart().isBefore(cutoffTime));
        authCounters.entrySet().removeIf(entry ->
            entry.getValue().getWindowStart().isBefore(cutoffTime));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/public/") ||
               path.startsWith("/static/") ||
               path.equals("/health");
    }
    
    private static class RequestCounter {
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile Instant windowStart;
        
        public RequestCounter(Instant windowStart) {
            this.windowStart = windowStart;
        }
        
        /** Thread-safe check-and-increment: returns true if request is allowed */
        public synchronized boolean tryAcquire(Instant now, Duration windowDuration, int maxRequests) {
            if (now.isAfter(windowStart.plus(windowDuration))) {
                windowStart = now;
                count.set(0);
            }
            return count.getAndIncrement() < maxRequests;
        }
        
        public Instant getWindowStart() {
            return windowStart;
        }
    }
}