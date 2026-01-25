package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entity for caching semantic search results to avoid repeated API calls.
 * Cache entries expire after 24 hours or when collection documents change.
 */
@Entity
@Table(name = "collection_search_cache")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionSearchCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "collection_id", nullable = false)
    private Long collectionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "query", nullable = false, length = 500)
    private String query;

    @Column(name = "query_hash", nullable = false, length = 64)
    private String queryHash;

    @Column(name = "expanded_query", length = 1000)
    private String expandedQuery;

    @Column(name = "results_json", columnDefinition = "TEXT")
    private String resultsJson;

    @Column(name = "result_count")
    @Builder.Default
    private Integer resultCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /**
     * Check if this cache entry has expired.
     */
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }
}
