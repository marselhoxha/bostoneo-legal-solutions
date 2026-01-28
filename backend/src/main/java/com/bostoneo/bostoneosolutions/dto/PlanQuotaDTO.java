package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.Organization;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * DTO for plan quota limits
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class PlanQuotaDTO {

    private Organization.PlanType planType;
    private Integer maxUsers;
    private Integer maxCases;
    private Long maxStorageBytes;
    private Integer maxClients;

    // Feature flags
    private Boolean hasApiAccess;
    private Boolean hasAdvancedReporting;
    private Boolean hasCustomBranding;
    private Boolean hasPrioritySupport;

    /**
     * Get quota limits based on plan type
     */
    public static PlanQuotaDTO forPlanType(Organization.PlanType planType) {
        if (planType == null) {
            planType = Organization.PlanType.FREE;
        }

        switch (planType) {
            case FREE:
                return PlanQuotaDTO.builder()
                        .planType(planType)
                        .maxUsers(3)
                        .maxCases(25)
                        .maxStorageBytes(1L * 1024 * 1024 * 1024) // 1 GB
                        .maxClients(10)
                        .hasApiAccess(false)
                        .hasAdvancedReporting(false)
                        .hasCustomBranding(false)
                        .hasPrioritySupport(false)
                        .build();

            case STARTER:
                return PlanQuotaDTO.builder()
                        .planType(planType)
                        .maxUsers(10)
                        .maxCases(100)
                        .maxStorageBytes(10L * 1024 * 1024 * 1024) // 10 GB
                        .maxClients(50)
                        .hasApiAccess(false)
                        .hasAdvancedReporting(false)
                        .hasCustomBranding(true)
                        .hasPrioritySupport(false)
                        .build();

            case PROFESSIONAL:
                return PlanQuotaDTO.builder()
                        .planType(planType)
                        .maxUsers(50)
                        .maxCases(500)
                        .maxStorageBytes(50L * 1024 * 1024 * 1024) // 50 GB
                        .maxClients(250)
                        .hasApiAccess(true)
                        .hasAdvancedReporting(true)
                        .hasCustomBranding(true)
                        .hasPrioritySupport(false)
                        .build();

            case ENTERPRISE:
                return PlanQuotaDTO.builder()
                        .planType(planType)
                        .maxUsers(Integer.MAX_VALUE)
                        .maxCases(Integer.MAX_VALUE)
                        .maxStorageBytes(Long.MAX_VALUE) // Unlimited
                        .maxClients(Integer.MAX_VALUE)
                        .hasApiAccess(true)
                        .hasAdvancedReporting(true)
                        .hasCustomBranding(true)
                        .hasPrioritySupport(true)
                        .build();

            default:
                return forPlanType(Organization.PlanType.FREE);
        }
    }

    /**
     * Format storage for display
     */
    public String getMaxStorageFormatted() {
        if (maxStorageBytes == null || maxStorageBytes == Long.MAX_VALUE) {
            return "Unlimited";
        }
        long gb = maxStorageBytes / (1024 * 1024 * 1024);
        return gb + " GB";
    }
}
