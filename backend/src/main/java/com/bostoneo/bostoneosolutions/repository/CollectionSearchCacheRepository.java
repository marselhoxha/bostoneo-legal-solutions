package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CollectionSearchCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Repository for managing collection search cache entries.
 */
@Repository
public interface CollectionSearchCacheRepository extends JpaRepository<CollectionSearchCache, Long> {

    /**
     * Find cached search result by collection, query hash, and user.
     */
    Optional<CollectionSearchCache> findByCollectionIdAndQueryHashAndUserId(
            Long collectionId, String queryHash, Long userId);

    /**
     * Find cached search result by collection and query hash (any user).
     * Useful for shared cache across users in same collection.
     */
    Optional<CollectionSearchCache> findByCollectionIdAndQueryHash(Long collectionId, String queryHash);

    /**
     * Delete all cache entries for a specific collection.
     * Called when documents are added/removed from the collection.
     */
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);

    /**
     * Delete all expired cache entries.
     * Should be called by a scheduled task.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionSearchCache c WHERE c.expiresAt < :now")
    int deleteExpiredCache(@Param("now") LocalDateTime now);

    /**
     * Count cache entries for a collection (for monitoring).
     */
    long countByCollectionId(Long collectionId);
}
