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
@Table(name = "ai_patent_prior_art")
public class AIPatentPriorArt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_id", nullable = false)
    private Long applicationId;

    @Column(name = "prior_art_type", nullable = false, length = 100)
    private String priorArtType;

    @Column(name = "patent_number", length = 50)
    private String patentNumber;

    @Column(name = "publication_number", length = 50)
    private String publicationNumber;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "inventor_name", length = 300)
    private String inventorName;

    @Column(name = "assignee_name", length = 300)
    private String assigneeName;

    @Column(name = "publication_date")
    private LocalDate publicationDate;

    @Column(name = "priority_date")
    private LocalDate priorityDate;

    @Column(name = "country_code", length = 5)
    private String countryCode;

    @Column(name = "abstract", columnDefinition = "TEXT")
    private String abstractText;

    @Column(name = "relevant_claims", columnDefinition = "TEXT")
    private String relevantClaims;

    @Column(name = "relevance_score")
    private Double relevanceScore;

    @Builder.Default
    @Column(name = "is_blocking")
    private Boolean isBlocking = false;

    @Column(name = "blocking_analysis", columnDefinition = "TEXT")
    private String blockingAnalysis;

    @Column(name = "classification_codes", columnDefinition = "TEXT")
    private String classificationCodes;

    @Column(name = "search_query_used", columnDefinition = "TEXT")
    private String searchQueryUsed;

    @Column(name = "database_source", length = 100)
    private String databaseSource;

    @Column(name = "analysis_notes", columnDefinition = "TEXT")
    private String analysisNotes;

    @Column(name = "examiner_cited")
    private Boolean examinerCited;

    @Column(name = "applicant_cited")
    private Boolean applicantCited;

    @Column(name = "citation_category", length = 50)
    private String citationCategory;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}