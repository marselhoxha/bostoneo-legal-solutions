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
}