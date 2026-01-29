package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDetailDTO {

    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String imageUrl;

    // Role info
    private String roleName;
    private String roleDescription;

    // Organization info
    private Long organizationId;
    private String organizationName;
    private String organizationSlug;

    // Account status
    private boolean enabled;
    private boolean accountNonLocked;
    private boolean usingMfa;

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime lastLogin;

    // Activity stats
    private int casesAssigned;
    private int tasksCompleted;
    private int documentsUploaded;

    // Recent activity
    private List<ActivityItem> recentActivity;

    // Login history
    private List<LoginRecord> loginHistory;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivityItem {
        private String action;
        private String entityType;
        private String description;
        private LocalDateTime timestamp;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginRecord {
        private LocalDateTime loginTime;
        private String ipAddress;
        private String userAgent;
        private boolean successful;
    }
}
