package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIResearchCache;
import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AIResearchCacheRepository extends JpaRepository<AIResearchCache, Long> {

    Optional<AIResearchCache> findByQueryHash(String queryHash);

    List<AIResearchCache> findByQueryTypeAndIsValidTrue(QueryType queryType);

    List<AIResearchCache> findByJurisdictionAndIsValidTrue(String jurisdiction);

    @Query("SELECT c FROM AIResearchCache c WHERE c.expiresAt < :now")
    List<AIResearchCache> findExpiredCaches(@Param("now") LocalDateTime now);

    @Query("SELECT c FROM AIResearchCache c WHERE c.usageCount > :minUsage ORDER BY c.usageCount DESC")
    List<AIResearchCache> findMostUsedCaches(@Param("minUsage") Integer minUsage);

    void deleteByExpiresAtBefore(LocalDateTime cutoffDate);

    // Cache statistics queries
    @Query("SELECT COUNT(c) FROM AIResearchCache c WHERE c.isValid = true")
    long countValidCaches();

    @Query("SELECT COUNT(c) FROM AIResearchCache c WHERE c.expiresAt < :now")
    long countExpiredCaches(@Param("now") LocalDateTime now);

    @Query("SELECT SUM(c.usageCount) FROM AIResearchCache c WHERE c.isValid = true")
    Long getTotalCacheHits();

    @Query("SELECT AVG(c.usageCount) FROM AIResearchCache c WHERE c.isValid = true")
    Double getAverageCacheHits();

    @Query("SELECT c.queryType, COUNT(c) FROM AIResearchCache c WHERE c.isValid = true GROUP BY c.queryType")
    List<Object[]> getCacheCountByQueryType();

    // ==================== TENANT-FILTERED METHODS ====================

    List<AIResearchCache> findByOrganizationId(Long organizationId);

    Optional<AIResearchCache> findByOrganizationIdAndQueryHash(Long organizationId, String queryHash);

    List<AIResearchCache> findByOrganizationIdAndQueryTypeAndIsValidTrue(Long organizationId, QueryType queryType);

    @Query("SELECT c FROM AIResearchCache c WHERE c.organizationId = :organizationId AND c.usageCount > :minUsage ORDER BY c.usageCount DESC")
    List<AIResearchCache> findMostUsedCachesByOrganization(@Param("organizationId") Long organizationId, @Param("minUsage") Integer minUsage);

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    Optional<AIResearchCache> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}
