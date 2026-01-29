package com.bostoneo.bostoneosolutions.dto.superadmin;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * DTO for platform-wide statistics for SUPERADMIN dashboard
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class PlatformStatsDTO {

    // Organization stats
    private Integer totalOrganizations;
    private Integer activeOrganizations;
    private Integer suspendedOrganizations;

    // User stats
    private Integer totalUsers;
    private Integer activeUsersLast7Days;
    private Integer activeUsersLast30Days;

    // Case stats
    private Integer totalCases;
    private Integer activeCases;
    private Integer closedCases;

    // Client stats
    private Integer totalClients;

    // Invoice stats
    private Integer totalInvoices;
    private BigDecimal totalRevenue;
    private BigDecimal revenueThisMonth;

    // System health
    private String systemHealth; // HEALTHY, DEGRADED, DOWN

    // Storage
    private Long totalStorageUsedBytes;
    private Long totalStorageLimitBytes;

    // Recent activity
    private List<RecentActivityDTO> recentActivity;

    // Alerts
    private List<AlertDTO> alerts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentActivityDTO {
        private Long id;
        private String action;
        private String entityType;
        private String entityName;
        private String userName;
        private String organizationName;
        private String timestamp;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AlertDTO {
        private String type; // WARNING, ERROR, INFO
        private String message;
        private String organizationName;
        private String timestamp;
    }
}
