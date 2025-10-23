package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_research_cache")
public class AIResearchCache {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "query_hash", nullable = false, length = 64, unique = true)
    private String queryHash;

    @Column(name = "query_text", nullable = false, columnDefinition = "TEXT")
    private String queryText;

    @Enumerated(EnumType.STRING)
    @Column(name = "query_type", nullable = false)
    private QueryType queryType;

    @Column(length = 100)
    private String jurisdiction;

    @Column(name = "research_mode", length = 20)
    private String researchMode;

    @Column(name = "practice_area", length = 100)
    private String practiceArea;

    @Column(name = "case_id", length = 50)
    private String caseId;

    @Column(name = "ai_response", nullable = false, columnDefinition = "LONGTEXT")
    private String aiResponse;

    @Column(name = "ai_model_used", length = 50)
    private String aiModelUsed;

    @Column(name = "confidence_score", precision = 3, scale = 2)
    private BigDecimal confidenceScore;

    @Builder.Default
    @Column(name = "usage_count")
    private Integer usageCount = 1;

    @CreationTimestamp
    @Column(name = "last_used")
    private LocalDateTime lastUsed;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Builder.Default
    @Column(name = "is_valid")
    private Boolean isValid = true;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}