package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.AssignmentType;
import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CaseAssignmentDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    private Long userId;
    private String userName;
    private String userEmail;
    private String userImageUrl;
    private CaseRoleType roleType;
    private AssignmentType assignmentType;
    private LocalDateTime assignedAt;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private boolean active;
    private BigDecimal workloadWeight;
    private BigDecimal expertiseMatchScore;
    private String notes;
    private String assignedByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}