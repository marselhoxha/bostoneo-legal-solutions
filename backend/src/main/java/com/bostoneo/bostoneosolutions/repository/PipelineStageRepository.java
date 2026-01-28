package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PipelineStage;
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

    // Tenant-filtered methods - includes system stages and org-specific stages
    @Query("SELECT ps FROM PipelineStage ps WHERE ps.isActive = true " +
           "AND (ps.isSystem = true OR ps.organizationId = :organizationId) " +
           "ORDER BY ps.stageOrder ASC")
    List<PipelineStage> findAllActiveStagesByOrganizationId(@Param("organizationId") Long organizationId);

    @Query("SELECT ps FROM PipelineStage ps WHERE (ps.isSystem = true OR ps.organizationId = :organizationId) " +
           "AND ps.id = :id")
    java.util.Optional<PipelineStage> findByIdAndOrganizationIdOrSystem(@Param("id") Long id, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find pipeline stage by ID and organization (tenant isolation)
     */
    java.util.Optional<PipelineStage> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find all pipeline stages for an organization (tenant isolation)
     */
    List<PipelineStage> findByOrganizationId(Long organizationId);
}