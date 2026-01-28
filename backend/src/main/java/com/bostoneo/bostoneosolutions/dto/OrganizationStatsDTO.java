package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * DTO for organization statistics
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class OrganizationStatsDTO {

    private Long organizationId;
    private String organizationName;

    // User stats
    private Integer userCount;
    private Integer activeUserCount;

    // Case stats
    private Integer caseCount;
    private Integer activeCaseCount;

    // Document stats
    private Integer documentCount;
    private Long storageUsedBytes;

    // Client stats
    private Integer clientCount;

    // Plan quota usage
    private PlanQuotaDTO planQuota;

    // Usage percentages
    private Double userUsagePercent;
    private Double caseUsagePercent;
    private Double storageUsagePercent;
}
