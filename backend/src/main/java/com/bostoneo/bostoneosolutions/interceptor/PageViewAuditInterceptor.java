package com.bostoneo.bostoneosolutions.interceptor;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.AuditLog;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Interceptor that auto-logs page-level navigation for authenticated users.
 * Fires on key GET endpoints that represent "opening a page" — avoids duplicate
 * logging by debouncing per user+path (max 1 entry per 60 seconds per path).
 * <p>
 * This is much more scalable than adding @AuditLog to every controller method.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PageViewAuditInterceptor implements HandlerInterceptor {

    private final AuditLogService auditLogService;

    /** Debounce map: "userId:path" → last log timestamp (epoch millis) */
    private final ConcurrentHashMap<String, Long> recentLogs = new ConcurrentHashMap<>();
    private static final long DEBOUNCE_MS = 60_000; // 1 minute per user+path

    /**
     * Page-level patterns. Each entry has a regex pattern, entity type, and description.
     * Debouncing uses the description as key (not the full URL) so variants like
     * /legal-case/get/1 and /legal-case/get/2 both debounce as "Viewed case details".
     */
    private static final PageRule[] PAGE_RULES = {
        // Core detail pages (single entity views — the most valuable to track)
        new PageRule("/legal-case/get/\\d+$", AuditLog.EntityType.LEGAL_CASE, "Viewed case details"),
        new PageRule("/client/get/\\d+$", AuditLog.EntityType.CLIENT, "Viewed client details"),
        new PageRule("/api/invoices/\\d+$", AuditLog.EntityType.INVOICE, "Viewed invoice"),

        // Tasks — only the list endpoint (not sub-resources like /tasks/{id}/comments)
        new PageRule("/api/legal/tasks$", AuditLog.EntityType.TASK, "Viewed tasks"),
        new PageRule("/api/legal/tasks\\?", AuditLog.EntityType.TASK, "Viewed tasks"),

        // CRM: leads, intake (anchored to prevent matching sub-paths like /leads/123/activities)
        new PageRule("/api/crm/leads$", AuditLog.EntityType.LEAD, "Viewed leads"),
        new PageRule("/api/crm/leads\\?", AuditLog.EntityType.LEAD, "Viewed leads"),
        new PageRule("/api/crm/intake-submissions$", AuditLog.EntityType.CLIENT, "Viewed intake submissions"),
        new PageRule("/api/crm/intake-submissions\\?", AuditLog.EntityType.CLIENT, "Viewed intake submissions"),

        // AI / LegiSpace (list views only — detail views handled by @AuditLog annotations)
        new PageRule("/api/legal/ai-workspace/documents$", AuditLog.EntityType.AI_WORKSPACE, "Viewed LegiSpace"),
        new PageRule("/api/legal/ai-workspace/documents\\?", AuditLog.EntityType.AI_WORKSPACE, "Viewed LegiSpace"),
        new PageRule("/api/legal/research/conversations$", AuditLog.EntityType.LEGAL_RESEARCH, "Viewed research conversations"),
        new PageRule("/api/legal/research/conversations\\?", AuditLog.EntityType.LEGAL_RESEARCH, "Viewed research conversations"),

        // Dashboard
        new PageRule("/api/dashboard$", AuditLog.EntityType.ANALYTICS, "Viewed dashboard"),
        new PageRule("/api/dashboard\\?", AuditLog.EntityType.ANALYTICS, "Viewed dashboard"),

        // File manager
        new PageRule("/api/file-manager/cases/\\d+", AuditLog.EntityType.FILE_MANAGER, "Viewed case files"),

        // Expenses
        new PageRule("/api/expenses$", AuditLog.EntityType.EXPENSE, "Viewed expenses"),
        new PageRule("/api/expenses\\?", AuditLog.EntityType.EXPENSE, "Viewed expenses"),

        // Communications
        new PageRule("/api/communications$", AuditLog.EntityType.EMAIL, "Viewed communications"),
        new PageRule("/api/communications\\?", AuditLog.EntityType.EMAIL, "Viewed communications"),
    };

    /** Compiled regex patterns (initialized once) */
    private static final java.util.regex.Pattern[] COMPILED_PATTERNS;
    static {
        COMPILED_PATTERNS = new java.util.regex.Pattern[PAGE_RULES.length];
        for (int i = 0; i < PAGE_RULES.length; i++) {
            COMPILED_PATTERNS[i] = java.util.regex.Pattern.compile(PAGE_RULES[i].pattern);
        }
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // Only track GET requests (page views, not mutations)
        if (!"GET".equals(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        String queryString = request.getQueryString();
        String fullPath = queryString != null ? path + "?" + queryString : path;

        // Find matching page rule via regex
        PageRule matchedRule = null;
        for (int i = 0; i < PAGE_RULES.length; i++) {
            if (COMPILED_PATTERNS[i].matcher(fullPath).find()) {
                matchedRule = PAGE_RULES[i];
                break;
            }
        }

        if (matchedRule == null) {
            return true; // Not a tracked page
        }

        // Get authenticated user
        Long userId = null;
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
                Object principal = auth.getPrincipal();
                if (principal instanceof UserDTO userDTO) {
                    userId = userDTO.getId();
                }
            }
        } catch (Exception e) {
            return true;
        }

        if (userId == null) {
            return true;
        }

        // Debounce by user + page type (description), not full URL.
        // This means /legal-case/get/1 and /legal-case/get/2 both debounce as one "Viewed case details".
        String debounceKey = userId + ":" + matchedRule.description;
        long now = System.currentTimeMillis();
        Long lastLog = recentLogs.get(debounceKey);
        if (lastLog != null && (now - lastLog) < DEBOUNCE_MS) {
            return true;
        }
        recentLogs.put(debounceKey, now);

        // Clean up old entries periodically (every 1000 entries)
        if (recentLogs.size() > 1000) {
            recentLogs.entrySet().removeIf(e -> (now - e.getValue()) > DEBOUNCE_MS * 5);
        }

        // Log asynchronously
        final Long finalUserId = userId;
        final Long orgId = TenantContext.getCurrentTenant();
        final PageRule info = matchedRule;
        final String ip = extractIp(request);
        final String ua = request.getHeader("User-Agent");

        CompletableFuture.runAsync(() -> {
            try {
                auditLogService.log(finalUserId, orgId, AuditLog.AuditAction.VIEW, info.entityType,
                    null, info.description, "{}", ip, ua);
            } catch (Exception ex) {
                log.debug("Failed to log page view: {}", ex.getMessage());
            }
        });

        return true;
    }

    private String extractIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty() && isPrivateIp(remoteAddr)) {
            return xff.split(",")[0].trim();
        }
        return remoteAddr;
    }

    private boolean isPrivateIp(String ip) {
        if (ip == null) return false;
        return ip.startsWith("10.") || ip.startsWith("192.168.") ||
            ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1");
    }

    record PageRule(String pattern, AuditLog.EntityType entityType, String description) {}
}
