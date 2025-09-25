package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.FeatureType;
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
@Table(name = "ai_usage_metrics")
public class AIUsageMetrics {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "case_id")
    private Long caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature_type", nullable = false)
    private FeatureType featureType;

    @Column(name = "action_taken", length = 200)
    private String actionTaken;

    @Column(name = "time_saved_minutes")
    private Integer timeSavedMinutes;

    @Column(name = "cost_estimate", precision = 10, scale = 4)
    private BigDecimal costEstimate;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(name = "ai_model_used", length = 50)
    private String aiModelUsed;

    @Column(name = "success_rate", precision = 3, scale = 2)
    private BigDecimal successRate;

    @Column(name = "user_satisfaction_rating")
    private Integer userSatisfactionRating;

    @Column(name = "efficiency_gain_percentage", precision = 5, scale = 2)
    private BigDecimal efficiencyGainPercentage;

    @Builder.Default
    @Column(name = "error_count")
    private Integer errorCount = 0;

    @Column(name = "session_duration_minutes")
    private Integer sessionDurationMinutes;

    @Builder.Default
    @Column(name = "documents_processed")
    private Integer documentsProcessed = 0;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}