package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.PaymentStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.*;

import java.util.Date;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class LegalCaseDTO {
    private Long id;
    
    @NotBlank(message = "Case number is required")
    private String caseNumber;
    
    @NotBlank(message = "Title is required")
    private String title;
    
    @NotBlank(message = "Client name is required")
    private String clientName;
    
    @Email(message = "Invalid email format")
    private String clientEmail;
    
    @Pattern(regexp = "^\\+?[0-9]{10,15}$", message = "Invalid phone number format")
    private String clientPhone;
    
    private String clientAddress;
    
    @NotNull(message = "Status is required")
    private CaseStatus status;
    
    @NotNull(message = "Priority is required")
    private CasePriority priority;
    
    @NotBlank(message = "Case type is required")
    private String type;
    
    private String description;
    
    // Court Information
    private String courtName;
    private String judgeName;
    private String courtroom;
    
    // Important Dates
    private Date filingDate;
    private Date nextHearing;
    private Date trialDate;
    
    // Billing Information
    private Double hourlyRate;
    private Double totalHours;
    private Double totalAmount;
    private PaymentStatus paymentStatus;
    
    private Date createdAt;
    private Date updatedAt;
} 