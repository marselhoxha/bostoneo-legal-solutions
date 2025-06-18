package com.***REMOVED***.***REMOVED***solutions.filter;

import com.***REMOVED***.***REMOVED***solutions.provider.TokenProvider;
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

import static com.***REMOVED***.***REMOVED***solutions.constant.Constants.*;
import static com.***REMOVED***.***REMOVED***solutions.utils.ExceptionUtils.processError;
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
            log.info("🔍 AUTHORIZATION FILTER DEBUG for: {} {}", request.getMethod(), request.getRequestURI());
            
            String token = getToken(request);
            log.info("- Token extracted: {}", token != null ? "YES (length: " + token.length() + ")" : "NO");
            
            if (token == null) {
                log.warn("- No valid token found, clearing security context");
                SecurityContextHolder.clearContext();
                filterChain.doFilter(request, response);
                return;
            }
            
            Long userId = getUserId(request);
            log.info("- User ID from token: {}", userId);
            
            boolean isTokenValid = tokenProvider.isTokenValid(userId, token);
            log.info("- Token valid: {}", isTokenValid);
            
            if (isTokenValid){
                List<GrantedAuthority> authorities = tokenProvider.getAuthorities(token);
                log.info("- Authorities from token: {}", authorities.size());
                authorities.forEach(auth -> log.info("  - Authority: {}", auth.getAuthority()));
                
                // Log billing-specific authorities
                boolean hasBillingView = authorities.stream().anyMatch(a -> a.getAuthority().equals("BILLING:VIEW"));
                boolean hasBillingEdit = authorities.stream().anyMatch(a -> a.getAuthority().equals("BILLING:EDIT"));
                log.info("- Has BILLING:VIEW: {}", hasBillingView);
                log.info("- Has BILLING:EDIT: {}", hasBillingEdit);
                
                Authentication authentication = tokenProvider.getAuthentication(userId, authorities, request);
                SecurityContextHolder.getContext().setAuthentication(authentication);
                log.info("- Authentication set in SecurityContext");
                
                // Log the authentication authorities
                log.info("- SecurityContext authorities: {}", authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(java.util.stream.Collectors.toList()));
            } else { 
                log.warn("- Token invalid, clearing SecurityContext");
                SecurityContextHolder.clearContext();
            }
            filterChain.doFilter(request, response);
        } catch (Exception exception){
            log.error("🚨 AUTHORIZATION FILTER ERROR: {}", exception.getMessage(), exception);
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
        return request.getHeader(AUTHORIZATION) == null || !request.getHeader(AUTHORIZATION).startsWith(TOKEN_PREFIX)
            || request.getMethod().equalsIgnoreCase(HTTP_OPTIONS_METHOD) || asList(PUBLIC_ROUTES).contains(request.getRequestURI());
    }
}
