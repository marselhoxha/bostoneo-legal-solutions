package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for required document tracking in Personal Injury cases.
 * Tracks document status, request dates, and follow-up information.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_document_checklist")
public class PIDocumentChecklist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Document Information
    @Column(name = "document_type", nullable = false, length = 100)
    private String documentType; // Police Report, Medical Records, Bills, Wage Docs, Insurance, Photos, etc.

    @Column(name = "document_subtype", length = 100)
    private String documentSubtype; // Specific subtype (e.g., "ER Records", "MRI Films")

    @Column(name = "provider_name")
    private String providerName; // Associated provider for medical docs

    // Status Tracking
    @Column(name = "required")
    private Boolean required;

    @Column(name = "received")
    private Boolean received;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @Column(name = "status", length = 50)
    private String status; // MISSING, PENDING, RECEIVED, NOT_APPLICABLE, REQUESTED

    // Request Tracking
    @Column(name = "requested_date")
    private LocalDate requestedDate;

    @Column(name = "request_sent_to")
    private String requestSentTo;

    @Column(name = "follow_up_date")
    private LocalDate followUpDate;

    @Column(name = "follow_up_count")
    private Integer followUpCount;

    // Request System Fields (populated by trigger)
    @Column(name = "request_count")
    private Integer requestCount;

    @Column(name = "last_request_at")
    private LocalDateTime lastRequestAt;

    @Column(name = "total_fee", precision = 10, scale = 2)
    private BigDecimal totalFee;

    // Document Reference
    @Column(name = "document_id")
    private Long documentId;

    // Notes
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // Metadata
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Long createdBy;
}
