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
 * Repository for managing collection search cache entries with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface CollectionSearchCacheRepository extends JpaRepository<CollectionSearchCache, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<CollectionSearchCache> findByIdAndOrganizationId(Long id, Long organizationId);

    Optional<CollectionSearchCache> findByOrganizationIdAndCollectionIdAndQueryHashAndUserId(
            Long organizationId, Long collectionId, String queryHash, Long userId);

    Optional<CollectionSearchCache> findByOrganizationIdAndCollectionIdAndQueryHash(
            Long organizationId, Long collectionId, String queryHash);

    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionSearchCache c WHERE c.organizationId = :orgId AND c.collectionId = :collectionId")
    void deleteByOrganizationIdAndCollectionId(@Param("orgId") Long organizationId, @Param("collectionId") Long collectionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionSearchCache c WHERE c.organizationId = :orgId AND c.expiresAt < :now")
    int deleteExpiredCacheByOrganizationId(@Param("orgId") Long organizationId, @Param("now") LocalDateTime now);

    long countByOrganizationIdAndCollectionId(Long organizationId, Long collectionId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: These methods bypass multi-tenant isolation.
    // Use tenant-filtered versions that verify collection ownership.

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    Optional<CollectionSearchCache> findByCollectionIdAndQueryHashAndUserId(
            Long collectionId, String queryHash, Long userId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    Optional<CollectionSearchCache> findByCollectionIdAndQueryHash(Long collectionId, String queryHash);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);

    /** @deprecated Should filter by organization when cleaning up cache */
    @Deprecated
    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionSearchCache c WHERE c.expiresAt < :now")
    int deleteExpiredCache(@Param("now") LocalDateTime now);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    long countByCollectionId(Long collectionId);
}
