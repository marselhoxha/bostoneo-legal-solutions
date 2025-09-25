package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.ImmigrationStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
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
@Table(name = "ai_immigration_cases")
public class AIImmigrationCase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "uscis_case_number", length = 50)
    private String usciseCaseNumber;

    @Column(name = "receipt_number", length = 20)
    private String receiptNumber;

    @Column(name = "form_type", nullable = false, length = 20)
    private String formType;

    @Column(name = "petitioner_name", nullable = false, length = 200)
    private String petitionerName;

    @Column(name = "beneficiary_name", nullable = false, length = 200)
    private String beneficiaryName;

    @Column(length = 100)
    private String relationship;

    @Column(name = "priority_date")
    private LocalDate priorityDate;

    @Column(name = "receipt_date")
    private LocalDate receiptDate;

    @Column(name = "notice_date")
    private LocalDate noticeDate;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    private ImmigrationStatus status = ImmigrationStatus.PREPARATION;

    @Column(name = "service_center", length = 100)
    private String serviceCenter;

    @Column(name = "processing_time_estimate")
    private Integer processingTimeEstimate;

    @Column(name = "next_action_date")
    private LocalDate nextActionDate;

    @Column(name = "next_action_description", columnDefinition = "TEXT")
    private String nextActionDescription;

    @Column(name = "case_notes", columnDefinition = "TEXT")
    private String caseNotes;

    @Column(name = "documents_checklist", columnDefinition = "JSON")
    private String documentsChecklist;

    @Column(name = "filing_fee", precision = 10, scale = 2)
    private BigDecimal filingFee;

    @Column(name = "attorney_notes", columnDefinition = "TEXT")
    private String attorneyNotes;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}