package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for document request email/SMS templates.
 * Supports system-wide templates and organization-specific customizations.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_document_request_templates")
public class PIDocumentRequestTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId; // NULL for system templates

    @Column(name = "template_code", nullable = false, length = 100)
    private String templateCode;

    @Column(name = "template_name", nullable = false)
    private String templateName;

    @Column(name = "document_type", length = 100)
    private String documentType; // MEDICAL_RECORDS, MEDICAL_BILLS, INSURANCE, WAGE_DOCUMENTATION, etc.

    @Column(name = "recipient_type", length = 50)
    private String recipientType; // MEDICAL_PROVIDER, BILLING_DEPT, INSURANCE_ADJUSTER, etc.

    // Email Template
    @Column(name = "email_subject", length = 500)
    private String emailSubject;

    @Column(name = "email_body", columnDefinition = "TEXT")
    private String emailBody;

    // SMS Template
    @Column(name = "sms_body", length = 500)
    private String smsBody;

    // Metadata
    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "is_system")
    private Boolean isSystem;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (isActive == null) {
            isActive = true;
        }
        if (isSystem == null) {
            isSystem = false;
        }
    }
}
