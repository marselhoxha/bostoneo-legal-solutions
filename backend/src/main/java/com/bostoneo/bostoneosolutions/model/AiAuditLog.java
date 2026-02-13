package com.bostoneo.bostoneosolutions.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Model for the ai_audit_logs table.
 * Tracks every AI API call for compliance with ABA Model Rule 1.6 (Confidentiality).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAuditLog {
    private Long id;
    private Long userId;
    private String userEmail;
    private String userRole;
    private Long organizationId;
    private String action;
    private String resourceType;
    private Long resourceId;
    private String ipAddress;
    private String userAgent;
    private String requestPayload;   // JSONB - truncated summary, not full prompt
    private String responseSummary;  // Truncated response
    private Boolean wasSuccessful;
    private String errorDetails;
    private Boolean containsPii;
    private String dataClassification;
    private LocalDateTime createdAt;
}
