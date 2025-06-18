package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Represents a case-specific role assignment in the RBAC system
 * This allows for more granular control over user permissions for specific cases
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseRoleAssignment {

    private Long id;
    
    private LegalCase legalCase;
    
    private User user;
    
    private Role role;
    
    // Optional expiration date for temporary assignments
    private LocalDateTime expiresAt;
    
    /**
     * Check if this case role assignment is currently active (not expired)
     */
    public boolean isActive() {
        return expiresAt == null || expiresAt.isAfter(LocalDateTime.now());
    }
} 