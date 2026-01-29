package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformAnalyticsDTO {

    // Growth metrics
    private List<TimeSeriesData> organizationGrowth;
    private List<TimeSeriesData> userGrowth;
    private List<TimeSeriesData> caseGrowth;
    private List<TimeSeriesData> revenueGrowth;

    // Top organizations
    private List<OrgMetric> topOrgsByUsers;
    private List<OrgMetric> topOrgsByCases;
    private List<OrgMetric> topOrgsByRevenue;

    // Usage analytics
    private Map<String, Long> casesByType;
    private Map<String, Long> usersByRole;
    private Map<String, Long> casesByStatus;

    // Engagement metrics
    private int dailyActiveUsers;
    private int weeklyActiveUsers;
    private int monthlyActiveUsers;

    // Plan distribution
    private Map<String, Long> organizationsByPlan;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeSeriesData {
        private LocalDate date;
        private long value;
        private String label;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrgMetric {
        private Long organizationId;
        private String organizationName;
        private long value;
        private String metric;
    }
}
