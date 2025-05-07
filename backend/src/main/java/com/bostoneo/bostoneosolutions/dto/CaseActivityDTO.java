package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CaseActivityDTO {
    private Long id;
    private Long caseId;
    private Long userId;
    private UserDTO user;
    private String activityType;
    private Long referenceId;
    private String referenceType;
    private String description;
    private Object metadata; // Using Object to handle JSON structure
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
} 
 
 