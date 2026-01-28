package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entity for storing Ask AI messages related to a specific document analysis.
 * Each message is tied to an analysis and persists Q&A history.
 */
@Entity
@Table(name = "ai_analysis_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIAnalysisMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "role", nullable = false)
    private String role; // 'user' or 'assistant'

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "organization_id")
    private Long organizationId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // Optional: metadata for additional context (e.g., tokens used, model info)
    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;
}
