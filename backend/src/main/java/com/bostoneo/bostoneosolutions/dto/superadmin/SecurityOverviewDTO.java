package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for security overview dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityOverviewDTO {

    private Integer failedLoginsLast24h;
    private Integer failedLoginsLast7d;
    private Integer failedLoginsLast30d;
    private Integer accountLockouts;
    private Integer suspiciousActivityCount;
    private List<SecurityEventDTO> recentSecurityEvents;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SecurityEventDTO {
        private Long id;
        private String eventType; // FAILED_LOGIN, ACCOUNT_LOCKOUT, SUSPICIOUS_ACTIVITY, PASSWORD_RESET
        private String userEmail;
        private String organizationName;
        private String ipAddress;
        private String description;
        private LocalDateTime timestamp;
    }
}
