package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.RuleType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentRuleDTO {
    private Long id;
    
    @NotBlank(message = "Rule name is required")
    private String ruleName;
    
    @NotNull(message = "Rule type is required")
    private RuleType ruleType;
    
    private String caseType;
    private Integer priorityOrder;
    private boolean active;
    private BigDecimal maxWorkloadPercentage;
    private BigDecimal minExpertiseScore;
    private boolean preferPreviousAttorney;
    private Map<String, Object> ruleConditions;
    private Map<String, Object> ruleActions;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}