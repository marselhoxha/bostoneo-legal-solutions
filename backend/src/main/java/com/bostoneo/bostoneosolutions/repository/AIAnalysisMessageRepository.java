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
}
