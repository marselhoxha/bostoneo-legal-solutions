package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CollectionSearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Repository for managing collection search history for autocomplete suggestions.
 */
@Repository
public interface CollectionSearchHistoryRepository extends JpaRepository<CollectionSearchHistory, Long> {

    /**
     * Find recent searches for a user in a collection, ordered by most recent.
     * Used for history-based suggestions.
     */
    @Query("SELECT DISTINCT h.query FROM CollectionSearchHistory h " +
           "WHERE h.collectionId = :collectionId AND h.userId = :userId " +
           "AND LOWER(h.query) LIKE LOWER(CONCAT('%', :partialQuery, '%')) " +
           "ORDER BY h.createdAt DESC")
    List<String> findRecentSearchesByUser(
            @Param("collectionId") Long collectionId,
            @Param("userId") Long userId,
            @Param("partialQuery") String partialQuery);

    /**
     * Find popular searches in a collection (across all users).
     * Used for popular suggestion fallback.
     */
    @Query("SELECT h.query, COUNT(h) as cnt FROM CollectionSearchHistory h " +
           "WHERE h.collectionId = :collectionId " +
           "AND LOWER(h.query) LIKE LOWER(CONCAT('%', :partialQuery, '%')) " +
           "GROUP BY h.query " +
           "ORDER BY cnt DESC")
    List<Object[]> findPopularSearches(
            @Param("collectionId") Long collectionId,
            @Param("partialQuery") String partialQuery);

    /**
     * Get distinct queries for a collection (for admin/analytics).
     */
    @Query("SELECT DISTINCT h.query FROM CollectionSearchHistory h " +
           "WHERE h.collectionId = :collectionId")
    List<String> findDistinctQueriesByCollection(@Param("collectionId") Long collectionId);

    /**
     * Delete all history for a collection.
     */
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);

    /**
     * Count searches in a collection.
     */
    long countByCollectionId(Long collectionId);
}
