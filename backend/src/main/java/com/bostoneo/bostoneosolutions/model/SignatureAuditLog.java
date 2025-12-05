package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Audit log for signature request events.
 * Tracks all activities related to e-signature documents for compliance.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "signature_audit_logs", indexes = {
        @Index(name = "idx_audit_org", columnList = "organization_id"),
        @Index(name = "idx_audit_request", columnList = "signature_request_id"),
        @Index(name = "idx_audit_event", columnList = "event_type"),
        @Index(name = "idx_audit_created", columnList = "created_at")
})
public class SignatureAuditLog {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "organization_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long organizationId;

    @Column(name = "signature_request_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long signatureRequestId;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "event_data", columnDefinition = "JSON")
    private String eventData;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false)
    private ActorType actorType;

    @Column(name = "actor_id", columnDefinition = "BIGINT UNSIGNED")
    private Long actorId;

    @Column(name = "actor_name", length = 100)
    private String actorName;

    @Column(name = "actor_email", length = 100)
    private String actorEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel")
    @Builder.Default
    private Channel channel = Channel.WEB;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Enums
    public enum ActorType {
        SYSTEM,
        USER,
        SIGNER,
        WEBHOOK
    }

    public enum Channel {
        EMAIL,
        SMS,
        WHATSAPP,
        WEB,
        API
    }

    // Event type constants
    public static final String EVENT_CREATED = "CREATED";
    public static final String EVENT_SENT = "SENT";
    public static final String EVENT_VIEWED = "VIEWED";
    public static final String EVENT_SIGNED = "SIGNED";
    public static final String EVENT_COMPLETED = "COMPLETED";
    public static final String EVENT_DECLINED = "DECLINED";
    public static final String EVENT_EXPIRED = "EXPIRED";
    public static final String EVENT_VOIDED = "VOIDED";
    public static final String EVENT_REMINDER_SENT = "REMINDER_SENT";
    public static final String EVENT_DOWNLOADED = "DOWNLOADED";
}
