package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "roles")
@Data
@SuperBuilder //pattern to use instead of creating a constructor with setters and getters
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    @Column(length = 500)
    private String permission;

    // Added fields for enhanced RBAC
    private String description;

    @Column(name = "hierarchy_level")
    private Integer hierarchyLevel;

    @Column(name = "is_system_role")
    private boolean isSystemRole;

    // Additional fields for EnhancedRbacService
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    @Column(name = "display_name")
    private String displayName;
    
    @Column(name = "max_billing_rate")
    private BigDecimal maxBillingRate;

    // Collection of permissions associated with this role - handled by custom repository
    @Transient
    private Set<Permission> permissions = new HashSet<>();
    
    // Getter with null safety
    public Set<Permission> getPermissions() {
        if (permissions == null) {
            permissions = new HashSet<>();
        }
        return permissions;
    }

    // Count of users who have this role - calculated dynamically
    @Transient
    private Integer userCount = 0;

    // Helper methods for role categorization
    public boolean hasFinancialAccess() {
        if (name == null) return false;
        
        String roleName = name.toUpperCase();
        return roleName.contains("MANAGING_PARTNER") ||
               roleName.contains("EQUITY_PARTNER") ||
               roleName.contains("COO") ||
               roleName.contains("FINANCE") ||
               roleName.contains("BILLING");
    }

    public boolean isAdministrative() {
        if (name == null) return false;
        
        String roleName = name.toUpperCase();
        return roleName.contains("MANAGING_PARTNER") ||
               roleName.contains("SENIOR_PARTNER") ||
               roleName.contains("COO") ||
               roleName.contains("ADMIN") ||
               roleName.contains("SYSTEM");
    }

    // Convenience method for checking if role is active
    public Boolean getIsActive() {
        return isActive != null ? isActive : true;
    }
}

