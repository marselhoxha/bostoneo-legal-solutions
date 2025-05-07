package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateActivityRequest {
    private Long caseId;
    
    @NotBlank(message = "Activity type is required")
    private String activityType;
    
    private Long referenceId;
    
    private String referenceType;
    
    @NotBlank(message = "Description is required")
    private String description;
    
    private Map<String, Object> metadata;
    
    private Long userId;
} 