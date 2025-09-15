package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.RateType;
import com.bostoneo.bostoneosolutions.validation.ValidEnum;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class BillingRateDTO {
    private Long id;

    @NotNull(message = "User ID is required")
    private Long userId;

    private Long matterTypeId;

    private Long clientId;

    private Long legalCaseId;

    @NotNull(message = "Rate type is required")
    @ValidEnum(enumClass = RateType.class)
    private RateType rateType;

    @NotNull(message = "Rate amount is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Rate amount must be greater than 0")
    private BigDecimal rateAmount;

    @NotNull(message = "Effective date is required")
    private LocalDate effectiveDate;

    private LocalDate endDate;

    private Boolean isActive;

    // Related entity information for display
    private String userName;
    private String userEmail;
    private String matterTypeName;
    private String customerName;
    private String caseName;
    private String caseNumber;

    private Date createdAt;
    private Date updatedAt;

    // Helper method to check if rate is currently effective
    public boolean isCurrentlyEffective() {
        LocalDate now = LocalDate.now();
        return Boolean.TRUE.equals(isActive) && 
               (effectiveDate == null || !effectiveDate.isAfter(now)) &&
               (endDate == null || !endDate.isBefore(now));
    }
} 
 
 
 
 
 
 