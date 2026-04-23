package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * State-specific court formatting configuration.
 * Each row defines how a particular state + court level formats its legal documents:
 * caption layout, separator style, bar number prefix, citation reporters, procedural rules, etc.
 *
 * This is global reference data (no organization_id) — court caption formats are factual,
 * not tenant-specific.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "state_court_configurations",
       uniqueConstraints = @UniqueConstraint(columnNames = {"state_code", "court_level"}))
public class StateCourtConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "state_code", nullable = false, length = 2)
    private String stateCode;

    @Column(name = "state_name", nullable = false, length = 50)
    private String stateName;

    @Column(name = "court_level", nullable = false, length = 50)
    private String courtLevel;

    @Column(name = "court_display_name", nullable = false, length = 200)
    private String courtDisplayName;

    @Column(name = "caption_template_html", nullable = false, columnDefinition = "TEXT")
    private String captionTemplateHtml;

    @Builder.Default
    @Column(name = "caption_separator", length = 10)
    private String captionSeparator = "";

    @Builder.Default
    @Column(name = "cause_number_label", length = 30)
    private String causeNumberLabel = "Case No.";

    @Builder.Default
    @Column(name = "is_commonwealth")
    private Boolean isCommonwealth = false;

    @Builder.Default
    @Column(name = "party_label_style", length = 20)
    private String partyLabelStyle = "STANDARD";

    @Column(name = "preamble_text", columnDefinition = "TEXT")
    private String preambleText;

    @Column(name = "comes_now_format", columnDefinition = "TEXT")
    private String comesNowFormat;

    @Column(name = "prayer_format", columnDefinition = "TEXT")
    private String prayerFormat;

    @Builder.Default
    @Column(name = "bar_number_prefix", length = 30)
    private String barNumberPrefix = "Bar No.";

    @Column(name = "citation_reporters", columnDefinition = "TEXT")
    private String citationReporters;

    @Column(name = "procedural_rules_ref", columnDefinition = "TEXT")
    private String proceduralRulesRef;

    @Column(name = "constitutional_refs", columnDefinition = "TEXT")
    private String constitutionalRefs;

    @Builder.Default
    @Column(name = "priority_rank")
    private Integer priorityRank = 999;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Builder.Default
    @Column(name = "is_verified")
    private Boolean isVerified = false;

    @Column(name = "verified_by", length = 100)
    private String verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
