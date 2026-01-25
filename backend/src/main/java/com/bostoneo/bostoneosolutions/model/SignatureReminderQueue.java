package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Queue for scheduled signature reminders.
 * Supports multi-channel reminders (Email, SMS, WhatsApp).
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "signature_reminder_queue", indexes = {
        @Index(name = "idx_reminder_scheduled", columnList = "scheduled_at, status"),
        @Index(name = "idx_reminder_request", columnList = "signature_request_id")
})
public class SignatureReminderQueue {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "signature_request_id", nullable = false)
    private Long signatureRequestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    @Builder.Default
    private ReminderStatus status = ReminderStatus.PENDING;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "communication_log_id")
    private Long communicationLogId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Enums
    public enum Channel {
        EMAIL,
        SMS,
        WHATSAPP
    }

    public enum ReminderStatus {
        PENDING,
        SENT,
        FAILED,
        CANCELLED
    }
}
