package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for organization integration status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegrationStatusDTO {

    private Long organizationId;
    private String organizationName;
    private String organizationSlug;
    private String status;

    // Twilio integration
    private Boolean twilioEnabled;
    private String twilioPhoneNumber;
    private LocalDateTime twilioLastActivity;

    // BoldSign integration
    private Boolean boldSignEnabled;
    private Boolean boldSignApiConfigured;

    // Communication channels
    private Boolean smsEnabled;
    private Boolean whatsappEnabled;
    private Boolean emailEnabled;

    // Status indicators
    private Boolean hasIssues;
    private String issueDescription;
}
