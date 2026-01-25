package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.SearchType;
import com.bostoneo.bostoneosolutions.enumeration.RiskLevel;
import com.bostoneo.bostoneosolutions.enumeration.ReviewStatus;
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
@Table(name = "ai_patent_searches")
public class AIPatentSearch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id")
    private Long caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "search_type", nullable = false)
    private SearchType searchType;

    @Column(name = "invention_title", nullable = false, length = 300)
    private String inventionTitle;

    @Column(name = "invention_description", columnDefinition = "TEXT")
    private String inventionDescription;

    @Column(name = "search_terms", columnDefinition = "TEXT")
    private String searchTerms;

    @Column(name = "search_databases", columnDefinition = "TEXT")
    private String searchDatabases;

    @Column(name = "search_strategy", columnDefinition = "TEXT")
    private String searchStrategy;

    @Column(name = "search_results", columnDefinition = "TEXT")
    private String searchResults;

    @Column(name = "prior_art_references", columnDefinition = "TEXT")
    private String priorArtReferences;

    @Column(name = "analysis_results", columnDefinition = "TEXT")
    private String analysisResults;

    @Column(name = "patentability_score", precision = 3, scale = 2)
    private BigDecimal patentabilityScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_assessment")
    private RiskLevel riskAssessment;

    @Column(columnDefinition = "TEXT")
    private String recommendations;

    @Column(name = "search_date")
    private LocalDate searchDate;

    @Column(name = "searcher_name", length = 200)
    private String searcherName;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "review_status")
    private ReviewStatus reviewStatus = ReviewStatus.PENDING;

    @Column(name = "search_cost", precision = 10, scale = 2)
    private BigDecimal searchCost;

    @Column(name = "ai_analysis_confidence", precision = 3, scale = 2)
    private BigDecimal aiAnalysisConfidence;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}