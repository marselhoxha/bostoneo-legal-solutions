package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIAnalysisMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Repository for AI Analysis Messages (Ask AI tab Q&A history)
 */
@Repository
public interface AIAnalysisMessageRepository extends JpaRepository<AIAnalysisMessage, Long> {

    /**
     * Find all messages for a specific analysis, ordered by creation time
     */
    List<AIAnalysisMessage> findByAnalysisIdOrderByCreatedAtAsc(Long analysisId);

    /**
     * Count messages for a specific analysis
     */
    long countByAnalysisId(Long analysisId);

    /**
     * Delete all messages for a specific analysis
     */
    @Modifying
    @Transactional
    void deleteByAnalysisId(Long analysisId);

    /**
     * Find recent messages for an analysis (for context window)
     */
    @Query("SELECT m FROM AIAnalysisMessage m WHERE m.analysisId = :analysisId ORDER BY m.createdAt DESC LIMIT :limit")
    List<AIAnalysisMessage> findRecentMessages(@Param("analysisId") Long analysisId, @Param("limit") int limit);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find all messages for a specific analysis within an organization
     */
    List<AIAnalysisMessage> findByOrganizationIdAndAnalysisIdOrderByCreatedAtAsc(Long organizationId, Long analysisId);

    /**
     * Count messages for a specific analysis within an organization
     */
    long countByOrganizationIdAndAnalysisId(Long organizationId, Long analysisId);

    /**
     * Delete all messages for a specific analysis within an organization
     */
    @Modifying
    @Transactional
    void deleteByOrganizationIdAndAnalysisId(Long organizationId, Long analysisId);

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    java.util.Optional<AIAnalysisMessage> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}
