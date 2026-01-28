package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.DocumentRelationship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRelationshipRepository extends JpaRepository<DocumentRelationship, Long> {

    // Find all relationships where document is source
    List<DocumentRelationship> findBySourceAnalysisId(Long sourceAnalysisId);

    // Find all relationships where document is target
    List<DocumentRelationship> findByTargetAnalysisId(Long targetAnalysisId);

    // Find all relationships for a document (either source or target)
    @Query("SELECT r FROM DocumentRelationship r WHERE r.sourceAnalysisId = :analysisId OR r.targetAnalysisId = :analysisId")
    List<DocumentRelationship> findAllByAnalysisId(@Param("analysisId") Long analysisId);

    // Find specific relationship
    Optional<DocumentRelationship> findBySourceAnalysisIdAndTargetAnalysisIdAndRelationshipType(
            Long sourceAnalysisId, Long targetAnalysisId, String relationshipType);

    // Check if relationship exists
    boolean existsBySourceAnalysisIdAndTargetAnalysisIdAndRelationshipType(
            Long sourceAnalysisId, Long targetAnalysisId, String relationshipType);

    // Delete all relationships for a document
    void deleteBySourceAnalysisIdOrTargetAnalysisId(Long sourceId, Long targetId);

    // ==================== TENANT-FILTERED METHODS (SECURE) ====================

    // SECURITY: Find by source with org filter
    @Query("SELECT r FROM DocumentRelationship r WHERE r.sourceAnalysisId = :sourceAnalysisId AND r.organizationId = :orgId")
    List<DocumentRelationship> findBySourceAnalysisIdAndOrganizationId(
            @Param("sourceAnalysisId") Long sourceAnalysisId, @Param("orgId") Long organizationId);

    // SECURITY: Find by target with org filter
    @Query("SELECT r FROM DocumentRelationship r WHERE r.targetAnalysisId = :targetAnalysisId AND r.organizationId = :orgId")
    List<DocumentRelationship> findByTargetAnalysisIdAndOrganizationId(
            @Param("targetAnalysisId") Long targetAnalysisId, @Param("orgId") Long organizationId);

    // SECURITY: Find all by analysis with org filter
    @Query("SELECT r FROM DocumentRelationship r WHERE (r.sourceAnalysisId = :analysisId OR r.targetAnalysisId = :analysisId) AND r.organizationId = :orgId")
    List<DocumentRelationship> findAllByAnalysisIdAndOrganizationId(
            @Param("analysisId") Long analysisId, @Param("orgId") Long organizationId);

    // SECURITY: Find specific relationship with org filter
    @Query("SELECT r FROM DocumentRelationship r WHERE r.sourceAnalysisId = :sourceId AND r.targetAnalysisId = :targetId AND r.relationshipType = :type AND r.organizationId = :orgId")
    Optional<DocumentRelationship> findBySourceAndTargetAndTypeAndOrganizationId(
            @Param("sourceId") Long sourceAnalysisId, @Param("targetId") Long targetAnalysisId,
            @Param("type") String relationshipType, @Param("orgId") Long organizationId);

    // SECURITY: Check existence with org filter
    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END FROM DocumentRelationship r WHERE r.sourceAnalysisId = :sourceId AND r.targetAnalysisId = :targetId AND r.relationshipType = :type AND r.organizationId = :orgId")
    boolean existsBySourceAndTargetAndTypeAndOrganizationId(
            @Param("sourceId") Long sourceAnalysisId, @Param("targetId") Long targetAnalysisId,
            @Param("type") String relationshipType, @Param("orgId") Long organizationId);

    // SECURITY: Delete with org filter
    @Query("DELETE FROM DocumentRelationship r WHERE (r.sourceAnalysisId = :sourceId OR r.targetAnalysisId = :targetId) AND r.organizationId = :orgId")
    void deleteBySourceOrTargetAndOrganizationId(
            @Param("sourceId") Long sourceId, @Param("targetId") Long targetId, @Param("orgId") Long organizationId);

    // SECURITY: Find by ID with org filter
    Optional<DocumentRelationship> findByIdAndOrganizationId(Long id, Long organizationId);
}
