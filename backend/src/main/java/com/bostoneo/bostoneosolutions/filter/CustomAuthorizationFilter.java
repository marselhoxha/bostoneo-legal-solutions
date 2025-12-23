package com.bostoneo.bostoneosolutions.filter;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.exceptions.TokenExpiredException;
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
            
            String token = getToken(request);
            
            if (token == null) {
                log.warn("- No valid token found, clearing security context");
                SecurityContextHolder.clearContext();
                filterChain.doFilter(request, response);
                return;
            }
            
            Long userId = getUserId(request);
            
            boolean isTokenValid = tokenProvider.isTokenValid(userId, token);
            
            if (isTokenValid){
                List<GrantedAuthority> authorities = tokenProvider.getAuthorities(token);
                
                
                // Log billing-specific authorities
                boolean hasBillingView = authorities.stream().anyMatch(a -> a.getAuthority().equals("BILLING:VIEW"));
                boolean hasBillingEdit = authorities.stream().anyMatch(a -> a.getAuthority().equals("BILLING:EDIT"));
                
                Authentication authentication = tokenProvider.getAuthentication(userId, authorities, request);
                SecurityContextHolder.getContext().setAuthentication(authentication);
                
                
            } else { 
                log.warn("- Token invalid, clearing SecurityContext");
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
        // Skip WebSocket upgrade requests
        String upgrade = request.getHeader("Upgrade");
        if ("websocket".equalsIgnoreCase(upgrade) || request.getRequestURI().startsWith("/ws")) {
            return true;
        }
        
        // Skip CRM endpoints - they are handled by Spring Security permitAll()
        if (request.getRequestURI().startsWith("/api/crm/")) {
            return true;
        }
        
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