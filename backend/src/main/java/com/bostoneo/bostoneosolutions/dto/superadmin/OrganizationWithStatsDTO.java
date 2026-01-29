package com.bostoneo.bostoneosolutions.dto.superadmin;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * DTO for organization list with stats for SUPERADMIN dashboard
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class OrganizationWithStatsDTO {

    private Long id;
    private String name;
    private String slug;
    private String planType;
    private String status;
    private String email;
    private String phone;

    // Stats
    private Integer userCount;
    private Integer caseCount;
    private Integer clientCount;
    private Integer invoiceCount;
    private Long storageUsedBytes;

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime lastActivityAt;

    // Quota usage percentages
    private Double userQuotaPercent;
    private Double caseQuotaPercent;
    private Double storageQuotaPercent;
}
