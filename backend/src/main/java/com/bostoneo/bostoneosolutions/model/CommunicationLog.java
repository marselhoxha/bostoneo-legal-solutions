package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Entity for logging all communications (SMS, WhatsApp, Voice, Email) for audit and compliance.
 * Essential for legal practice management to maintain communication records.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "communication_logs", indexes = {
        @Index(name = "idx_comm_user_id", columnList = "user_id"),
        @Index(name = "idx_comm_client_id", columnList = "client_id"),
        @Index(name = "idx_comm_case_id", columnList = "case_id"),
        @Index(name = "idx_comm_channel", columnList = "channel"),
        @Index(name = "idx_comm_created_at", columnList = "created_at"),
        @Index(name = "idx_comm_twilio_sid", columnList = "twilio_sid")
})
public class CommunicationLog {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    /**
     * User associated with this communication (staff member)
     */
    @Column(name = "user_id")
    private Long userId;

    /**
     * Client associated with this communication
     */
    @Column(name = "client_id")
    private Long clientId;

    /**
     * Case associated with this communication (optional)
     */
    @Column(name = "case_id")
    private Long caseId;

    /**
     * Appointment associated with this communication (optional)
     */
    @Column(name = "appointment_id")
    private Long appointmentId;

    /**
     * Communication channel: SMS, WHATSAPP, VOICE, EMAIL
     */
    @Column(name = "channel", nullable = false, length = 20)
    private String channel;

    /**
     * Direction: INBOUND, OUTBOUND
     */
    @Column(name = "direction", nullable = false, length = 10)
    @Builder.Default
    private String direction = "OUTBOUND";

    /**
     * Recipient phone/email
     */
    @Column(name = "to_address", nullable = false, length = 100)
    private String toAddress;

    /**
     * Sender phone/email
     */
    @Column(name = "from_address", nullable = false, length = 100)
    private String fromAddress;

    /**
     * Message content (for SMS/WhatsApp/Email)
     */
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    /**
     * Subject (for Email)
     */
    @Column(name = "subject", length = 255)
    private String subject;

    /**
     * Delivery status: QUEUED, SENT, DELIVERED, FAILED, UNDELIVERED
     */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "QUEUED";

    /**
     * Twilio message SID for tracking
     */
    @Column(name = "twilio_sid", length = 50)
    private String twilioSid;

    /**
     * Error message if delivery failed
     */
    @Column(name = "error_message", length = 500)
    private String errorMessage;

    /**
     * Error code from Twilio
     */
    @Column(name = "error_code", length = 20)
    private String errorCode;

    /**
     * Template code used (if any)
     */
    @Column(name = "template_code", length = 50)
    private String templateCode;

    /**
     * Who sent this message (user ID of the sender)
     */
    @Column(name = "sent_by_user_id")
    private Long sentByUserId;

    /**
     * Name of the person who sent this message
     */
    @Column(name = "sent_by_user_name", length = 100)
    private String sentByUserName;

    /**
     * Duration in seconds (for voice calls)
     */
    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    /**
     * Cost of the communication (from Twilio)
     */
    @Column(name = "cost")
    private Double cost;

    /**
     * Currency for cost
     */
    @Column(name = "cost_currency", length = 3)
    @Builder.Default
    private String costCurrency = "USD";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = "QUEUED";
        }
        if (this.direction == null) {
            this.direction = "OUTBOUND";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Helper methods
    public boolean isSms() {
        return "SMS".equalsIgnoreCase(channel);
    }

    public boolean isWhatsApp() {
        return "WHATSAPP".equalsIgnoreCase(channel);
    }

    public boolean isVoice() {
        return "VOICE".equalsIgnoreCase(channel);
    }

    public boolean isEmail() {
        return "EMAIL".equalsIgnoreCase(channel);
    }

    public boolean isOutbound() {
        return "OUTBOUND".equalsIgnoreCase(direction);
    }

    public boolean isInbound() {
        return "INBOUND".equalsIgnoreCase(direction);
    }

    public boolean isDelivered() {
        return "DELIVERED".equalsIgnoreCase(status);
    }

    public boolean isFailed() {
        return "FAILED".equalsIgnoreCase(status) || "UNDELIVERED".equalsIgnoreCase(status);
    }
}
