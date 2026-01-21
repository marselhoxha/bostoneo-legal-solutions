package com.bostoneo.bostoneosolutions.handler;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.authorization.event.AuthorizationDeniedEvent;
import org.springframework.security.authorization.event.AuthorizationGrantedEvent;
import org.springframework.security.web.FilterInvocation;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Slf4j
@Component
public class SecurityAuditEventListener {

    @EventListener
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        String username = event.getAuthentication().getName();
        String details = event.getAuthentication().getDetails() != null ?
            event.getAuthentication().getDetails().toString() : "No details";


    }

    @EventListener
    public void onAuthenticationFailure(AbstractAuthenticationFailureEvent event) {
        String username = event.getAuthentication().getName();
        String reason = event.getException().getMessage();
        String details = event.getAuthentication().getDetails() != null ?
            event.getAuthentication().getDetails().toString() : "No details";

        log.warn("SECURITY_AUDIT: Authentication failed - User: {}, Reason: {}, Time: {}, Details: {}",
            username, reason, LocalDateTime.now(), details);
    }

    @EventListener
    public void onAuthorizationGranted(AuthorizationGrantedEvent<?> event) {
        String username = event.getAuthentication() != null ?
            event.getAuthentication().get().getName() : "Anonymous";
        String decision = event.getAuthorizationDecision().toString();


    }

    @EventListener
    public void onAuthorizationDenied(AuthorizationDeniedEvent<?> event) {
        String username = event.getAuthentication() != null ?
            event.getAuthentication().get().getName() : "Anonymous";
        String decision = event.getAuthorizationDecision().toString();

        // Try to get the request URL from multiple sources
        String requestUrl = "unknown";
        String method = "unknown";

        try {
            // Try to get from RequestContextHolder first
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                requestUrl = request.getRequestURI();
                method = request.getMethod();
            }
        } catch (Exception e) {
            // Fallback: try to get from event source
            try {
                Object obj = event.getSource();
                if (obj instanceof FilterInvocation) {
                    FilterInvocation fi = (FilterInvocation) obj;
                    requestUrl = fi.getRequestUrl();
                    method = fi.getHttpRequest().getMethod();
                } else if (obj != null) {
                    // Try to extract URL from toString
                    String source = obj.toString();
                    if (source.contains("uri=")) {
                        int start = source.indexOf("uri=") + 4;
                        int end = source.indexOf(";", start);
                        if (end == -1) end = source.indexOf("]", start);
                        if (end > start) {
                            requestUrl = source.substring(start, end);
                        }
                    }
                }
            } catch (Exception ex) {
                requestUrl = "error: " + ex.getMessage();
            }
        }

        log.warn("SECURITY_AUDIT: Authorization denied - User: {}, Method: {}, URL: {}, Decision: {}, Time: {}",
            username, method, requestUrl, decision, LocalDateTime.now());
    }
}