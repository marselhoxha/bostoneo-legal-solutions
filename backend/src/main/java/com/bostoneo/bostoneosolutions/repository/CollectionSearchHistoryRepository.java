package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CollectionSearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing collection search history with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface CollectionSearchHistoryRepository extends JpaRepository<CollectionSearchHistory, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<CollectionSearchHistory> findByIdAndOrganizationId(Long id, Long organizationId);

    @Query("SELECT DISTINCT h.query FROM CollectionSearchHistory h " +
           "WHERE h.organizationId = :orgId AND h.collectionId = :collectionId AND h.userId = :userId " +
           "AND LOWER(h.query) LIKE LOWER(CONCAT('%', :partialQuery, '%')) " +
           "ORDER BY h.createdAt DESC")
    List<String> findRecentSearchesByUserAndOrganizationId(
            @Param("orgId") Long organizationId,
            @Param("collectionId") Long collectionId,
            @Param("userId") Long userId,
            @Param("partialQuery") String partialQuery);

    @Query("SELECT h.query, COUNT(h) as cnt FROM CollectionSearchHistory h " +
           "WHERE h.organizationId = :orgId AND h.collectionId = :collectionId " +
           "AND LOWER(h.query) LIKE LOWER(CONCAT('%', :partialQuery, '%')) " +
           "GROUP BY h.query ORDER BY cnt DESC")
    List<Object[]> findPopularSearchesByOrganizationId(
            @Param("orgId") Long organizationId,
            @Param("collectionId") Long collectionId,
            @Param("partialQuery") String partialQuery);

    @Query("SELECT DISTINCT h.query FROM CollectionSearchHistory h " +
           "WHERE h.organizationId = :orgId AND h.collectionId = :collectionId")
    List<String> findDistinctQueriesByCollectionAndOrganizationId(
            @Param("orgId") Long organizationId, @Param("collectionId") Long collectionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionSearchHistory h WHERE h.organizationId = :orgId AND h.collectionId = :collectionId")
    void deleteByOrganizationIdAndCollectionId(@Param("orgId") Long organizationId, @Param("collectionId") Long collectionId);

    long countByOrganizationIdAndCollectionId(Long organizationId, Long collectionId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Verify collection ownership through DocumentCollection.organizationId before calling.

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Query("SELECT DISTINCT h.query FROM CollectionSearchHistory h " +
           "WHERE h.collectionId = :collectionId AND h.userId = :userId " +
           "AND LOWER(h.query) LIKE LOWER(CONCAT('%', :partialQuery, '%')) " +
           "ORDER BY h.createdAt DESC")
    List<String> findRecentSearchesByUser(
            @Param("collectionId") Long collectionId,
            @Param("userId") Long userId,
            @Param("partialQuery") String partialQuery);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Query("SELECT h.query, COUNT(h) as cnt FROM CollectionSearchHistory h " +
           "WHERE h.collectionId = :collectionId " +
           "AND LOWER(h.query) LIKE LOWER(CONCAT('%', :partialQuery, '%')) " +
           "GROUP BY h.query " +
           "ORDER BY cnt DESC")
    List<Object[]> findPopularSearches(
            @Param("collectionId") Long collectionId,
            @Param("partialQuery") String partialQuery);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Query("SELECT DISTINCT h.query FROM CollectionSearchHistory h " +
           "WHERE h.collectionId = :collectionId")
    List<String> findDistinctQueriesByCollection(@Param("collectionId") Long collectionId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    long countByCollectionId(Long collectionId);
}
