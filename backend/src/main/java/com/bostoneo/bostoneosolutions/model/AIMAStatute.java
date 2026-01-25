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
@Table(name = "ai_ma_statutes")
public class AIMAStatute {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String chapter;

    @Column(nullable = false, length = 20)
    private String section;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "statute_text", nullable = false, columnDefinition = "TEXT")
    private String statuteText;

    @Column(name = "practice_area", length = 100)
    private String practiceArea;

    @Column(columnDefinition = "TEXT")
    private String keywords;

    @Column(name = "related_cases", columnDefinition = "TEXT")
    private String relatedCases;

    @Column(name = "amendments_history", columnDefinition = "TEXT")
    private String amendmentsHistory;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "last_updated")
    private LocalDate lastUpdated;

    @Column(name = "citation_format", length = 100)
    private String citationFormat;

    @Column(name = "cross_references", columnDefinition = "TEXT")
    private String crossReferences;

    @Column(name = "practice_notes", columnDefinition = "TEXT")
    private String practiceNotes;

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