package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for tracking document request attempts.
 * Records all communications sent for document requests including
 * email, SMS, fax, and in-app notifications.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_document_request_log")
public class PIDocumentRequestLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "checklist_item_id", nullable = false)
    private Long checklistItemId;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Recipient Info
    @Column(name = "recipient_type", nullable = false, length = 50)
    private String recipientType; // MEDICAL_PROVIDER, BILLING_DEPT, INSURANCE_ADJUSTER, EMPLOYER_HR, POLICE_DEPT, CLIENT, WITNESS

    @Column(name = "recipient_name")
    private String recipientName;

    @Column(name = "recipient_email")
    private String recipientEmail;

    @Column(name = "recipient_phone", length = 50)
    private String recipientPhone;

    @Column(name = "recipient_fax", length = 50)
    private String recipientFax;

    // Communication Info
    @Column(name = "channel", nullable = false, length = 50)
    private String channel; // EMAIL, SMS, FAX, IN_APP

    @Column(name = "channel_status", length = 50)
    private String channelStatus; // SENT, DELIVERED, FAILED, BOUNCED

    @Column(name = "external_message_id")
    private String externalMessageId; // Email/SMS provider message ID

    // Template Info
    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "template_code", length = 100)
    private String templateCode;

    @Column(name = "request_subject", length = 500)
    private String requestSubject;

    @Column(name = "request_body", columnDefinition = "TEXT")
    private String requestBody;

    // Cost Tracking
    @Column(name = "document_fee", precision = 10, scale = 2)
    private BigDecimal documentFee;

    @Column(name = "fee_status", length = 50)
    private String feeStatus; // PENDING, PAID, WAIVED

    // Metadata
    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "sent_by")
    private Long sentBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (sentAt == null) {
            sentAt = LocalDateTime.now();
        }
        if (channelStatus == null) {
            channelStatus = "SENT";
        }
        if (feeStatus == null) {
            feeStatus = "PENDING";
        }
    }
}
