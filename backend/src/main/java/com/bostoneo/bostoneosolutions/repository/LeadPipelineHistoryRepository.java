package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.LeadPipelineHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface LeadPipelineHistoryRepository extends JpaRepository<LeadPipelineHistory, Long> {

    List<LeadPipelineHistory> findByLeadId(Long leadId);
    
    List<LeadPipelineHistory> findByMovedBy(Long movedBy);
    
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.leadId = :leadId ORDER BY lph.movedAt DESC")
    List<LeadPipelineHistory> findByLeadIdOrderByMovedAtDesc(@Param("leadId") Long leadId);
    
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.toStageId = :stageId")
    List<LeadPipelineHistory> findByToStageId(@Param("stageId") Long stageId);
    
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.fromStageId = :stageId")
    List<LeadPipelineHistory> findByFromStageId(@Param("stageId") Long stageId);
    
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.movedAt BETWEEN :startDate AND :endDate")
    List<LeadPipelineHistory> findByMovedAtBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);
    
    @Query("SELECT AVG(lph.durationInPreviousStage) FROM LeadPipelineHistory lph WHERE lph.fromStageId = :stageId")
    Double getAverageDurationInStage(@Param("stageId") Long stageId);
    
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.automated = :automated")
    List<LeadPipelineHistory> findByAutomated(@Param("automated") Boolean automated);
    
    @Query("SELECT COUNT(lph) FROM LeadPipelineHistory lph WHERE lph.leadId = :leadId")
    long countByLeadId(@Param("leadId") Long leadId);
}