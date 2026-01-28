package com.bostoneo.bostoneosolutions.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class UserDTO {

    private Long id;
    private Long organizationId;  // For multi-tenant support
    private String firstName;
    private String lastName;
    private String email;
    private String address;
    private String phone;
    private String title;
    private String bio;
    private String imageUrl;
    private boolean enabled;
    private boolean notLocked;
    private boolean usingMFA;
    private LocalDateTime createdAt;
    
    // List of role names for the new RBAC system
    private List<String> roles = new ArrayList<>();
    
    // Legacy field for backward compatibility with frontend - derived from roles
    private String roleName;
    
    // Permissions as a comma-separated string
    private String permissions;
    
    // Helper method to get primary role
    public String getPrimaryRoleName() {
        return roles != null && !roles.isEmpty() ? roles.get(0) : roleName;
    }
}
