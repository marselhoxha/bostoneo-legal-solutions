package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.FamilyLawCaseType;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawStatus;
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
@Table(name = "ai_family_law_cases")
public class AIFamilyLawCase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "case_type", nullable = false)
    private FamilyLawCaseType caseType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private FamilyLawStatus status;

    @Column(name = "case_title", nullable = false, length = 300)
    private String caseTitle;

    @Column(name = "spouse_name", length = 200)
    private String spouseName;

    @Column(name = "marriage_date")
    private LocalDate marriageDate;

    @Column(name = "separation_date")
    private LocalDate separationDate;

    @Builder.Default
    @Column(name = "has_minor_children")
    private Boolean hasMinorChildren = false;

    @Column(name = "children_count")
    private Integer childrenCount;

    @Column(name = "children_ages", length = 100)
    private String childrenAges;

    @Column(name = "total_marital_assets")
    private Double totalMaritalAssets;

    @Column(name = "total_marital_debts")
    private Double totalMaritalDebts;

    @Column(name = "grounds_for_divorce", length = 100)
    private String groundsForDivorce;

    @Builder.Default
    @Column(name = "is_contested")
    private Boolean isContested = false;

    @Column(name = "custody_arrangement", length = 100)
    private String custodyArrangement;

    @Column(name = "support_amount")
    private Double supportAmount;

    @Column(name = "alimony_amount")
    private Double alimonyAmount;

    @Column(name = "next_hearing_date")
    private LocalDate nextHearingDate;

    @Column(name = "court_name", length = 200)
    private String courtName;

    @Column(name = "judge_name", length = 200)
    private String judgeName;

    @Column(name = "opposing_counsel", length = 200)
    private String opposingCounsel;

    @Column(name = "mediator_name", length = 200)
    private String mediatorName;

    @Column(name = "case_notes", columnDefinition = "TEXT")
    private String caseNotes;

    @Column(name = "priority_level", length = 20)
    private String priorityLevel;

    @Builder.Default
    @Column(name = "requires_guardian_ad_litem")
    private Boolean requiresGuardianAdLitem = false;

    @Column(name = "property_division_status", length = 50)
    private String propertyDivisionStatus;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}