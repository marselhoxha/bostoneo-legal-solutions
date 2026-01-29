package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogEntryDTO {

    private Long id;
    private String action;
    private String entityType;
    private Long entityId;
    private String description;

    // User who performed the action
    private Long userId;
    private String userEmail;
    private String userName;

    // Organization context
    private Long organizationId;
    private String organizationName;

    // Additional details
    private String ipAddress;
    private String userAgent;
    private String oldValue;
    private String newValue;

    private LocalDateTime createdAt;
}
