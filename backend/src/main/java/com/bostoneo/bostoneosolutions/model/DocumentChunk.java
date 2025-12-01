package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Represents a chunk of a document for semantic search (RAG).
 * Documents are split into smaller chunks for efficient embedding and retrieval.
 */
@Entity
@Table(name = "document_chunks", indexes = {
    @Index(name = "idx_chunk_analysis_id", columnList = "analysis_id"),
    @Index(name = "idx_chunk_collection_id", columnList = "collection_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "collection_id")
    private Long collectionId;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "section_title")
    private String sectionTitle;

    @Column(name = "token_count")
    private Integer tokenCount;

    /**
     * Embedding vector stored as JSON array of floats.
     * Example: [0.123, -0.456, 0.789, ...]
     * OpenAI embeddings are 1536 dimensions (text-embedding-ada-002)
     * or 3072 dimensions (text-embedding-3-large)
     */
    @Column(name = "embedding", columnDefinition = "JSON")
    private String embedding;

    @Column(name = "embedding_model")
    private String embeddingModel;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
