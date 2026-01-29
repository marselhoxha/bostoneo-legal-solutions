package com.bostoneo.bostoneosolutions.dto.superadmin;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * DTO for detailed organization view for SUPERADMIN
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class OrganizationDetailDTO {

    // Basic info
    private Long id;
    private String name;
    private String slug;
    private String email;
    private String phone;
    private String address;
    private String website;
    private String logoUrl;

    // Plan & Status
    private String planType;
    private String status;
    private LocalDateTime planStartDate;
    private LocalDateTime planEndDate;

    // Settings
    private Boolean smsEnabled;
    private Boolean whatsappEnabled;
    private Boolean emailEnabled;
    private Boolean twilioEnabled;

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastActivityAt;

    // Statistics
    private OrganizationStatsInfo stats;

    // Recent users
    private List<UserDTO> recentUsers;

    // Recent activity
    private List<PlatformStatsDTO.RecentActivityDTO> recentActivity;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrganizationStatsInfo {
        private Integer userCount;
        private Integer activeUserCount;
        private Integer caseCount;
        private Integer activeCaseCount;
        private Integer clientCount;
        private Integer invoiceCount;
        private Integer documentCount;
        private Long storageUsedBytes;

        // Revenue
        private BigDecimal totalRevenue;
        private BigDecimal revenueThisMonth;

        // Quota info
        private Integer maxUsers;
        private Integer maxCases;
        private Long maxStorageBytes;
        private Double userQuotaPercent;
        private Double caseQuotaPercent;
        private Double storageQuotaPercent;
    }
}
