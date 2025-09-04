package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.PipelineStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PipelineStageRepository extends JpaRepository<PipelineStage, Long> {

    List<PipelineStage> findByIsActiveOrderByStageOrder(Boolean isActive);
    
    @Query("SELECT ps FROM PipelineStage ps WHERE ps.isActive = true ORDER BY ps.stageOrder ASC")
    List<PipelineStage> findAllActiveStages();
    
    @Query("SELECT ps FROM PipelineStage ps WHERE ps.name = :name AND ps.isActive = true")
    PipelineStage findByNameAndIsActive(@Param("name") String name);
    
    @Query("SELECT ps FROM PipelineStage ps ORDER BY ps.stageOrder ASC")
    List<PipelineStage> findAllOrderByStageOrder();
    
    @Query("SELECT COUNT(ps) FROM PipelineStage ps WHERE ps.isActive = true")
    long countActiveStages();
}