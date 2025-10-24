package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Entity representing an AI conversation session
 * Maps to existing ai_conversation_sessions table
 */
@Entity
@Table(name = "ai_conversation_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AiConversationSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_name", length = 255)
    private String sessionName;

    @Column(name = "session_type", length = 50)
    @Builder.Default
    private String sessionType = "general";

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "practice_area", length = 100)
    private String practiceArea;

    @Column(name = "context_summary", columnDefinition = "TEXT")
    private String contextSummary;

    @Column(name = "primary_topic", length = 255)
    private String primaryTopic;

    @Column(name = "key_entities", columnDefinition = "JSON")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> keyEntities;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "is_pinned")
    @Builder.Default
    private Boolean isPinned = false;

    @Column(name = "is_archived")
    @Builder.Default
    private Boolean isArchived = false;

    @Column(name = "message_count")
    @Builder.Default
    private Integer messageCount = 0;

    @Column(name = "total_tokens_used")
    @Builder.Default
    private Integer totalTokensUsed = 0;

    @Column(name = "total_cost_usd", precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal totalCostUsd = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "last_interaction_at")
    private LocalDateTime lastInteractionAt;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<AiConversationMessage> messages = new ArrayList<>();

    /**
     * Helper method to add a message to the session
     */
    public void addMessage(AiConversationMessage message) {
        messages.add(message);
        message.setSession(this);
        this.messageCount = messages.size();
    }

    /**
     * Helper method to archive the session
     */
    public void archive() {
        this.isArchived = true;
        this.isActive = false;
        this.archivedAt = LocalDateTime.now();
    }
}
