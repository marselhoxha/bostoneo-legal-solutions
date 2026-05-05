package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.converter.EncryptedStringConverter;
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

    // Treating clinician (the person who signed/co-signed) — distinct from provider_name (facility)
    @Column(name = "treating_clinician", length = 255)
    private String treatingClinician;

    // Clinician's credential/role — "PA-C", "DPT", "DC", "MD", "DO", etc.
    @Column(name = "treating_role", length = 100)
    private String treatingRole;

    // Records Department Contact
    @Column(name = "records_email")
    private String recordsEmail;

    @Column(name = "records_phone", length = 50)
    private String recordsPhone;

    @Column(name = "records_fax", length = 50)
    private String recordsFax;

    // Billing Department Contact
    @Column(name = "billing_email")
    private String billingEmail;

    @Column(name = "billing_phone", length = 50)
    private String billingPhone;

    // Record Type & Dates
    @Column(name = "record_type", nullable = false, length = 50)
    private String recordType; // ER, Follow-up, Surgery, PT, Imaging, Lab, Consultation

    @Column(name = "treatment_date")
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

    // Encounter vitals: {"bp":"129/80","hr":80,"weight_lbs":133,"height":"5'5\"","bmi":22.13,"pain":"4/10",...}
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "vitals", columnDefinition = "jsonb")
    private Map<String, Object> vitals;

    // Range of motion grouped by region: {"cervical":{"flex":60,...},"lumbar":{"flex":45,...}}
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "range_of_motion", columnDefinition = "jsonb")
    private Map<String, Object> rangeOfMotion;

    // Orthopedic special tests: [{"name":"Lasègue's","side":"L","result":"positive"},...]
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "special_tests", columnDefinition = "jsonb")
    private List<Map<String, Object>> specialTests;

    // Meds given during the encounter (e.g., ED administered Motrin 600mg PO)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medications_administered", columnDefinition = "jsonb")
    private List<Map<String, Object>> medicationsAdministered;

    // Meds prescribed for home use (separate from administered)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medications_prescribed", columnDefinition = "jsonb")
    private List<Map<String, Object>> medicationsPrescribed;

    // Tier 6 — itemized visits from a multi-DOS billing summary.
    // Each entry: {"date":"YYYY-MM-DD","code":"CPT","provider":"...","charge":250.00}
    // Total visit count = sum of visits.size() across records, fallback to 1
    // for records without an itemized list (single-encounter records).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visits", columnDefinition = "jsonb")
    private List<Map<String, Object>> visits;

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

    // Clinical Notes — encrypted at application layer (HIPAA PHI)
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "key_findings", columnDefinition = "TEXT")
    private String keyFindings;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "treatment_provided", columnDefinition = "TEXT")
    private String treatmentProvided;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "prognosis_notes", columnDefinition = "TEXT")
    private String prognosisNotes;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "work_restrictions", columnDefinition = "TEXT")
    private String workRestrictions;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "follow_up_recommendations", columnDefinition = "TEXT")
    private String followUpRecommendations;

    // Verbatim causation quote (PHI — encrypted at app layer, same as key_findings/prognosis)
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "causation_statement", columnDefinition = "TEXT")
    private String causationStatement;

    // Attribution for causation_statement: clinician + date (e.g., "PA Moy 11/11/2025"). Plain text.
    @Column(name = "causation_source", length = 255)
    private String causationSource;

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
