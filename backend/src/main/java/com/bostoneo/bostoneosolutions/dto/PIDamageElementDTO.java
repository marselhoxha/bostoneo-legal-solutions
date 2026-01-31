package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for PI Damage Elements
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIDamageElementDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    // Damage Category
    private String elementType;
    private String elementName;

    // Calculation Details
    private String calculationMethod;
    private BigDecimal baseAmount;
    private BigDecimal multiplier;
    private BigDecimal durationValue;
    private String durationUnit;
    private BigDecimal calculatedAmount;

    // Confidence & Documentation
    private String confidenceLevel;
    private String confidenceNotes;
    private List<String> supportingDocuments;

    // Source Information
    private String sourceProvider;
    private String sourceEmployer;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate sourceDate;

    // Notes
    private String notes;
    private String legalAuthority;

    // Display Order
    private Integer displayOrder;

    // Related info
    private String caseNumber;
    private String clientName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    private Long createdBy;
    private String createdByName;
}
