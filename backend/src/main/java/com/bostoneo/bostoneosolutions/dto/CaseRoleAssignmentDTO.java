package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseRoleAssignmentDTO {
    private Long id;
    private Long caseId;
    private String caseName; // For display purposes
    private Long userId;
    private String userName; // For display purposes
    private Long roleId;
    private String roleName; // For display purposes
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 