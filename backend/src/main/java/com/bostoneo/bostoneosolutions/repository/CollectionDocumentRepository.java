package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CollectionDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Collection Documents (junction table)
 */
@Repository
public interface CollectionDocumentRepository extends JpaRepository<CollectionDocument, Long> {

    /**
     * Find all documents in a collection
     */
    List<CollectionDocument> findByCollectionIdOrderByAddedAtDesc(Long collectionId);

    /**
     * Check if a document is already in a collection
     */
    boolean existsByCollectionIdAndAnalysisId(Long collectionId, Long analysisId);

    /**
     * Find a specific document in a collection
     */
    Optional<CollectionDocument> findByCollectionIdAndAnalysisId(Long collectionId, Long analysisId);

    /**
     * Count documents in a collection
     */
    long countByCollectionId(Long collectionId);

    /**
     * Find all collections containing a specific analysis
     */
    @Query("SELECT cd.collection.id FROM CollectionDocument cd WHERE cd.analysisId = :analysisId")
    List<Long> findCollectionIdsByAnalysisId(@Param("analysisId") Long analysisId);

    /**
     * Delete a document from a collection
     */
    @Modifying
    @Transactional
    void deleteByCollectionIdAndAnalysisId(Long collectionId, Long analysisId);

    /**
     * Delete all documents from a collection
     */
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);
}
