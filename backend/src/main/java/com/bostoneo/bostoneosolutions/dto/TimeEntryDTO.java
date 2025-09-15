package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.TimeEntryStatus;
import com.bostoneo.bostoneosolutions.validation.ValidEnum;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimeEntryDTO {
    private Long id;

    @NotNull(message = "Legal case ID is required")
    private Long legalCaseId;

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotNull(message = "Date is required")
    private LocalDate date;

    private LocalTime startTime;

    private LocalTime endTime;

    @NotNull(message = "Hours is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Hours must be greater than 0")
    @DecimalMax(value = "24.0", message = "Hours cannot exceed 24 per day")
    private BigDecimal hours;

    @NotNull(message = "Rate is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Rate must be greater than 0")
    private BigDecimal rate;

    @NotBlank(message = "Description is required")
    @Size(min = 5, max = 1000, message = "Description must be between 5 and 1000 characters")
    private String description;

    @NotNull(message = "Status is required")
    @ValidEnum(enumClass = TimeEntryStatus.class)
    private TimeEntryStatus status;

    @NotNull(message = "Billable status is required")
    private Boolean billable;

    private Long invoiceId;

    private BigDecimal billedAmount;

    // Read-only calculated field
    private BigDecimal totalAmount;

    // Related entity information for display
    private String caseName;
    private String caseNumber;
    private String userName;
    private String userEmail;

    private Date createdAt;
    private Date updatedAt;

    // Helper method to calculate total amount
    public BigDecimal getTotalAmount() {
        if (hours != null && rate != null) {
            return hours.multiply(rate);
        }
        return BigDecimal.ZERO;
    }
} 
 
 
 
 
 
 