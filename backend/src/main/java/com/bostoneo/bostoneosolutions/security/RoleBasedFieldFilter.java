package com.***REMOVED***.***REMOVED***solutions.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ser.impl.SimpleBeanPropertyFilter;
import com.fasterxml.jackson.databind.ser.impl.SimpleFilterProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class RoleBasedFieldFilter {
    
    private final ObjectMapper objectMapper;
    
    // Define sensitive fields per entity
    private static final Map<String, Map<String, Set<String>>> FIELD_PERMISSIONS = new HashMap<>();
    
    static {
        // Client fields by role
        Map<String, Set<String>> clientFields = new HashMap<>();
        clientFields.put("ROLE_ADMIN", Set.of("*")); // All fields
        clientFields.put("ROLE_MANAGER", Set.of("*"));
        clientFields.put("ROLE_ATTORNEY", Set.of("id", "name", "email", "phone", "type", "status"));
        clientFields.put("ROLE_CLIENT", Set.of("name", "email", "phone"));
        clientFields.put("ROLE_SECRETARY", Set.of("id", "name", "email", "phone", "type"));
        FIELD_PERMISSIONS.put("Client", clientFields);
        
        // Invoice fields by role
        Map<String, Set<String>> invoiceFields = new HashMap<>();
        invoiceFields.put("ROLE_ADMIN", Set.of("*"));
        invoiceFields.put("ROLE_MANAGER", Set.of("*"));
        invoiceFields.put("ROLE_ATTORNEY", Set.of("invoiceNumber", "date", "services", "status"));
        invoiceFields.put("ROLE_CLIENT", Set.of("invoiceNumber", "date", "total", "status"));
        invoiceFields.put("ROLE_SECRETARY", Set.of("invoiceNumber", "date", "client", "status"));
        FIELD_PERMISSIONS.put("Invoice", invoiceFields);
        
        // Legal Case fields by role
        Map<String, Set<String>> caseFields = new HashMap<>();
        caseFields.put("ROLE_ADMIN", Set.of("*"));
        caseFields.put("ROLE_ATTORNEY", Set.of("*"));
        caseFields.put("ROLE_PARALEGAL", Set.of("id", "caseNumber", "title", "clientName", "status", 
                                                  "priority", "type", "courtInfo", "importantDates"));
        caseFields.put("ROLE_CLIENT", Set.of("caseNumber", "title", "status", "type", "nextHearing"));
        caseFields.put("ROLE_SECRETARY", Set.of("caseNumber", "title", "clientName", "status", "nextHearing"));
        FIELD_PERMISSIONS.put("LegalCase", caseFields);
    }
    
    public RoleBasedFieldFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }
    
    public Object filterFields(Object object, String entityType) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return object;
        }
        
        Set<String> userRoles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        
        Set<String> allowedFields = getAllowedFields(entityType, userRoles);
        
        if (allowedFields.contains("*")) {
            return object; // No filtering needed
        }
        
        try {
            SimpleFilterProvider filterProvider = new SimpleFilterProvider();
            filterProvider.addFilter("roleBasedFilter", 
                SimpleBeanPropertyFilter.filterOutAllExcept(allowedFields));
            
            ObjectMapper filterMapper = objectMapper.copy();
            filterMapper.setFilterProvider(filterProvider);
            
            String json = filterMapper.writeValueAsString(object);
            return filterMapper.readValue(json, object.getClass());
        } catch (Exception e) {
            return object; // Return unfiltered on error
        }
    }
    
    private Set<String> getAllowedFields(String entityType, Set<String> userRoles) {
        Map<String, Set<String>> entityFields = FIELD_PERMISSIONS.get(entityType);
        if (entityFields == null) {
            return Set.of("*");
        }
        
        Set<String> allowedFields = new HashSet<>();
        
        // Get highest role's permissions
        if (userRoles.contains("ROLE_ADMIN")) {
            return Set.of("*");
        }
        
        for (String role : userRoles) {
            Set<String> roleFields = entityFields.get(role);
            if (roleFields != null) {
                allowedFields.addAll(roleFields);
            }
        }
        
        return allowedFields.isEmpty() ? Set.of("id") : allowedFields;
    }
} 