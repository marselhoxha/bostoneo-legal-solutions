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

    // SECURITY: Required for multi-tenant data isolation
    private Long organizationId;

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
    private String countyName;
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

    // ============================================
    // Personal Injury (PI) Specific Fields
    // ============================================

    // Injury Information
    private Date injuryDate;
    private String injuryType;
    private String injuryDescription;
    private String accidentLocation;
    private String liabilityAssessment;
    private Integer comparativeNegligencePercent;

    // Medical Providers (JSON string or parsed list)
    private String medicalProviders;

    // Financial Damages
    private BigDecimal medicalExpensesTotal;
    private BigDecimal lostWages;
    private BigDecimal futureMedicalEstimate;
    private BigDecimal painSufferingMultiplier;

    // Settlement Information
    private BigDecimal settlementDemandAmount;
    private BigDecimal settlementOfferAmount;
    private BigDecimal settlementFinalAmount;
    private Date settlementDate;

    // Insurance Information
    private String insuranceCompany;
    private String insurancePolicyNumber;
    private BigDecimal insurancePolicyLimit;
    private String insuranceAdjusterName;
    private String insuranceAdjusterContact;
    private String insuranceAdjusterEmail;
    private String insuranceAdjusterPhone;

    // Employer Information
    private String employerName;
    private String employerEmail;
    private String employerPhone;
    private String employerHrContact;

    // Defendant Information
    private String defendantName;
    private String defendantAddress;

    // ============================================
    // PI Computed Fields (for Case Value Calculator)
    // ============================================

    // Get total economic damages
    public BigDecimal getEconomicDamages() {
        BigDecimal medical = medicalExpensesTotal != null ? medicalExpensesTotal : BigDecimal.ZERO;
        BigDecimal wages = lostWages != null ? lostWages : BigDecimal.ZERO;
        BigDecimal future = futureMedicalEstimate != null ? futureMedicalEstimate : BigDecimal.ZERO;
        return medical.add(wages).add(future);
    }

    // Get non-economic damages (pain & suffering)
    public BigDecimal getNonEconomicDamages() {
        BigDecimal multiplier = painSufferingMultiplier != null ? painSufferingMultiplier : new BigDecimal("2.0");
        return getEconomicDamages().multiply(multiplier);
    }

    // Get total case value before negligence adjustment
    public BigDecimal getTotalCaseValue() {
        return getEconomicDamages().add(getNonEconomicDamages());
    }

    // Get adjusted case value (after comparative negligence)
    public BigDecimal getAdjustedCaseValue() {
        if (comparativeNegligencePercent == null || comparativeNegligencePercent == 0) {
            return getTotalCaseValue();
        }
        BigDecimal reduction = new BigDecimal(100 - comparativeNegligencePercent).divide(new BigDecimal("100"));
        return getTotalCaseValue().multiply(reduction);
    }

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