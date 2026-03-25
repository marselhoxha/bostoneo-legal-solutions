package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Tracks the processing outcome of every file attempted during a medical document scan.
 * Prevents re-processing of merged, non-medical, and failed files on subsequent scans.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "pi_scanned_documents")
public class PIScannedDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    /** Status: 'created', 'merged', 'non_medical', 'insurance', 'no_text', 'failed' */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /** FK to pi_medical_records.id — set for 'created' and 'merged' statuses */
    @Column(name = "medical_record_id")
    private Long medicalRecordId;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
