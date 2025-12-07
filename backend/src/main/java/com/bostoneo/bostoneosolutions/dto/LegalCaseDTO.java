package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.PaymentStatus;
import com.bostoneo.bostoneosolutions.validation.ValidEnum;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LegalCaseDTO {
    private Long id;

    @NotBlank(message = "Case number is required")
    private String caseNumber;

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Client name is required")
    private String clientName;

    private String clientEmail;
    private String clientPhone;
    private String clientAddress;

    @NotNull(message = "Status is required")
    @ValidEnum(enumClass = CaseStatus.class)
    private CaseStatus status;

    @NotNull(message = "Priority is required")
    @ValidEnum(enumClass = CasePriority.class)
    private CasePriority priority;

    @NotBlank(message = "Type is required")
    private String type;

    private String description;
    
    // Court Information
    private String courtName;
    private String courtroom;
    private String judgeName;
    
    // Added to handle frontend nested structure
    private Map<String, Object> courtInfo;
    private Map<String, Object> importantDates;
    private Map<String, Object> billingInfo;
    
    // Important Dates
    private Date filingDate;
    private Date nextHearing;
    private Date trialDate;
    
    // Billing Information
    private Double hourlyRate;
    private Double totalHours;
    private Double totalAmount;

    @NotNull(message = "Payment status is required")
    @ValidEnum(enumClass = PaymentStatus.class)
    private PaymentStatus paymentStatus;

    // Enhanced Rate Configuration Fields
    private BigDecimal defaultRate;
    private Boolean allowMultipliers;
    private BigDecimal weekendMultiplier;
    private BigDecimal afterHoursMultiplier;
    private BigDecimal emergencyMultiplier;

    // Rate configuration summary for frontend display
    private String rateConfigurationSummary;
    
    private Date createdAt;
    private Date updatedAt;

    // Assigned attorneys for display in case list
    private List<AssignedAttorneyDTO> assignedAttorneys;

    // Helper method to generate rate configuration summary
    public String getRateConfigurationSummary() {
        if (defaultRate == null) {
            return "No rate configuration";
        }
        
        StringBuilder summary = new StringBuilder();
        summary.append("$").append(defaultRate).append("/hr");
        
        if (Boolean.TRUE.equals(allowMultipliers)) {
            summary.append(" (with multipliers)");
        } else {
            summary.append(" (fixed rate)");
        }
        
        return summary.toString();
    }

    // Helper method to check if multipliers are enabled
    public boolean hasMultipliers() {
        return Boolean.TRUE.equals(allowMultipliers);
    }

    // Helper method to get effective rate for a given context
    public BigDecimal getEffectiveRate(boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        BigDecimal rate = defaultRate != null ? defaultRate : new BigDecimal("250.00");
        
        if (!Boolean.TRUE.equals(allowMultipliers)) {
            return rate;
        }
        
        if (isEmergency && emergencyMultiplier != null) {
            return rate.multiply(emergencyMultiplier);
        }
        
        if (isWeekend && weekendMultiplier != null) {
            rate = rate.multiply(weekendMultiplier);
        }
        
        if (isAfterHours && afterHoursMultiplier != null) {
            rate = rate.multiply(afterHoursMultiplier);
        }
        
        return rate;
    }
} 