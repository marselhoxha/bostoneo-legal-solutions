package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class StartTimerRequest {
    @NotNull(message = "Legal case ID is required")
    private Long legalCaseId;

    @Size(max = 1000, message = "Description cannot exceed 1000 characters")
    private String description;

    // Rate configuration parameters
    @DecimalMin(value = "0.0", inclusive = false, message = "Rate must be greater than 0")
    private BigDecimal rate;

    @Builder.Default
    private Boolean applyMultipliers = true;

    @Builder.Default
    private Boolean isEmergency = false;

    // Additional context for billing
    private String workType;
    private String tags;
} 
 
 
 
 