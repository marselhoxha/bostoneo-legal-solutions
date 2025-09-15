package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CaseRateConfigurationDTO {
    private Long id;

    @NotNull(message = "Legal case ID is required")
    private Long legalCaseId;

    @DecimalMin(value = "0.0", inclusive = false, message = "Default rate must be greater than 0")
    private BigDecimal defaultRate;

    @Builder.Default
    private Boolean allowMultipliers = true;

    @DecimalMin(value = "1.0", inclusive = true, message = "Weekend multiplier must be at least 1.0")
    private BigDecimal weekendMultiplier;

    @DecimalMin(value = "1.0", inclusive = true, message = "After-hours multiplier must be at least 1.0")
    private BigDecimal afterHoursMultiplier;

    @DecimalMin(value = "1.0", inclusive = true, message = "Emergency multiplier must be at least 1.0")
    private BigDecimal emergencyMultiplier;

    @Builder.Default
    private Boolean isActive = true;

    // Related entity information for display
    private String caseName;
    private String caseNumber;

    private Date createdAt;
    private Date updatedAt;

    // Helper methods
    public BigDecimal getEffectiveMultiplier(boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        if (!Boolean.TRUE.equals(allowMultipliers)) {
            return BigDecimal.ONE;
        }

        if (isEmergency && emergencyMultiplier != null) {
            return emergencyMultiplier;
        }

        BigDecimal multiplier = BigDecimal.ONE;
        
        if (isWeekend && weekendMultiplier != null) {
            multiplier = multiplier.multiply(weekendMultiplier);
        }
        
        if (isAfterHours && afterHoursMultiplier != null) {
            multiplier = multiplier.multiply(afterHoursMultiplier);
        }
        
        return multiplier;
    }

    public BigDecimal calculateFinalRate(BigDecimal baseRate, boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        if (baseRate == null) {
            baseRate = defaultRate != null ? defaultRate : new BigDecimal("250.00");
        }
        
        BigDecimal multiplier = getEffectiveMultiplier(isWeekend, isAfterHours, isEmergency);
        return baseRate.multiply(multiplier);
    }

    // Convenience method for frontend
    public String getMultiplierSummary() {
        if (!Boolean.TRUE.equals(allowMultipliers)) {
            return "No multipliers";
        }
        
        StringBuilder summary = new StringBuilder();
        if (weekendMultiplier != null && weekendMultiplier.compareTo(BigDecimal.ONE) > 0) {
            summary.append("Weekend: ").append(weekendMultiplier).append("x ");
        }
        if (afterHoursMultiplier != null && afterHoursMultiplier.compareTo(BigDecimal.ONE) > 0) {
            summary.append("After-hours: ").append(afterHoursMultiplier).append("x ");
        }
        if (emergencyMultiplier != null && emergencyMultiplier.compareTo(BigDecimal.ONE) > 0) {
            summary.append("Emergency: ").append(emergencyMultiplier).append("x");
        }
        
        return summary.length() > 0 ? summary.toString().trim() : "Standard multipliers";
    }

    // Helper methods for frontend display
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

    public String getMultipliersSummary() {
        if (!Boolean.TRUE.equals(allowMultipliers)) {
            return "Multipliers disabled";
        }
        
        StringBuilder summary = new StringBuilder();
        summary.append("Weekend: ").append(weekendMultiplier != null ? weekendMultiplier : "1.50").append("x, ");
        summary.append("After-hours: ").append(afterHoursMultiplier != null ? afterHoursMultiplier : "1.25").append("x, ");
        summary.append("Emergency: ").append(emergencyMultiplier != null ? emergencyMultiplier : "2.00").append("x");
        
        return summary.toString();
    }

    public boolean hasMultipliers() {
        return Boolean.TRUE.equals(allowMultipliers);
    }

    public BigDecimal calculateEffectiveRate(boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
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

    // Validation helper
    public boolean isValidConfiguration() {
        if (legalCaseId == null) {
            return false;
        }
        
        if (defaultRate != null && defaultRate.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        
        if (weekendMultiplier != null && weekendMultiplier.compareTo(BigDecimal.ONE) < 0) {
            return false;
        }
        
        if (afterHoursMultiplier != null && afterHoursMultiplier.compareTo(BigDecimal.ONE) < 0) {
            return false;
        }
        
        if (emergencyMultiplier != null && emergencyMultiplier.compareTo(BigDecimal.ONE) < 0) {
            return false;
        }
        
        return true;
    }

    // Factory method for creating default configuration
    public static CaseRateConfigurationDTO createDefault(Long legalCaseId) {
        return CaseRateConfigurationDTO.builder()
                .legalCaseId(legalCaseId)
                .defaultRate(new BigDecimal("250.00"))
                .allowMultipliers(true)
                .weekendMultiplier(new BigDecimal("1.50"))
                .afterHoursMultiplier(new BigDecimal("1.25"))
                .emergencyMultiplier(new BigDecimal("2.00"))
                .isActive(true)
                .build();
    }

    // Factory method for creating case-type specific configurations
    public static CaseRateConfigurationDTO createForCaseType(Long legalCaseId, String caseType) {
        BigDecimal defaultRate;
        
        if (caseType != null) {
            if (caseType.toLowerCase().contains("merger") || caseType.toLowerCase().contains("acquisition")) {
                defaultRate = new BigDecimal("450.00");
            } else if (caseType.toLowerCase().contains("litigation") || caseType.toLowerCase().contains("fraud")) {
                defaultRate = new BigDecimal("500.00");
            } else if (caseType.toLowerCase().contains("estate") || caseType.toLowerCase().contains("trust")) {
                defaultRate = new BigDecimal("250.00");
            } else if (caseType.toLowerCase().contains("corporate") || caseType.toLowerCase().contains("compliance")) {
                defaultRate = new BigDecimal("400.00");
            } else if (caseType.toLowerCase().contains("ip") || caseType.toLowerCase().contains("patent") 
                       || caseType.toLowerCase().contains("intellectual")) {
                defaultRate = new BigDecimal("500.00");
            } else if (caseType.toLowerCase().contains("international") || caseType.toLowerCase().contains("trade")) {
                defaultRate = new BigDecimal("600.00");
            } else {
                defaultRate = new BigDecimal("300.00");
            }
        } else {
            defaultRate = new BigDecimal("300.00");
        }
        
        return CaseRateConfigurationDTO.builder()
                .legalCaseId(legalCaseId)
                .defaultRate(defaultRate)
                .allowMultipliers(true)
                .weekendMultiplier(new BigDecimal("1.50"))
                .afterHoursMultiplier(new BigDecimal("1.25"))
                .emergencyMultiplier(new BigDecimal("2.00"))
                .isActive(true)
                .build();
    }
} 