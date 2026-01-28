package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Repository for document chunks used in semantic search.
 */
@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, Long> {

    /**
     * Find all chunks for a specific analysis/document
     */
    List<DocumentChunk> findByAnalysisIdOrderByChunkIndexAsc(Long analysisId);

    /**
     * Find all chunks for a collection (for cross-document search)
     */
    List<DocumentChunk> findByCollectionIdOrderByAnalysisIdAscChunkIndexAsc(Long collectionId);

    /**
     * Find all chunks for multiple analyses (for collection search)
     */
    List<DocumentChunk> findByAnalysisIdIn(List<Long> analysisIds);

    /**
     * Find chunks that have embeddings
     */
    List<DocumentChunk> findByAnalysisIdAndEmbeddingIsNotNull(Long analysisId);

    /**
     * Find chunks that have embeddings for collection
     */
    List<DocumentChunk> findByCollectionIdAndEmbeddingIsNotNull(Long collectionId);

    /**
     * Check if document has been chunked
     */
    boolean existsByAnalysisId(Long analysisId);

    /**
     * Count chunks for a document
     */
    long countByAnalysisId(Long analysisId);

    /**
     * Delete all chunks for a document
     */
    @Modifying
    @Transactional
    void deleteByAnalysisId(Long analysisId);

    /**
     * Delete all chunks for a collection
     */
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);

    /**
     * Update collection ID for chunks (when document is added to collection)
     */
    @Modifying
    @Transactional
    @Query("UPDATE DocumentChunk dc SET dc.collectionId = :collectionId WHERE dc.analysisId = :analysisId")
    void updateCollectionIdByAnalysisId(@Param("collectionId") Long collectionId, @Param("analysisId") Long analysisId);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.id = :id AND dc.organizationId = :organizationId")
    java.util.Optional<DocumentChunk> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);

    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.analysisId = :analysisId AND dc.organizationId = :organizationId ORDER BY dc.chunkIndex ASC")
    List<DocumentChunk> findByAnalysisIdAndOrganizationIdOrderByChunkIndexAsc(@Param("analysisId") Long analysisId, @Param("organizationId") Long organizationId);

    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.collectionId = :collectionId AND dc.organizationId = :organizationId ORDER BY dc.analysisId ASC, dc.chunkIndex ASC")
    List<DocumentChunk> findByCollectionIdAndOrganizationIdOrderByAnalysisIdAscChunkIndexAsc(@Param("collectionId") Long collectionId, @Param("organizationId") Long organizationId);

    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.analysisId = :analysisId AND dc.organizationId = :organizationId AND dc.embedding IS NOT NULL")
    List<DocumentChunk> findByAnalysisIdAndOrganizationIdAndEmbeddingIsNotNull(@Param("analysisId") Long analysisId, @Param("organizationId") Long organizationId);

    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.collectionId = :collectionId AND dc.organizationId = :organizationId AND dc.embedding IS NOT NULL")
    List<DocumentChunk> findByCollectionIdAndOrganizationIdAndEmbeddingIsNotNull(@Param("collectionId") Long collectionId, @Param("organizationId") Long organizationId);

    @Modifying
    @Transactional
    @Query("DELETE FROM DocumentChunk dc WHERE dc.analysisId = :analysisId AND dc.organizationId = :organizationId")
    void deleteByAnalysisIdAndOrganizationId(@Param("analysisId") Long analysisId, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find chunks for multiple analyses with organization filter
     */
    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.analysisId IN :analysisIds AND dc.organizationId = :organizationId")
    List<DocumentChunk> findByAnalysisIdInAndOrganizationId(@Param("analysisIds") List<Long> analysisIds, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all document chunks for an organization (tenant isolation)
     */
    @Query("SELECT dc FROM DocumentChunk dc WHERE dc.organizationId = :organizationId")
    List<DocumentChunk> findByOrganizationId(@Param("organizationId") Long organizationId);
}
