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
}
