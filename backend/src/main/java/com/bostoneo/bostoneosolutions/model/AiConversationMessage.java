package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Entity representing a message in an AI conversation
 * Maps to existing ai_conversation_messages table
 */
@Entity
@Table(name = "ai_conversation_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AiConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @JsonIgnore
    private AiConversationSession session;

    @Column(name = "role", nullable = false, length = 20)
    private String role; // "user" or "assistant"

    @Column(name = "content", columnDefinition = "LONGTEXT", nullable = false)
    private String content;

    @Column(name = "model_used", length = 100)
    private String modelUsed;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(name = "cost_usd", precision = 10, scale = 4)
    private BigDecimal costUsd;

    @Column(name = "metadata", columnDefinition = "jsonb")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> metadata;

    @Column(name = "rag_context_used")
    @Builder.Default
    private Boolean ragContextUsed = false;

    @Column(name = "temperature", precision = 3, scale = 2)
    private BigDecimal temperature;

    @Column(name = "user_rating")
    private Integer userRating;

    @Column(name = "user_feedback", columnDefinition = "TEXT")
    private String userFeedback;

    @Column(name = "was_helpful")
    private Boolean wasHelpful;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Transient field for UI typing indicator
     */
    @Transient
    private Boolean isTyping = false;

    /**
     * Transient field for UI collapsed state
     */
    @Transient
    private Boolean collapsed = false;
}
