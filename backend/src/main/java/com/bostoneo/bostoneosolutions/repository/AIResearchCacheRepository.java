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
}
