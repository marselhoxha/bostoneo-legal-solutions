package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_workspace_document_versions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiWorkspaceDocumentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private AiWorkspaceDocument document;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "content_html", columnDefinition = "TEXT")
    private String contentHtml;

    @Column(name = "word_count")
    private Integer wordCount;

    @Column(name = "transformation_type", length = 50)
    private String transformationType;

    @Column(name = "transformation_scope", length = 20)
    private String transformationScope; // FULL_DOCUMENT or SELECTION

    @Column(name = "selected_text", columnDefinition = "TEXT")
    private String selectedText;

    @Column(name = "selection_start_index")
    private Integer selectionStartIndex;

    @Column(name = "selection_end_index")
    private Integer selectionEndIndex;

    @Column(name = "transformed_selection", columnDefinition = "TEXT")
    private String transformedSelection; // For selection scope: only the AI-transformed snippet

    @Column(name = "created_by_user")
    @Builder.Default
    private Boolean createdByUser = false;

    @Column(name = "version_note", length = 500)
    private String versionNote;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(name = "cost_estimate", precision = 10, scale = 4)
    private BigDecimal costEstimate;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    // Enums for type safety
    public enum TransformationType {
        SIMPLIFY, CONDENSE, EXPAND, FORMAL, PERSUASIVE, REDRAFT,
        STRENGTHEN, CITE, MANUAL_EDIT, INITIAL_GENERATION
    }

    public enum TransformationScope {
        FULL_DOCUMENT, SELECTION
    }
}
