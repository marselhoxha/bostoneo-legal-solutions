package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for organization feature configuration.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationFeaturesDTO {

    private Long organizationId;

    // Communication features
    private Boolean smsEnabled;
    private Boolean whatsappEnabled;
    private Boolean emailEnabled;

    // Integration features
    private Boolean twilioEnabled;
    private Boolean boldSignEnabled;

    // Quotas
    private Integer maxUsers;
    private Integer maxCases;
    private Long maxStorageBytes;

    // Plan
    private String planType;
}
