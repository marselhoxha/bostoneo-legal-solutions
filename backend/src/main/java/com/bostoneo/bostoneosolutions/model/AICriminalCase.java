package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.OffenseLevel;
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
@Table(name = "ai_criminal_cases")
public class AICriminalCase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "docket_number", length = 50)
    private String docketNumber;

    @Column(name = "court_name", length = 200)
    private String courtName;

    @Column(name = "charge_codes", nullable = false, columnDefinition = "TEXT")
    private String chargeCodes;

    @Column(name = "primary_offense", length = 200)
    private String primaryOffense;

    @Enumerated(EnumType.STRING)
    @Column(name = "offense_level", nullable = false)
    private OffenseLevel offenseLevel;

    @Column(name = "offense_class", length = 10)
    private String offenseClass;

    @Column(name = "max_penalty", length = 200)
    private String maxPenalty;

    @Builder.Default
    @Column(name = "prior_record_points")
    private Integer priorRecordPoints = 0;

    @Column(name = "criminal_history", columnDefinition = "TEXT")
    private String criminalHistory;

    @Column(name = "sentencing_guidelines", columnDefinition = "TEXT")
    private String sentencingGuidelines;

    @Column(name = "plea_offer", columnDefinition = "TEXT")
    private String pleaOffer;

    @Column(name = "plea_deadline")
    private LocalDate pleaDeadline;

    @Column(name = "trial_date")
    private LocalDate trialDate;

    @Column(name = "discovery_deadline")
    private LocalDate discoveryDeadline;

    @Column(name = "motion_deadlines", columnDefinition = "TEXT")
    private String motionDeadlines;

    @Column(name = "bail_amount", precision = 10, scale = 2)
    private BigDecimal bailAmount;

    @Column(name = "bail_conditions", columnDefinition = "TEXT")
    private String bailConditions;

    @Column(name = "victim_information", columnDefinition = "TEXT")
    private String victimInformation;

    @Column(name = "prosecutor_name", length = 200)
    private String prosecutorName;

    @Column(name = "defense_strategy", columnDefinition = "TEXT")
    private String defenseStrategy;

    @Column(name = "case_strengths", columnDefinition = "TEXT")
    private String caseStrengths;

    @Column(name = "case_weaknesses", columnDefinition = "TEXT")
    private String caseWeaknesses;

    @Column(name = "potential_defenses", columnDefinition = "TEXT")
    private String potentialDefenses;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}