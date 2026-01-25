package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.MotionType;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_criminal_motions")
public class AICriminalMotion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "motion_type", nullable = false)
    private MotionType motionType;

    @Column(name = "motion_title", nullable = false, length = 300)
    private String motionTitle;

    @Column(name = "motion_text", nullable = false, columnDefinition = "TEXT")
    private String motionText;

    @Column(name = "filing_date")
    private LocalDate filingDate;

    @Column(name = "hearing_date")
    private LocalDate hearingDate;

    @Column(name = "status", nullable = false, length = 50)
    private String status;

    @Builder.Default
    @Column(name = "is_granted")
    private Boolean isGranted = false;

    @Builder.Default
    @Column(name = "is_urgent")
    private Boolean isUrgent = false;

    @Column(name = "legal_arguments", columnDefinition = "TEXT")
    private String legalArguments;

    @Column(name = "supporting_evidence", columnDefinition = "TEXT")
    private String supportingEvidence;

    @Column(name = "case_law_citations", columnDefinition = "TEXT")
    private String caseLawCitations;

    @Column(name = "statutory_citations", columnDefinition = "TEXT")
    private String statutoryCitations;

    @Column(name = "response_deadline")
    private LocalDate responseDeadline;

    @Column(name = "opposition_arguments", columnDefinition = "TEXT")
    private String oppositionArguments;

    @Column(name = "court_ruling", columnDefinition = "TEXT")
    private String courtRuling;

    @Column(name = "ruling_date")
    private LocalDate rulingDate;

    @Column(name = "judge_name", length = 200)
    private String judgeName;

    @Column(name = "prosecutor_response", columnDefinition = "TEXT")
    private String prosecutorResponse;

    @Column(name = "motion_outcome", length = 100)
    private String motionOutcome;

    @Column(name = "appeal_status", length = 50)
    private String appealStatus;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}