package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.CourtLevel;
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
@Table(name = "ai_ma_court_rules")
public class AIMACourtRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "court_level", nullable = false)
    private CourtLevel courtLevel;

    @Column(name = "rule_number", nullable = false, length = 20)
    private String ruleNumber;

    @Column(name = "rule_title", nullable = false, length = 300)
    private String ruleTitle;

    @Column(name = "rule_text", nullable = false, columnDefinition = "TEXT")
    private String ruleText;

    @Column(name = "rule_category", length = 100)
    private String ruleCategory;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "last_amended")
    private LocalDate lastAmended;

    @Column(name = "deadlines_json", columnDefinition = "TEXT")
    private String deadlinesJson;

    @Column(name = "related_statutes", columnDefinition = "TEXT")
    private String relatedStatutes;

    @Column(name = "practice_notes", columnDefinition = "TEXT")
    private String practiceNotes;

    @Column(name = "local_rules", columnDefinition = "TEXT")
    private String localRules;

    @Column(name = "forms_required", columnDefinition = "TEXT")
    private String formsRequired;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}