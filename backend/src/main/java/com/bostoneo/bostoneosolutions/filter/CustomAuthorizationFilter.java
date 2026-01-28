package com.bostoneo.bostoneosolutions.filter;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.exceptions.TokenExpiredException;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.provider.TokenProvider;
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

            if (isTokenValid){
                // IMPORTANT: Set tenant context BEFORE calling getAuthentication()
                // because getAuthentication() calls userService.getUserById() which requires org context
                Long organizationId = tokenProvider.getOrganizationId(token);
                log.debug("Extracted organizationId from token: {} for user: {}", organizationId, userId);

                if (organizationId == null) {
                    log.error("Token missing organizationId for user {}. User needs to re-login.", userId);
                    throw new ApiException("Session invalid. Please login again.");
                }

                TenantContext.setCurrentTenant(organizationId);
                log.debug("Set tenant context to org: {} for user: {}", organizationId, userId);

                List<GrantedAuthority> authorities = tokenProvider.getAuthorities(token);
                Authentication authentication = tokenProvider.getAuthentication(userId, authorities, request);
                SecurityContextHolder.getContext().setAuthentication(authentication);
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
        return ofNullable(request.getHeader(AUTHORIZATION))
                .filter(header -> header.startsWith(TOKEN_PREFIX))
                .map(token -> token.replace(TOKEN_PREFIX, EMPTY))
                .orElse(null);
    }


    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        // Skip WebSocket upgrade requests (WebSocket has its own token validation)
        String upgrade = request.getHeader("Upgrade");
        if ("websocket".equalsIgnoreCase(upgrade) || request.getRequestURI().startsWith("/ws")) {
            return true;
        }

        // Only skip for requests without Authorization header, OPTIONS, or public routes
        // All authenticated endpoints (including /api/crm/) must go through the filter
        return request.getHeader(AUTHORIZATION) == null || !request.getHeader(AUTHORIZATION).startsWith(TOKEN_PREFIX)
            || request.getMethod().equalsIgnoreCase(HTTP_OPTIONS_METHOD) || asList(PUBLIC_ROUTES).contains(request.getRequestURI());
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