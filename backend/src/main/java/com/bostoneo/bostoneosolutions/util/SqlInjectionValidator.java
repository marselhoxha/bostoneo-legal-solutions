package com.bostoneo.bostoneosolutions.util;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class SqlInjectionValidator {
    
    // Common SQL injection patterns
    private static final List<Pattern> SQL_INJECTION_PATTERNS = Arrays.asList(
        Pattern.compile("('.+--)|(--)|(\\|\\|)|(\\*)|(;)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript)", 
            Pattern.CASE_INSENSITIVE),
        Pattern.compile("(<script)|(<\\/script>)|(<iframe)|(<\\/iframe>)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(\\\\x[0-9a-fA-F]+)|(\\\\u[0-9a-fA-F]{4})", Pattern.CASE_INSENSITIVE)
    );
    
    /**
     * Validate input for potential SQL injection
     */
    public boolean isValidInput(String input) {
        if (input == null || input.trim().isEmpty()) {
            return true;
        }
        
        // Check against SQL injection patterns
        for (Pattern pattern : SQL_INJECTION_PATTERNS) {
            if (pattern.matcher(input).find()) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Sanitize input by escaping special characters
     */
    public String sanitizeInput(String input) {
        if (input == null) {
            return null;
        }
        
        // Escape single quotes
        input = input.replace("'", "''");
        
        // Remove SQL comment indicators
        input = input.replaceAll("--", "");
        input = input.replaceAll("/\\*", "");
        input = input.replaceAll("\\*/", "");
        
        // Remove potential script tags
        input = input.replaceAll("(?i)<script.*?>.*?</script>", "");
        input = input.replaceAll("(?i)<iframe.*?>.*?</iframe>", "");
        
        return input.trim();
    }
    
    /**
     * Validate and sanitize search parameters
     */
    public String validateSearchParam(String param) {
        if (param == null || param.trim().isEmpty()) {
            return "";
        }
        
        // Limit length to prevent buffer overflow
        if (param.length() > 100) {
            param = param.substring(0, 100);
        }
        
        // Remove wildcard characters if not explicitly allowed
        param = param.replace("%", "");
        param = param.replace("_", "");
        
        // Validate against injection patterns
        if (!isValidInput(param)) {
            throw new IllegalArgumentException("Invalid search parameter detected");
        }
        
        return sanitizeInput(param);
    }
    
    /**
     * Validate numeric parameters
     */
    public Long validateNumericParam(String param) {
        if (param == null || param.trim().isEmpty()) {
            return null;
        }
        
        // Only allow digits
        if (!param.matches("^\\d+$")) {
            throw new IllegalArgumentException("Invalid numeric parameter");
        }
        
        try {
            return Long.parseLong(param);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid numeric parameter");
        }
    }
}