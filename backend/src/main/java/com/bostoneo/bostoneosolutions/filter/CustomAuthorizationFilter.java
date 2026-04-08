package com.bostoneo.bostoneosolutions.filter;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.exceptions.TokenExpiredException;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.provider.TokenProvider;
import com.bostoneo.bostoneosolutions.service.OnlineUserService;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

import static com.bostoneo.bostoneosolutions.constant.Constants.*;
import static com.bostoneo.bostoneosolutions.utils.ExceptionUtils.processError;
import static java.util.Arrays.asList;
import static java.util.Optional.ofNullable;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;

@Component
@RequiredArgsConstructor
@Slf4j
public class CustomAuthorizationFilter extends OncePerRequestFilter {

    private final TokenProvider tokenProvider;
    private final com.bostoneo.bostoneosolutions.service.TokenBlacklistService tokenBlacklistService;
    private final OnlineUserService onlineUserService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        try {
            String requestURI = request.getRequestURI();
            String token = getToken(request);

            if (token == null) {
                // Log which request came without a token (helps debug anonymousUser issues)
                log.debug("Request without token: {} {} - will be handled by Spring Security rules",
                    request.getMethod(), maskPath(requestURI));
                SecurityContextHolder.clearContext();
                filterChain.doFilter(request, response);
                return;
            }

            Long userId = getUserId(request);

            boolean isTokenValid = tokenProvider.isTokenValid(userId, token);

            // Check token blacklist (logout/password change)
            if (isTokenValid && tokenBlacklistService.isTokenBlacklisted(token)) {
                log.warn("Blacklisted token used for user {}", userId);
                isTokenValid = false;
            }
            if (isTokenValid) {
                long tokenIssuedAt = tokenProvider.getIssuedAt(token);
                if (tokenBlacklistService.isUserTokenBlacklisted(userId, tokenIssuedAt)) {
                    log.warn("Token issued before password change used for user {}", userId);
                    isTokenValid = false;
                }
            }

            if (isTokenValid){
                Long organizationId = tokenProvider.getOrganizationId(token);
                List<GrantedAuthority> authorities = tokenProvider.getAuthorities(token);

                if (organizationId == null) {
                    // SUPERADMIN users have no org — allow them through without tenant context
                    boolean isSuperAdmin = authorities.stream()
                        .anyMatch(a -> "ROLE_SUPERADMIN".equals(a.getAuthority()));
                    if (!isSuperAdmin) {
                        log.error("Token missing organizationId for non-SUPERADMIN user {}. User needs to re-login.", userId);
                        throw new ApiException("Session invalid. Please login again.");
                    }
                    log.debug("REQUEST: {} {} - SUPERADMIN User: {}", request.getMethod(), request.getRequestURI(), userId);
                } else {
                    TenantContext.setCurrentTenant(organizationId);
                    log.debug("REQUEST: {} {} - User: {}, Org: {}", request.getMethod(), request.getRequestURI(), userId, organizationId);
                }

                Authentication authentication = tokenProvider.getAuthentication(userId, authorities, request);
                SecurityContextHolder.getContext().setAuthentication(authentication);
                onlineUserService.markOnline(userId, organizationId);
            } else {
                log.warn("Token invalid for user {}, clearing SecurityContext", userId);
                SecurityContextHolder.clearContext();
            }
            filterChain.doFilter(request, response);
        } catch (TokenExpiredException exception) {
            // Expected error - user's session expired, log at WARN level without stack trace
            log.warn("Token expired for request {} - user needs to re-authenticate",
                maskPath(request.getRequestURI()));
            processError(request, response, exception);
        } catch (JWTVerificationException exception) {
            // Token validation failed - could be tampering or corruption
            log.warn("JWT verification failed for request {}: {}",
                maskPath(request.getRequestURI()), exception.getMessage());
            processError(request, response, exception);
        } catch (Exception exception) {
            // Unexpected error - log full details for debugging
            log.error("Authorization error for {}: {}",
                maskPath(request.getRequestURI()), exception.getMessage());
            processError(request, response, exception);
        } finally {
            // Always clear tenant context after request to prevent memory leaks
            TenantContext.clear();
        }
    }

    private Long getUserId(HttpServletRequest request) {
        return tokenProvider.getSubject(getToken(request), request);
    }

    private String getToken(HttpServletRequest request) {
        // 1. Check Authorization header (standard path)
        String headerToken = ofNullable(request.getHeader(AUTHORIZATION))
                .filter(header -> header.startsWith(TOKEN_PREFIX))
                .map(token -> token.replace(TOKEN_PREFIX, EMPTY))
                .orElse(null);
        if (headerToken != null) return headerToken;

        // 2. Fallback: check "token" query parameter ONLY for SSE endpoints
        //    (EventSource browser API cannot send Authorization headers)
        if (isSseEndpoint(request)) {
            String queryToken = ofNullable(request.getParameter("token"))
                    .filter(t -> !t.isBlank())
                    .orElse(null);
            if (queryToken != null) {
                log.debug("Using query parameter token for {} {}", request.getMethod(), request.getRequestURI());
            }
            return queryToken;
        }
        return null;
    }

    /** SSE endpoints that require query-param token auth (EventSource can't send headers) */
    private boolean isSseEndpoint(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.contains("/drafts/stream") || uri.contains("/progress-stream");
    }


    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        // CRITICAL: Skip filter for async dispatch (response writing)
        // When DeferredResult/CompletableFuture completes, Spring dispatches to write the response
        // on a new thread. This dispatch doesn't have the original Authorization header and would
        // fail with "anonymousUser" without this check.
        if (request.getDispatcherType() == DispatcherType.ASYNC) {
            return true;
        }

        // Skip WebSocket upgrade requests (WebSocket has its own token validation)
        String upgrade = request.getHeader("Upgrade");
        if ("websocket".equalsIgnoreCase(upgrade) || request.getRequestURI().startsWith("/ws")) {
            return true;
        }

        // Always skip OPTIONS and public routes
        if (request.getMethod().equalsIgnoreCase(HTTP_OPTIONS_METHOD) || asList(PUBLIC_ROUTES).contains(request.getRequestURI())) {
            return true;
        }

        // Skip if no token from any source (header or SSE query param)
        boolean hasHeaderToken = request.getHeader(AUTHORIZATION) != null && request.getHeader(AUTHORIZATION).startsWith(TOKEN_PREFIX);
        boolean hasQueryToken = isSseEndpoint(request) && request.getParameter("token") != null && !request.getParameter("token").isBlank();
        return !hasHeaderToken && !hasQueryToken;
    }

    /**
     * Mask sensitive path parameters in logs (e.g., IDs, tokens)
     */
    private String maskPath(String path) {
        if (path == null) return "unknown";
        // Mask numeric IDs in paths for privacy
        return path.replaceAll("/\\d+", "/{id}");
    }
}