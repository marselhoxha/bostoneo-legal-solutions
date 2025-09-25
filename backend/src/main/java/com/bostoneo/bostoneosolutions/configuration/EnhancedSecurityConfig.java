package com.bostoneo.bostoneosolutions.configuration;

import com.bostoneo.bostoneosolutions.filter.CustomAuthorizationFilter;
import com.bostoneo.bostoneosolutions.handler.CustomAccessDeniedHandler;
import com.bostoneo.bostoneosolutions.handler.CustomAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
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
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.XXssProtectionHeaderWriter;

import static com.bostoneo.bostoneosolutions.constant.Constants.PUBLIC_URLS;
import static org.springframework.http.HttpMethod.OPTIONS;
import static org.springframework.security.config.http.SessionCreationPolicy.STATELESS;

@Configuration
@EnableWebSecurity
//@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class EnhancedSecurityConfig {
    
    private final CustomAccessDeniedHandler customAccessDeniedHandler;
    private final CustomAuthenticationEntryPoint customAuthenticationEntryPoint;
    private final CustomAuthorizationFilter customAuthorizationFilter;
    private final BCryptPasswordEncoder passwordEncoder;
    private final UserDetailsService userDetailsService;
    
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
            // Content Security Policy
            .contentSecurityPolicy(csp -> csp
                .policyDirectives("default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self' http://localhost:* ws://localhost:*")
            )
            // Frame Options
            .frameOptions(frame -> frame.sameOrigin())
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
        
        // CSRF Configuration
        http.csrf(csrf -> csrf
            .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            .ignoringRequestMatchers(PUBLIC_URLS)
            .ignoringRequestMatchers("/api/auth/**", "/user/login", "/user/register", "/user/verify/**")
            .ignoringRequestMatchers("/api/time-entries/**", "/api/**")
            .ignoringRequestMatchers("/user/delete/**")  // Ignore CSRF for user deletion
            .ignoringRequestMatchers("/ws/**")  // Ignore CSRF for WebSocket endpoints
            .ignoringRequestMatchers("/api/ai/**")  // Ignore CSRF for AI endpoints
        );
        
        // CORS Configuration
        http.cors(cors -> cors.configurationSource(request -> {
            var corsConfig = new org.springframework.web.cors.CorsConfiguration();
            corsConfig.setAllowedOrigins(java.util.List.of("http://localhost:4200", "http://localhost:8085"));
            corsConfig.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
            corsConfig.setAllowedHeaders(java.util.List.of("*"));
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
        
        // Authorization - Allow WebSocket connections to bypass authentication
        http.authorizeHttpRequests(authorize -> authorize
            .requestMatchers(OPTIONS).permitAll()
            .requestMatchers(PUBLIC_URLS).permitAll()
            .requestMatchers("/ws/**").permitAll()  // Allow WebSocket connections
            .requestMatchers("/api/crm/**").permitAll()  // Temporarily allow public access to CRM for debugging
            .requestMatchers("/api/ai/**").permitAll()  // Allow public access to AI for testing
            .requestMatchers("/api/files/**").permitAll()  // Allow public access to file downloads for PDF viewing
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
}