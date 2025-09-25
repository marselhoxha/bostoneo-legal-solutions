package com.bostoneo.bostoneosolutions.model;

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
@Table(name = "ai_ma_sentencing_guidelines")
public class AIMASentencingGuideline {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "offense_code", nullable = false, length = 20, unique = true)
    private String offenseCode;

    @Column(name = "offense_description", nullable = false, length = 500)
    private String offenseDescription;

    @Column(length = 100)
    private String category;

    @Column(length = 100)
    private String subcategory;

    @Column(name = "statutory_citation", length = 100)
    private String statutoryCitation;

    @Column(name = "min_sentence", length = 100)
    private String minSentence;

    @Column(name = "max_sentence", length = 100)
    private String maxSentence;

    @Builder.Default
    @Column(name = "mandatory_minimum")
    private Boolean mandatoryMinimum = false;

    @Column(name = "fine_range", length = 100)
    private String fineRange;

    @Column(name = "points_value")
    private Integer pointsValue;

    @Column(name = "eligibility_notes", columnDefinition = "TEXT")
    private String eligibilityNotes;

    @Column(name = "recent_updates", columnDefinition = "TEXT")
    private String recentUpdates;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}