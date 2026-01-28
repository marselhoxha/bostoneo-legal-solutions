package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIUsageMetrics;
import com.bostoneo.bostoneosolutions.enumeration.FeatureType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for AIUsageMetrics entity with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface AIUsageMetricsRepository extends JpaRepository<AIUsageMetrics, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<AIUsageMetrics> findByIdAndOrganizationId(Long id, Long organizationId);

    List<AIUsageMetrics> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(Long organizationId, Long userId);

    List<AIUsageMetrics> findByOrganizationIdAndUserId(Long organizationId, Long userId);

    List<AIUsageMetrics> findByOrganizationIdAndCaseId(Long organizationId, Long caseId);

    List<AIUsageMetrics> findByOrganizationIdAndFeatureType(Long organizationId, FeatureType featureType);

    List<AIUsageMetrics> findByOrganizationIdAndUserIdAndFeatureType(Long organizationId, Long userId, FeatureType featureType);

    List<AIUsageMetrics> findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(Long organizationId, Long caseId);

    @Query("SELECT um FROM AIUsageMetrics um WHERE um.organizationId = :orgId AND um.userId = :userId " +
           "AND um.createdAt BETWEEN :startDate AND :endDate ORDER BY um.createdAt DESC")
    List<AIUsageMetrics> findByOrganizationIdAndUserIdAndDateRange(@Param("orgId") Long organizationId,
                                                                    @Param("userId") Long userId,
                                                                    @Param("startDate") LocalDateTime startDate,
                                                                    @Param("endDate") LocalDateTime endDate);

    @Query("SELECT SUM(um.timeSavedMinutes) FROM AIUsageMetrics um WHERE um.organizationId = :orgId AND um.userId = :userId")
    Integer getTotalTimeSavedByUserAndOrganizationId(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    @Query("SELECT SUM(um.tokensUsed) FROM AIUsageMetrics um WHERE um.organizationId = :orgId AND um.userId = :userId")
    Integer getTotalTokensUsedByUserAndOrganizationId(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Entity lacks organization_id - requires migration for tenant isolation.

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<AIUsageMetrics> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<AIUsageMetrics> findByUserId(Long userId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<AIUsageMetrics> findByCaseId(Long caseId);

    /** @deprecated Entity lacks organization_id - may return data from all organizations */
    @Deprecated
    List<AIUsageMetrics> findByFeatureType(FeatureType featureType);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<AIUsageMetrics> findByUserIdAndFeatureType(Long userId, FeatureType featureType);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<AIUsageMetrics> findByCaseIdOrderByCreatedAtDesc(Long caseId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT um FROM AIUsageMetrics um WHERE um.userId = :userId AND um.createdAt BETWEEN :startDate AND :endDate ORDER BY um.createdAt DESC")
    List<AIUsageMetrics> findByUserIdAndDateRange(@Param("userId") Long userId,
                                                  @Param("startDate") LocalDateTime startDate,
                                                  @Param("endDate") LocalDateTime endDate);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT SUM(um.timeSavedMinutes) FROM AIUsageMetrics um WHERE um.userId = :userId")
    Integer getTotalTimeSavedByUser(@Param("userId") Long userId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT SUM(um.tokensUsed) FROM AIUsageMetrics um WHERE um.userId = :userId")
    Integer getTotalTokensUsedByUser(@Param("userId") Long userId);
}
