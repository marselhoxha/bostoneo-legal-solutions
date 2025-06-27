package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseRoleType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseAssignmentRequest {
    
    @NotNull(message = "Case ID is required")
    private Long caseId;
    
    @NotNull(message = "User ID is required")
    private Long userId;
    
    @NotNull(message = "Role type is required")
    private CaseRoleType roleType;
    
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private BigDecimal workloadWeight;
    private String notes;
}