package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.CalculationType;
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
@Table(name = "ai_family_law_calculations")
public class AIFamilyLawCalculation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id")
    private Long caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "calculation_type", nullable = false)
    private CalculationType calculationType;

    @Builder.Default
    @Column(name = "ma_guidelines_version", length = 20)
    private String maGuidelinesVersion = "2021";

    @Column(name = "input_parameters", nullable = false, columnDefinition = "JSON")
    private String inputParameters;

    @Column(name = "calculation_result", nullable = false, columnDefinition = "JSON")
    private String calculationResult;

    @Column(name = "gross_income_payor", precision = 12, scale = 2)
    private BigDecimal grossIncomePayor;

    @Column(name = "gross_income_recipient", precision = 12, scale = 2)
    private BigDecimal grossIncomeRecipient;

    @Column(name = "number_of_children")
    private Integer numberOfChildren;

    @Column(name = "custody_percentage", precision = 5, scale = 2)
    private BigDecimal custodyPercentage;

    @Column(name = "calculated_amount", precision = 10, scale = 2)
    private BigDecimal calculatedAmount;

    @Builder.Default
    @Column(name = "deviation_amount", precision = 10, scale = 2)
    private BigDecimal deviationAmount = BigDecimal.ZERO;

    @Column(name = "deviation_reason", columnDefinition = "TEXT")
    private String deviationReason;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "review_date")
    private LocalDate reviewDate;

    @Column(name = "calculated_by")
    private Long calculatedBy;

    @Column(name = "verified_by")
    private Long verifiedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}