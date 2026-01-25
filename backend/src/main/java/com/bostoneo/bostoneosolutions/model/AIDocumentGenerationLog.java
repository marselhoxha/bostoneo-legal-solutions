package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.GenerationType;
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
@Table(name = "ai_document_generation_log")
public class AIDocumentGenerationLog {
    @Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private Long id;

    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "generated_file_id")
    private Long generatedFileId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "generation_type", nullable = false)
    private GenerationType generationType;

    @Column(name = "input_data", columnDefinition = "TEXT")
    private String inputData;

    @Column(name = "variables_used", columnDefinition = "TEXT")
    private String variablesUsed;

    @Column(name = "ai_model_used", length = 50)
    private String aiModelUsed;

    @Column(name = "processing_time_ms")
    private Integer processingTimeMs;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(name = "cost_estimate", precision = 8, scale = 4)
    private BigDecimal costEstimate;

    @Builder.Default
    @Column(name = "success")
    private Boolean success = true;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "quality_score", precision = 3, scale = 2)
    private BigDecimal qualityScore;

    @Column(name = "user_rating")
    private Integer userRating;

    @Column(name = "user_feedback", columnDefinition = "TEXT")
    private String userFeedback;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}