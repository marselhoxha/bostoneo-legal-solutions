package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIPatentSearch;
import com.bostoneo.bostoneosolutions.enumeration.SearchType;
import com.bostoneo.bostoneosolutions.enumeration.RiskLevel;
import com.bostoneo.bostoneosolutions.enumeration.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface AIPatentSearchRepository extends JpaRepository<AIPatentSearch, Long> {
    
    List<AIPatentSearch> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    List<AIPatentSearch> findBySearchType(SearchType searchType);
    
    List<AIPatentSearch> findByRiskAssessment(RiskLevel riskLevel);
    
    List<AIPatentSearch> findByReviewStatus(ReviewStatus reviewStatus);
    
    List<AIPatentSearch> findByInventionTitleContainingIgnoreCase(String title);
    
    List<AIPatentSearch> findBySearcherName(String searcherName);
    
    List<AIPatentSearch> findBySearchDateBetween(LocalDate startDate, LocalDate endDate);
    
    @Query("SELECT ps FROM AIPatentSearch ps WHERE ps.patentabilityScore >= :minScore ORDER BY ps.patentabilityScore DESC")
    List<AIPatentSearch> findByPatentabilityScoreGreaterThanEqual(@Param("minScore") BigDecimal minScore);
    
    @Query("SELECT ps FROM AIPatentSearch ps WHERE ps.aiAnalysisConfidence >= :minConfidence ORDER BY ps.aiAnalysisConfidence DESC")
    List<AIPatentSearch> findByHighConfidence(@Param("minConfidence") BigDecimal minConfidence);
    
    @Query("SELECT ps FROM AIPatentSearch ps WHERE ps.caseId = :caseId AND ps.searchType = :searchType ORDER BY ps.createdAt DESC")
    List<AIPatentSearch> findByCaseIdAndSearchType(@Param("caseId") Long caseId, @Param("searchType") SearchType searchType);
    
    @Query("SELECT ps FROM AIPatentSearch ps WHERE ps.reviewStatus = 'PENDING' ORDER BY ps.createdAt ASC")
    List<AIPatentSearch> findPendingReviews();
}