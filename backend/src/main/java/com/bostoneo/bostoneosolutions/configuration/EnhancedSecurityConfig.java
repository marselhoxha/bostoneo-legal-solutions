package com.bostoneo.bostoneosolutions.configuration;

import com.bostoneo.bostoneosolutions.filter.CustomAuthorizationFilter;
import com.bostoneo.bostoneosolutions.handler.CustomAccessDeniedHandler;
import com.bostoneo.bostoneosolutions.handler.CustomAuthenticationEntryPoint;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
// CSRF fully disabled — CookieCsrfTokenRepository no longer needed
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.XXssProtectionHeaderWriter;

import static com.bostoneo.bostoneosolutions.constant.Constants.PUBLIC_URLS;
import static org.springframework.http.HttpMethod.OPTIONS;
import static org.springframework.security.config.http.SessionCreationPolicy.STATELESS;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class EnhancedSecurityConfig {
    
    private final CustomAccessDeniedHandler customAccessDeniedHandler;
    private final CustomAuthenticationEntryPoint customAuthenticationEntryPoint;
    private final CustomAuthorizationFilter customAuthorizationFilter;
    private final BCryptPasswordEncoder passwordEncoder;
    private final UserDetailsService userDetailsService;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Security Headers
        http.headers(headers -> headers
            // Strict Transport Security
            .httpStrictTransportSecurity(hsts -> hsts
                .includeSubDomains(true)
                .maxAgeInSeconds(31536000)
                .preload(true)
            )
            // Content Security Policy - allow framing from configured origins for PDF preview
            .contentSecurityPolicy(csp -> csp
                .policyDirectives(buildCspPolicy())
            )
            // Frame Options - SAMEORIGIN as fallback for older browsers (CSP frame-ancestors is primary)
            .frameOptions(frame -> frame.sameOrigin())
            // Content Type Options - prevent MIME sniffing
            .contentTypeOptions(contentType -> {})
            // XSS Protection
            .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
            // Referrer Policy
            .referrerPolicy(referrer -> referrer
                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
            )
            // Permissions Policy
            .permissionsPolicy(permissions -> permissions
                .policy("geolocation=(), microphone=(), camera=()")
            )
        );
        
        // CSRF disabled — this is a stateless JWT API with no browser session cookies.
        // JWT Bearer tokens are immune to CSRF attacks by design (not auto-attached by browsers).
        // The previous per-path ignoringRequestMatchers approach was incomplete and caused 405 errors
        // on production POST endpoints that didn't match the ignore patterns correctly.
        http.csrf(csrf -> csrf.disable());
        
        // CORS Configuration
        http.cors(cors -> cors.configurationSource(request -> {
            var corsConfig = new org.springframework.web.cors.CorsConfiguration();
            corsConfig.setAllowedOrigins(java.util.Arrays.asList(allowedOrigins.split(",")));
            corsConfig.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
            corsConfig.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "Cache-Control", "X-XSRF-TOKEN"));
            corsConfig.setExposedHeaders(java.util.List.of("Content-Disposition", "Authorization", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"));
            corsConfig.setAllowCredentials(true);
            corsConfig.setMaxAge(3600L);
            return corsConfig;
        }));
        
        // Session Management
        http.sessionManagement(session -> session.sessionCreationPolicy(STATELESS));
        
        // Exception Handling
        http.exceptionHandling(exception -> exception
            .accessDeniedHandler(customAccessDeniedHandler)
            .authenticationEntryPoint(customAuthenticationEntryPoint)
        );
        
        // Authorization Rules
        // SECURITY: All API endpoints require authentication except explicitly public routes
        http.authorizeHttpRequests(authorize -> authorize
            // CRITICAL: Permit async dispatches - these are internal Spring dispatches to write
            // responses for DeferredResult/CompletableFuture, not new HTTP requests.
            // Without this, async response writing fails with "anonymousUser" because there's
            // no Authorization header in the async dispatch (it's a response write, not a request).
            .dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
            .requestMatchers(OPTIONS).permitAll()
            .requestMatchers(PUBLIC_URLS).permitAll()
            .requestMatchers("/ws/**").permitAll()  // WebSocket has its own token validation
            .requestMatchers("/health", "/actuator/health").permitAll()  // Health check for load balancers
            .requestMatchers("/api/public/**").permitAll()  // Explicitly public endpoints only
            // SpringDoc OpenAPI / Swagger UI
            .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
            // Static resources and error pages
            .requestMatchers("/error", "/error/**").permitAll()
            .requestMatchers("/favicon.ico").permitAll()
            .requestMatchers("/static/**", "/assets/**", "/css/**", "/js/**", "/images/**").permitAll()
            // All other requests require authentication
            .anyRequest().authenticated()
        );
        
        // Add Custom Filter
        http.addFilterBefore(customAuthorizationFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
    
    @Bean
    public AuthenticationManager authenticationManager() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(authProvider);
    }

    private String buildCspPolicy() {
        String[] origins = allowedOrigins.split(",");
        String connectSrc = String.join(" ", origins);
        // Build ws:// and wss:// variants for WebSocket connections
        StringBuilder wsSrc = new StringBuilder();
        for (String origin : origins) {
            String trimmed = origin.trim();
            if (trimmed.startsWith("https://")) {
                wsSrc.append(" wss://").append(trimmed.substring(8));
            } else if (trimmed.startsWith("http://")) {
                wsSrc.append(" ws://").append(trimmed.substring(7));
            }
        }
        // For localhost dev, also allow wildcard localhost ports
        String extraConnect = "";
        if (allowedOrigins.contains("localhost")) {
            extraConnect = " http://localhost:* ws://localhost:*";
        }
        String frameAncestors = String.join(" ", origins);
        return "default-src 'self'; " +
            "script-src 'self' https://apis.google.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' " + connectSrc + wsSrc + extraConnect + "; " +
            "frame-ancestors 'self' " + frameAncestors;
    }
}