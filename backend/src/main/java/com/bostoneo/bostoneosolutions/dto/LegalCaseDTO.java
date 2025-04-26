package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.CasePriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.PaymentStatus;
import com.***REMOVED***.***REMOVED***solutions.validation.ValidEnum;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
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
    
    private Date createdAt;
    private Date updatedAt;
} 