package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for detailed medical record tracking in Personal Injury cases.
 * Stores provider info, diagnoses with ICD codes, procedures with CPT codes,
 * billing information, and clinical findings.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_medical_records")
public class PIMedicalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Provider Information
    @Column(name = "provider_name", nullable = false)
    private String providerName;

    @Column(name = "provider_npi", length = 20)
    private String providerNpi;

    @Column(name = "provider_type", length = 100)
    private String providerType;

    @Column(name = "provider_address", columnDefinition = "TEXT")
    private String providerAddress;

    @Column(name = "provider_phone", length = 50)
    private String providerPhone;

    @Column(name = "provider_fax", length = 50)
    private String providerFax;

    // Record Type & Dates
    @Column(name = "record_type", nullable = false, length = 50)
    private String recordType; // ER, Follow-up, Surgery, PT, Imaging, Lab, Consultation

    @Column(name = "treatment_date", nullable = false)
    private LocalDate treatmentDate;

    @Column(name = "treatment_end_date")
    private LocalDate treatmentEndDate;

    // Clinical Information (JSONB)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "diagnoses", columnDefinition = "jsonb")
    private List<Map<String, Object>> diagnoses; // [{icd_code, description, primary: boolean}]

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "procedures", columnDefinition = "jsonb")
    private List<Map<String, Object>> procedures; // [{cpt_code, description, units}]

    // Billing Information
    @Column(name = "billed_amount", precision = 12, scale = 2)
    private BigDecimal billedAmount;

    @Column(name = "adjusted_amount", precision = 12, scale = 2)
    private BigDecimal adjustedAmount;

    @Column(name = "paid_amount", precision = 12, scale = 2)
    private BigDecimal paidAmount;

    @Column(name = "lien_holder")
    private String lienHolder;

    @Column(name = "lien_amount", precision = 12, scale = 2)
    private BigDecimal lienAmount;

    // Clinical Notes
    @Column(name = "key_findings", columnDefinition = "TEXT")
    private String keyFindings;

    @Column(name = "treatment_provided", columnDefinition = "TEXT")
    private String treatmentProvided;

    @Column(name = "prognosis_notes", columnDefinition = "TEXT")
    private String prognosisNotes;

    @Column(name = "work_restrictions", columnDefinition = "TEXT")
    private String workRestrictions;

    @Column(name = "follow_up_recommendations", columnDefinition = "TEXT")
    private String followUpRecommendations;

    // Completeness Tracking
    @Column(name = "is_complete")
    private Boolean isComplete;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_elements", columnDefinition = "jsonb")
    private List<String> missingElements;

    // Document Reference
    @Column(name = "document_id")
    private Long documentId;

    // Citation Metadata (JSONB) - stores page numbers, excerpts for each extracted field
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "citation_metadata", columnDefinition = "jsonb")
    private Map<String, Object> citationMetadata;

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
