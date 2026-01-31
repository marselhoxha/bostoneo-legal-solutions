package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for PI Damage Calculation Summary
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIDamageCalculationDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    // Damage Totals by Category
    private BigDecimal pastMedicalTotal;
    private BigDecimal futureMedicalTotal;
    private BigDecimal lostWagesTotal;
    private BigDecimal earningCapacityTotal;
    private BigDecimal householdServicesTotal;
    private BigDecimal painSufferingTotal;
    private BigDecimal mileageTotal;
    private BigDecimal otherDamagesTotal;

    // Summary Amounts
    private BigDecimal economicDamagesTotal;
    private BigDecimal nonEconomicDamagesTotal;
    private BigDecimal grossDamagesTotal;

    // Adjustments
    private Integer comparativeNegligencePercent;
    private BigDecimal adjustedDamagesTotal;

    // Value Range
    private BigDecimal lowValue;
    private BigDecimal midValue;
    private BigDecimal highValue;

    // AI Comparable Analysis
    private Map<String, Object> comparableAnalysis;

    // Calculation Info
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime calculatedAt;

    private String calculationNotes;

    // Related info
    private String caseNumber;
    private String clientName;
    private String injuryType;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
