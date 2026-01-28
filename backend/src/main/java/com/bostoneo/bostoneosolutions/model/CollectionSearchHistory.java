package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entity for storing search history to provide autocomplete suggestions.
 * Tracks user searches within each collection.
 */
@Entity
@Table(name = "collection_search_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionSearchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * SECURITY: Organization ID for multi-tenant isolation
     */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "collection_id", nullable = false)
    private Long collectionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "query", nullable = false, length = 500)
    private String query;

    @Column(name = "result_count")
    @Builder.Default
    private Integer resultCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
