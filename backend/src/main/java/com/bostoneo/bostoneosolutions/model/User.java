package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.HashSet;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "users")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "first_name")
    private String firstName;
    
    @Column(name = "last_name")
    private String lastName;
    
    @Column(unique = true, nullable = false)
    private String email;
    
    @Column(nullable = false)
    private String password;
    
    private String address;
    private String phone;
    private String title;
    private String bio;
    
    @Column(name = "image_url")
    private String imageUrl;
    
    @Column(nullable = false)
    private boolean enabled = false;
    
    @Column(name = "non_locked", nullable = false)
    private boolean notLocked = true;
    
    @Column(name = "using_mfa", nullable = false)
    private boolean usingMFA = false;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "failed_login_attempts")
    private int failedLoginAttempts;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;
    
    // RBAC fields - This will be handled by the custom repository, not JPA
    @Transient
    private Set<Role> roles;
    
    /**
     * Get user roles (with null safety)
     */
    public Set<Role> getRoles() {
        return roles != null ? roles : new HashSet<>();
    }
    
    /**
     * Check if user has a specific role
     */
    public boolean hasRole(String roleName) {
        return getRoles().stream()
                .anyMatch(role -> roleName.equals(role.getName()));
    }
    
    /**
     * Get the highest hierarchy level from user's roles
     */
    public Integer getHighestHierarchyLevel() {
        return getRoles().stream()
                .filter(role -> role.getHierarchyLevel() != null)
                .mapToInt(Role::getHierarchyLevel)
                .max()
                .orElse(0);
    }
}
