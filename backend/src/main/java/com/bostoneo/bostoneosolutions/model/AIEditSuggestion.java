package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.SuggestionType;
import com.bostoneo.bostoneosolutions.enumeration.Priority;
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
@Table(name = "ai_edit_suggestions")
public class AIEditSuggestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Builder.Default
    @Column(name = "suggested_by_ai")
    private Boolean suggestedByAi = true;

    @Column(name = "suggested_by_user")
    private Long suggestedByUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "suggestion_type", nullable = false)
    private SuggestionType suggestionType;

    @Column(name = "original_text", columnDefinition = "TEXT")
    private String originalText;

    @Column(name = "suggested_text", columnDefinition = "TEXT")
    private String suggestedText;

    @Column(name = "suggestion_explanation", columnDefinition = "TEXT")
    private String suggestionExplanation;

    @Column(name = "position_start")
    private Integer positionStart;

    @Column(name = "position_end")
    private Integer positionEnd;

    @Builder.Default
    @Column(name = "confidence_score", precision = 3, scale = 2)
    private BigDecimal confidenceScore = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "is_accepted")
    private Boolean isAccepted = false;

    @Builder.Default
    @Column(name = "is_rejected")
    private Boolean isRejected = false;

    @Column(name = "accepted_by")
    private Long acceptedBy;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    private Priority priority = Priority.MEDIUM;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}