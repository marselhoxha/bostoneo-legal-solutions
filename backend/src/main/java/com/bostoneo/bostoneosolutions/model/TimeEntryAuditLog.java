package com.bostoneo.bostoneosolutions.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "time_entry_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeEntryAuditLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "time_entry_id", nullable = false)
    private Long timeEntryId;
    
    @Column(name = "action_type", nullable = false, length = 50)
    private String actionType; // CREATE, UPDATE, DELETE, STATUS_CHANGE, RATE_ADJUST, HOURS_ADJUST
    
    @Column(name = "user_id", nullable = false)
    private Long userId; // User who performed the action
    
    @Column(name = "field_name", length = 100)
    private String fieldName; // Field that was changed (for updates)
    
    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue; // Previous value
    
    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue; // New value
    
    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason; // Reason for change (optional)
    
    @Column(name = "ip_address", length = 45)
    private String ipAddress; // User's IP address
    
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent; // Browser/client information
    
    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;
    
    @Column(name = "session_id", length = 255)
    private String sessionId; // User session identifier
    
    // Financial audit fields
    @Column(name = "old_billable_amount", precision = 10, scale = 2)
    private BigDecimal oldBillableAmount;
    
    @Column(name = "new_billable_amount", precision = 10, scale = 2)
    private BigDecimal newBillableAmount;
    
    @Column(name = "compliance_flag", nullable = false)
    private Boolean complianceFlag = false; // For flagging critical changes

    @Column(name = "organization_id")
    private Long organizationId;
    
    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
} 