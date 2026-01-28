package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.LeadPipelineHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

/**
 * Repository for LeadPipelineHistory entity with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface LeadPipelineHistoryRepository extends JpaRepository<LeadPipelineHistory, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<LeadPipelineHistory> findByIdAndOrganizationId(Long id, Long organizationId);

    List<LeadPipelineHistory> findByOrganizationIdAndLeadId(Long organizationId, Long leadId);

    List<LeadPipelineHistory> findByOrganizationIdAndMovedBy(Long organizationId, Long movedBy);

    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.leadId = :leadId ORDER BY lph.movedAt DESC")
    List<LeadPipelineHistory> findByOrganizationIdAndLeadIdOrderByMovedAtDesc(@Param("orgId") Long organizationId, @Param("leadId") Long leadId);

    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.toStageId = :stageId")
    List<LeadPipelineHistory> findByOrganizationIdAndToStageId(@Param("orgId") Long organizationId, @Param("stageId") Long stageId);

    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.fromStageId = :stageId")
    List<LeadPipelineHistory> findByOrganizationIdAndFromStageId(@Param("orgId") Long organizationId, @Param("stageId") Long stageId);

    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.movedAt BETWEEN :startDate AND :endDate")
    List<LeadPipelineHistory> findByOrganizationIdAndMovedAtBetween(@Param("orgId") Long organizationId, @Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);

    @Query("SELECT AVG(lph.durationInPreviousStage) FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.fromStageId = :stageId")
    Double getAverageDurationInStageByOrganizationId(@Param("orgId") Long organizationId, @Param("stageId") Long stageId);

    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.automated = :automated")
    List<LeadPipelineHistory> findByOrganizationIdAndAutomated(@Param("orgId") Long organizationId, @Param("automated") Boolean automated);

    @Query("SELECT COUNT(lph) FROM LeadPipelineHistory lph WHERE lph.organizationId = :orgId AND lph.leadId = :leadId")
    long countByOrganizationIdAndLeadId(@Param("orgId") Long organizationId, @Param("leadId") Long leadId);

    /**
     * SECURITY: Find all lead pipeline history for an organization (tenant isolation)
     */
    List<LeadPipelineHistory> findByOrganizationId(Long organizationId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Entity LeadPipelineHistory lacks organization_id - requires migration.
    // All methods below bypass multi-tenant isolation.

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<LeadPipelineHistory> findByLeadId(Long leadId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    List<LeadPipelineHistory> findByMovedBy(Long movedBy);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.leadId = :leadId ORDER BY lph.movedAt DESC")
    List<LeadPipelineHistory> findByLeadIdOrderByMovedAtDesc(@Param("leadId") Long leadId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.toStageId = :stageId")
    List<LeadPipelineHistory> findByToStageId(@Param("stageId") Long stageId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.fromStageId = :stageId")
    List<LeadPipelineHistory> findByFromStageId(@Param("stageId") Long stageId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.movedAt BETWEEN :startDate AND :endDate")
    List<LeadPipelineHistory> findByMovedAtBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT AVG(lph.durationInPreviousStage) FROM LeadPipelineHistory lph WHERE lph.fromStageId = :stageId")
    Double getAverageDurationInStage(@Param("stageId") Long stageId);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT lph FROM LeadPipelineHistory lph WHERE lph.automated = :automated")
    List<LeadPipelineHistory> findByAutomated(@Param("automated") Boolean automated);

    /** @deprecated Entity lacks organization_id - requires migration for tenant isolation */
    @Deprecated
    @Query("SELECT COUNT(lph) FROM LeadPipelineHistory lph WHERE lph.leadId = :leadId")
    long countByLeadId(@Param("leadId") Long leadId);
}