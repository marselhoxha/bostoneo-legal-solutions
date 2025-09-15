package com.bostoneo.bostoneosolutions.configuration;

import com.bostoneo.bostoneosolutions.security.RoleBasedFieldFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@Configuration
@ControllerAdvice
public class RoleBasedFieldConfig implements ResponseBodyAdvice<Object> {
    
    private final RoleBasedFieldFilter fieldFilter;
    
    public RoleBasedFieldConfig(RoleBasedFieldFilter fieldFilter) {
        this.fieldFilter = fieldFilter;
    }
    
    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        // Apply to all controller responses
        return true;
    }
    
    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        
        // Only filter JSON responses
        if (!MediaType.APPLICATION_JSON.isCompatibleWith(selectedContentType)) {
            return body;
        }
        
        // Get current authentication
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return body;
        }
        
        // Check if it's an admin - no filtering for admins
        if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
            return body;
        }
        
        // Apply filtering based on endpoint
        String path = request.getURI().getPath();
        
        if (path.contains("/customer")) {
            return filterClientData(body);
        } else if (path.contains("/legal/case")) {
            return filterLegalCaseData(body);
        } else if (path.contains("/invoice")) {
            return filterInvoiceData(body);
        }
        
        return body;
    }
    
    private Object filterClientData(Object body) {
        // Apply customer field filtering logic
        return body; // Implement specific filtering
    }
    
    private Object filterLegalCaseData(Object body) {
        // Apply legal case field filtering logic
        return body; // Implement specific filtering
    }
    
    private Object filterInvoiceData(Object body) {
        // Apply invoice field filtering logic
        return body; // Implement specific filtering
    }
} 