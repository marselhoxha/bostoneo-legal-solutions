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
 * Entity for AI-generated medical summaries in Personal Injury cases.
 * Stores treatment chronology, provider summary, diagnoses, red flags, and completeness scores.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_medical_summaries")
public class PIMedicalSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Summary Content
    @Column(name = "treatment_chronology", columnDefinition = "TEXT")
    private String treatmentChronology; // Markdown formatted chronology

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "provider_summary", columnDefinition = "jsonb")
    private List<Map<String, Object>> providerSummary; // Array of provider summaries

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "diagnosis_list", columnDefinition = "jsonb")
    private List<Map<String, Object>> diagnosisList; // Array of diagnoses with ICD codes

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "red_flags", columnDefinition = "jsonb")
    private List<Map<String, Object>> redFlags; // Array of identified issues

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_records", columnDefinition = "jsonb")
    private List<Map<String, Object>> missingRecords; // Array of potentially missing records

    @Column(name = "key_highlights", columnDefinition = "TEXT")
    private String keyHighlights; // Key findings summary

    @Column(name = "prognosis_assessment", columnDefinition = "TEXT")
    private String prognosisAssessment; // MMI, permanent impairment, future treatment

    // Metrics
    @Column(name = "total_providers")
    private Integer totalProviders;

    @Column(name = "total_visits")
    private Integer totalVisits;

    @Column(name = "total_billed", precision = 12, scale = 2)
    private BigDecimal totalBilled;

    @Column(name = "treatment_duration_days")
    private Integer treatmentDurationDays;

    @Column(name = "treatment_gap_days")
    private Integer treatmentGapDays;

    // Completeness Score
    @Column(name = "completeness_score")
    private Integer completenessScore; // 0-100

    @Column(name = "completeness_notes", columnDefinition = "TEXT")
    private String completenessNotes;

    // Generation Info
    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "generated_by_model", length = 100)
    private String generatedByModel;

    @Column(name = "last_record_date")
    private LocalDate lastRecordDate; // Last medical record included in summary

    @Column(name = "is_stale")
    private Boolean isStale; // True if new records added since generation

    // Metadata
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
