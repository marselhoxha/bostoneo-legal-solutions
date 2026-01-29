package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemHealthDTO {

    private String overallStatus; // HEALTHY, DEGRADED, UNHEALTHY
    private LocalDateTime checkedAt;

    // Database
    private ComponentHealth database;

    // Application
    private ComponentHealth application;

    // Memory
    private MemoryInfo memory;

    // Disk
    private DiskInfo disk;

    // Recent errors
    private int errorCountLastHour;
    private int errorCountLast24Hours;

    // Active sessions
    private int activeSessions;

    // API metrics
    private ApiMetrics apiMetrics;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComponentHealth {
        private String status; // UP, DOWN, DEGRADED
        private String message;
        private long responseTimeMs;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemoryInfo {
        private long totalBytes;
        private long usedBytes;
        private long freeBytes;
        private double usagePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiskInfo {
        private long totalBytes;
        private long usedBytes;
        private long freeBytes;
        private double usagePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApiMetrics {
        private long totalRequestsLastHour;
        private double avgResponseTimeMs;
        private double p95ResponseTimeMs;
        private double p99ResponseTimeMs;
        private Map<String, Long> requestsByEndpoint;
    }
}
