package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AIDocumentAnalysisRepository extends JpaRepository<AIDocumentAnalysis, Long> {

    Optional<AIDocumentAnalysis> findByAnalysisId(String analysisId);

    List<AIDocumentAnalysis> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AIDocumentAnalysis> findByCaseIdOrderByCreatedAtDesc(Long caseId);

    List<AIDocumentAnalysis> findByAnalysisTypeOrderByCreatedAtDesc(String analysisType);

    List<AIDocumentAnalysis> findByStatusOrderByCreatedAtDesc(String status);

    @Query("SELECT a FROM AIDocumentAnalysis a WHERE a.userId = :userId " +
           "AND a.createdAt BETWEEN :startDate AND :endDate " +
           "ORDER BY a.createdAt DESC")
    List<AIDocumentAnalysis> findByUserIdAndDateRange(
            @Param("userId") Long userId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    @Query("SELECT a FROM AIDocumentAnalysis a WHERE a.riskScore >= :minScore " +
           "AND a.isArchived = false ORDER BY a.riskScore DESC")
    List<AIDocumentAnalysis> findHighRiskDocuments(@Param("minScore") Integer minScore);

    @Query("SELECT COUNT(a) FROM AIDocumentAnalysis a WHERE a.userId = :userId " +
           "AND a.createdAt >= :since")
    Long countRecentAnalysesByUser(
            @Param("userId") Long userId,
            @Param("since") LocalDateTime since);

    @Query("SELECT SUM(a.tokensUsed) FROM AIDocumentAnalysis a WHERE a.userId = :userId " +
           "AND a.createdAt >= :since")
    Long getTotalTokensUsedByUser(
            @Param("userId") Long userId,
            @Param("since") LocalDateTime since);

    @Query("SELECT AVG(a.processingTimeMs) FROM AIDocumentAnalysis a " +
           "WHERE a.analysisType = :type AND a.status = 'completed'")
    Double getAverageProcessingTime(@Param("type") String analysisType);

    List<AIDocumentAnalysis> findTop10ByUserIdAndIsArchivedFalseOrderByCreatedAtDesc(Long userId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find analysis by ID and organization (SECURITY: tenant isolation)
     */
    Optional<AIDocumentAnalysis> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find analysis by analysisId and organization (SECURITY: tenant isolation)
     */
    Optional<AIDocumentAnalysis> findByAnalysisIdAndOrganizationId(String analysisId, Long organizationId);

    /**
     * Find all analyses for an organization (SECURITY: tenant isolation)
     */
    List<AIDocumentAnalysis> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * SECURITY: Find all analyses for an organization (simple list)
     */
    List<AIDocumentAnalysis> findByOrganizationId(Long organizationId);

    /**
     * Find analyses by user within an organization (SECURITY: tenant isolation)
     */
    List<AIDocumentAnalysis> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(Long organizationId, Long userId);

    /**
     * Find analyses by case within an organization (SECURITY: tenant isolation)
     */
    List<AIDocumentAnalysis> findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(Long organizationId, Long caseId);

    /**
     * Find recent analyses within an organization (SECURITY: tenant isolation)
     */
    List<AIDocumentAnalysis> findTop10ByOrganizationIdAndIsArchivedFalseOrderByCreatedAtDesc(Long organizationId);

    /**
     * Count analyses by organization
     */
    @Query("SELECT COUNT(a) FROM AIDocumentAnalysis a WHERE a.organizationId = :orgId AND a.createdAt >= :since")
    Long countRecentAnalysesByOrganization(@Param("orgId") Long organizationId, @Param("since") LocalDateTime since);

    /**
     * Check if analysis exists and belongs to organization (SECURITY: tenant isolation)
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}