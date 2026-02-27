package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for dashboard drill-down data.
 * Uses static inner classes to keep the DTO package clean.
 * All data is counts/aggregates only — no case titles, client names,
 * or document filenames (compliance with Mass. Rule 1.6 / 201 CMR 17.00).
 */
public class DashboardDrillDownDTO {

    // === Active Users By Org ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgActiveUsers {
        private Long organizationId;
        private String organizationName;
        private int activeUsers24h;
        private int totalUsers;
        private double activityPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserActivity {
        private Long userId;
        private String firstName;
        private String lastName;
        private String email;
        private LocalDateTime lastLogin;
        private int loginCount24h;
        private String lastDevice;
        private String lastIpAddress;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserSession {
        private LocalDateTime loginTime;
        private String device;
        private String ipAddress;
        private String eventType; // SUCCESS or FAILURE
    }

    // === API Requests By Org ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgApiRequests {
        private Long organizationId;
        private String organizationName;
        private int requestCount;
        private String topAction;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EndpointBreakdown {
        private String action;
        private String entityType;
        private int count;
        private LocalDateTime lastHit;
    }

    // === Storage By Org ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgStorage {
        private Long organizationId;
        private String organizationName;
        private long storageUsedBytes; // computed from SUM(documents.file_size)
        private int documentCount;
        private int dbRows; // cases + clients + documents + invoices
        private Double quotaPercent;
    }

    // === Errors By Org ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgErrors {
        private Long organizationId;
        private String organizationName;
        private int errorCount24h;
        private LocalDateTime lastError;
        private String lastErrorType;
    }

    // === Security By Org ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgSecurity {
        private Long organizationId;
        private String organizationName;
        private int failedLogins;
        private int accountLockouts;
        private int suspiciousIps;
    }

    // === Engagement Metrics ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EngagementMetrics {
        private int dau;
        private int wau;
        private int mau;
        private double dauWauRatio;
        private double avgLoginsPerUserPerDay;
        private List<OrgEngagement> byOrganization;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgEngagement {
        private Long organizationId;
        private String organizationName;
        private int dau;
        private int wau;
        private int mau;
    }

    // === Data Growth ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DataGrowth {
        private int casesThisWeek;
        private int casesLastWeek;
        private int documentsThisWeek;
        private int documentsLastWeek;
        private int clientsThisWeek;
        private int clientsLastWeek;
        private List<OrgDataGrowth> byOrganization;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgDataGrowth {
        private Long organizationId;
        private String organizationName;
        private int casesThisWeek;
        private int documentsThisWeek;
        private int clientsThisWeek;
    }

    // === Feature Adoption ===

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FeatureAdoption {
        private int totalOrganizations;
        private int smsEnabled;
        private int whatsappEnabled;
        private int emailEnabled;
        private int boldSignEnabled;
        private int twilioEnabled;
    }
}
