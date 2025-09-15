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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
public class SimpleRateLimitFilter extends OncePerRequestFilter {
    
    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    private static final int MAX_REQUESTS_PER_HOUR = 1000;
    
    private final Map<String, RequestCounter> minuteCounters = new ConcurrentHashMap<>();
    private final Map<String, RequestCounter> hourCounters = new ConcurrentHashMap<>();
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                  HttpServletResponse response, 
                                  FilterChain filterChain) throws ServletException, IOException {
        
        String clientKey = getClientKey(request);
        
        // Clean up old entries periodically
        cleanupOldEntries();
        
        // Check rate limits
        if (!isAllowed(clientKey)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.getWriter().write("Too many requests. Please try again later.");
            log.warn("Rate limit exceeded for client: {} on path: {}", clientKey, request.getRequestURI());
            return;
        }
        
        filterChain.doFilter(request, response);
    }
    
    private boolean isAllowed(String clientKey) {
        Instant now = Instant.now();
        
        // Check minute limit
        RequestCounter minuteCounter = minuteCounters.computeIfAbsent(clientKey, 
            k -> new RequestCounter(now));
        if (!minuteCounter.isAllowed(now, Duration.ofMinutes(1), MAX_REQUESTS_PER_MINUTE)) {
            return false;
        }
        
        // Check hour limit
        RequestCounter hourCounter = hourCounters.computeIfAbsent(clientKey, 
            k -> new RequestCounter(now));
        if (!hourCounter.isAllowed(now, Duration.ofHours(1), MAX_REQUESTS_PER_HOUR)) {
            return false;
        }
        
        // Increment counters
        minuteCounter.increment();
        hourCounter.increment();
        
        return true;
    }
    
    private String getClientKey(HttpServletRequest request) {
        String clientIp = getClientIp(request);
        return clientIp + ":" + request.getRequestURI();
    }
    
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }
    
    private void cleanupOldEntries() {
        Instant cutoffTime = Instant.now().minus(Duration.ofHours(2));
        
        minuteCounters.entrySet().removeIf(entry -> 
            entry.getValue().getWindowStart().isBefore(cutoffTime));
        hourCounters.entrySet().removeIf(entry -> 
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
        
        public boolean isAllowed(Instant now, Duration windowDuration, int maxRequests) {
            if (now.isAfter(windowStart.plus(windowDuration))) {
                // Reset window
                windowStart = now;
                count.set(0);
            }
            return count.get() < maxRequests;
        }
        
        public void increment() {
            count.incrementAndGet();
        }
        
        public Instant getWindowStart() {
            return windowStart;
        }
    }
}