package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.SignatureStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Entity representing a signature request sent via BoldSign.
 * Tracks the full lifecycle of a document sent for e-signature.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "signature_requests", indexes = {
        @Index(name = "idx_sig_org", columnList = "organization_id"),
        @Index(name = "idx_sig_case", columnList = "case_id"),
        @Index(name = "idx_sig_client", columnList = "client_id"),
        @Index(name = "idx_sig_status", columnList = "status"),
        @Index(name = "idx_sig_boldsign", columnList = "boldsign_document_id"),
        @Index(name = "idx_sig_expires", columnList = "expires_at")
})
public class SignatureRequest {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "organization_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long organizationId;

    @Column(name = "boldsign_document_id", unique = true, length = 100)
    private String boldsignDocumentId;

    // Internal references
    @Column(name = "case_id", columnDefinition = "BIGINT UNSIGNED")
    private Long caseId;

    @Column(name = "client_id", columnDefinition = "BIGINT UNSIGNED")
    private Long clientId;

    @Column(name = "document_id", columnDefinition = "BIGINT UNSIGNED")
    private Long documentId;

    // Request details
    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SignatureStatus status = SignatureStatus.DRAFT;

    // Primary signer
    @Column(name = "signer_name", nullable = false, length = 100)
    private String signerName;

    @Column(name = "signer_email", nullable = false, length = 100)
    private String signerEmail;

    @Column(name = "signer_phone", length = 20)
    private String signerPhone;

    // Additional signers (JSON array)
    @Column(name = "additional_signers", columnDefinition = "jsonb")
    private String additionalSigners;

    // Reminder settings
    @Column(name = "reminder_email")
    @Builder.Default
    private Boolean reminderEmail = true;

    @Column(name = "reminder_sms")
    @Builder.Default
    private Boolean reminderSms = true;

    @Column(name = "reminder_whatsapp")
    @Builder.Default
    private Boolean reminderWhatsapp = false;

    @Column(name = "last_reminder_sent_at")
    private LocalDateTime lastReminderSentAt;

    @Column(name = "reminder_count")
    @Builder.Default
    private Integer reminderCount = 0;

    // Timing
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "viewed_at")
    private LocalDateTime viewedAt;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "declined_at")
    private LocalDateTime declinedAt;

    @Column(name = "decline_reason", length = 500)
    private String declineReason;

    // Tracking
    @Column(name = "created_by", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Signed document
    @Column(name = "signed_document_url", length = 500)
    private String signedDocumentUrl;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = SignatureStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Helper methods
    public boolean isPending() {
        return status == SignatureStatus.SENT || status == SignatureStatus.VIEWED || status == SignatureStatus.PARTIALLY_SIGNED;
    }

    public boolean isCompleted() {
        return status == SignatureStatus.COMPLETED || status == SignatureStatus.SIGNED;
    }

    public boolean isCancelled() {
        return status == SignatureStatus.DECLINED || status == SignatureStatus.EXPIRED || status == SignatureStatus.VOIDED;
    }

    public boolean canSendReminder() {
        return isPending() && expiresAt != null && expiresAt.isAfter(LocalDateTime.now());
    }
}
