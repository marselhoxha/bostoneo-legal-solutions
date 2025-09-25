package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIUsageMetrics;
import com.bostoneo.bostoneosolutions.enumeration.FeatureType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AIUsageMetricsRepository extends JpaRepository<AIUsageMetrics, Long> {
    
    List<AIUsageMetrics> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<AIUsageMetrics> findByUserId(Long userId);
    
    List<AIUsageMetrics> findByCaseId(Long caseId);
    
    List<AIUsageMetrics> findByFeatureType(FeatureType featureType);
    
    List<AIUsageMetrics> findByUserIdAndFeatureType(Long userId, FeatureType featureType);
    
    List<AIUsageMetrics> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    @Query("SELECT um FROM AIUsageMetrics um WHERE um.userId = :userId AND um.createdAt BETWEEN :startDate AND :endDate ORDER BY um.createdAt DESC")
    List<AIUsageMetrics> findByUserIdAndDateRange(@Param("userId") Long userId, 
                                                  @Param("startDate") LocalDateTime startDate, 
                                                  @Param("endDate") LocalDateTime endDate);
                                                  
    @Query("SELECT SUM(um.timeSavedMinutes) FROM AIUsageMetrics um WHERE um.userId = :userId")
    Integer getTotalTimeSavedByUser(@Param("userId") Long userId);
    
    @Query("SELECT SUM(um.tokensUsed) FROM AIUsageMetrics um WHERE um.userId = :userId")
    Integer getTotalTokensUsedByUser(@Param("userId") Long userId);
}
