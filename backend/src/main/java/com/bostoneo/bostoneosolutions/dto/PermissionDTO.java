package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionDTO {
    private Long id;
    private String name;
    private String description;
    private String resourceType;
    private String actionType;
    private boolean isAssigned; // Used for UI to track if permission is assigned to a role
} 