package com.bostoneo.bostoneosolutions.handler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.authorization.event.AuthorizationDeniedEvent;
import org.springframework.security.authorization.event.AuthorizationGrantedEvent;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
public class SecurityAuditEventListener {
    
    @EventListener
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        String username = event.getAuthentication().getName();
        String details = event.getAuthentication().getDetails() != null ? 
            event.getAuthentication().getDetails().toString() : "No details";
        
        log.info("SECURITY_AUDIT: Authentication successful - User: {}, Time: {}, Details: {}", 
            username, LocalDateTime.now(), details);
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
        
        log.info("SECURITY_AUDIT: Authorization granted - User: {}, Decision: {}, Time: {}", 
            username, decision, LocalDateTime.now());
    }
    
    @EventListener
    public void onAuthorizationDenied(AuthorizationDeniedEvent<?> event) {
        String username = event.getAuthentication() != null ? 
            event.getAuthentication().get().getName() : "Anonymous";
        String decision = event.getAuthorizationDecision().toString();
        
        log.warn("SECURITY_AUDIT: Authorization denied - User: {}, Decision: {}, Time: {}", 
            username, decision, LocalDateTime.now());
    }
}