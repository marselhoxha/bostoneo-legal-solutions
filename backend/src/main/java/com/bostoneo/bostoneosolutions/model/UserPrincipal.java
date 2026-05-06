package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import com.bostoneo.bostoneosolutions.enums.ActionType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.bostoneo.bostoneosolutions.dtomapper.UserDTOMapper.fromUser;
import static java.util.Arrays.stream;
import static java.util.stream.Collectors.toList;

public class UserPrincipal implements UserDetails {

    private final User user;
    private final Set<Role> roles;
    private final Set<Permission> permissions;
    private final Set<CaseRoleAssignment> caseRoleAssignments;
    // Optional — populated post-construction when the user has an Attorney row.
    // Surfaces practice areas to authorization filters without forcing a
    // repository lookup inside this principal.
    private Attorney attorney;

    /**
     * Constructor for the RBAC system
     */
    public UserPrincipal(User user, Set<Role> roles, Set<Permission> permissions, Set<CaseRoleAssignment> caseRoleAssignments) {
        this.user = user;
        this.roles = roles;
        this.permissions = permissions;
        this.caseRoleAssignments = caseRoleAssignments;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        Collection<GrantedAuthority> authorities = new ArrayList<>();
        
        // Add role-based authorities
        for (Role role : roles) {
            // Check if the role name already starts with ROLE_ prefix
            String roleName = role.getName();
            if (roleName.startsWith("ROLE_")) {
                authorities.add(new SimpleGrantedAuthority(roleName));
            } else {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + roleName));
            }
            
            // For backwards compatibility, add the "access:admin" permission for admin users
            if (roleName.equalsIgnoreCase("ROLE_ADMIN") || roleName.equalsIgnoreCase("ADMIN")) {
                authorities.add(new SimpleGrantedAuthority("access:admin"));
            }
        }
        
        // Add permission-based authorities
        for (Permission permission : permissions) {
            authorities.add(new SimpleGrantedAuthority(permission.getAuthority()));
        }
        
        return authorities;
    }
    
    /**
     * Check if user has a specific case-level permission
     */
    public boolean hasCasePermission(Long caseId, ActionType actionType) {
        // Check case-specific role assignments
        for (CaseRoleAssignment assignment : caseRoleAssignments) {
            if (assignment.getLegalCase().getId().equals(caseId) && assignment.isActive()) {
                // Check if the role has the necessary permission
                for (Permission permission : assignment.getRole().getPermissions()) {
                    if (permission.getResourceType() == com.bostoneo.bostoneosolutions.enums.ResourceType.CASE && 
                        permission.getActionType() == actionType) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.isNotLocked();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }

    public User getUser() {
        return user;
    }

    public Long getId() {
        return user.getId();
    }
    
    public Set<Role> getRoles() {
        return this.roles;
    }
    
    public Set<Permission> getPermissions() {
        return this.permissions;
    }
    
    public Set<CaseRoleAssignment> getCaseRoleAssignments() {
        return this.caseRoleAssignments;
    }
    
    /**
     * Check if the user has a specific role
     */
    public boolean hasRole(String roleName) {
        return roles.stream().anyMatch(role -> role.getName().equalsIgnoreCase(roleName));
    }

    /**
     * The Attorney row associated with this principal, if any. May be null for
     * non-attorney users (org admins, paralegals without an attorneys-row, etc.).
     */
    public Attorney getAttorney() {
        return attorney;
    }

    public void setAttorney(Attorney attorney) {
        this.attorney = attorney;
    }

    /**
     * Convenience for the user's organization id. Returns null if not set.
     */
    public Long getOrgId() {
        return user == null ? null : user.getOrganizationId();
    }

    /**
     * Practice areas the principal is assigned to. Returns an empty list when
     * no Attorney row is attached or the attorney has no practice areas set.
     */
    public List<PracticeArea> getPracticeAreas() {
        if (attorney == null) {
            return Collections.emptyList();
        }
        return attorney.getPracticeAreasList();
    }
}
