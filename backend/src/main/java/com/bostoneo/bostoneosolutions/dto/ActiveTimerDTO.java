package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
public class ActiveTimerDTO {
    private Long id;

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotNull(message = "Legal case ID is required")
    private Long legalCaseId;

    private Date startTime;

    @Size(max = 1000, message = "Description cannot exceed 1000 characters")
    private String description;

    private Boolean isActive;

    private Integer pausedDuration; // seconds paused

    // Rate configuration fields
    private BigDecimal hourlyRate;
    private Boolean applyMultipliers;
    private Boolean isEmergency;
    private String workType;
    private String tags;

    // Read-only calculated field
    private Long currentDurationSeconds;

    // Related entity information for display
    private String caseName;
    private String caseNumber;
    private String userName;
    private String userEmail;

    // Formatted duration for display
    private String formattedDuration;

    private Date createdAt;
    private Date updatedAt;

    // Helper method to format duration
    public String getFormattedDuration() {
        if (currentDurationSeconds != null) {
            long hours = currentDurationSeconds / 3600;
            long minutes = (currentDurationSeconds % 3600) / 60;
            long seconds = currentDurationSeconds % 60;
            return String.format("%02d:%02d:%02d", hours, minutes, seconds);
        }
        return "00:00:00";
    }

    // Helper method to get duration in hours
    public Double getDurationHours() {
        if (currentDurationSeconds != null) {
            return currentDurationSeconds / 3600.0;
        }
        return 0.0;
    }

    // Helper method to calculate estimated billing amount
    public BigDecimal getEstimatedAmount() {
        if (hourlyRate == null) return BigDecimal.ZERO;
        Double hours = getDurationHours();
        return hourlyRate.multiply(BigDecimal.valueOf(hours));
    }

    // Helper method to get rate description
    public String getRateDescription() {
        if (hourlyRate == null) return "No rate set";
        
        StringBuilder description = new StringBuilder();
        description.append("$").append(hourlyRate).append("/hr");
        
        if (Boolean.TRUE.equals(applyMultipliers)) {
            description.append(" (with multipliers)");
        }
        
        if (Boolean.TRUE.equals(isEmergency)) {
            description.append(" - EMERGENCY");
        }
        
        return description.toString();
    }
} 
 
 
 
 