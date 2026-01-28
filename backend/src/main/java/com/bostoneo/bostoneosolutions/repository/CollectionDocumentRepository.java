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
 * Repository for Collection Documents (junction table) with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface CollectionDocumentRepository extends JpaRepository<CollectionDocument, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<CollectionDocument> findByIdAndOrganizationId(Long id, Long organizationId);

    List<CollectionDocument> findByOrganizationIdAndCollectionIdOrderByAddedAtDesc(Long organizationId, Long collectionId);

    boolean existsByOrganizationIdAndCollectionIdAndAnalysisId(Long organizationId, Long collectionId, Long analysisId);

    Optional<CollectionDocument> findByOrganizationIdAndCollectionIdAndAnalysisId(Long organizationId, Long collectionId, Long analysisId);

    long countByOrganizationIdAndCollectionId(Long organizationId, Long collectionId);

    @Query("SELECT cd.collection.id FROM CollectionDocument cd WHERE cd.organizationId = :orgId AND cd.analysisId = :analysisId")
    List<Long> findCollectionIdsByAnalysisIdAndOrganizationId(@Param("orgId") Long organizationId, @Param("analysisId") Long analysisId);

    @Query("SELECT cd.analysisId FROM CollectionDocument cd WHERE cd.organizationId = :orgId AND cd.collection.id = :collectionId")
    List<Long> findAnalysisIdsByCollectionIdAndOrganizationId(@Param("orgId") Long organizationId, @Param("collectionId") Long collectionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionDocument cd WHERE cd.organizationId = :orgId AND cd.collection.id = :collectionId AND cd.analysisId = :analysisId")
    void deleteByOrganizationIdAndCollectionIdAndAnalysisId(@Param("orgId") Long organizationId, @Param("collectionId") Long collectionId, @Param("analysisId") Long analysisId);

    @Modifying
    @Transactional
    @Query("DELETE FROM CollectionDocument cd WHERE cd.organizationId = :orgId AND cd.collection.id = :collectionId")
    void deleteByOrganizationIdAndCollectionId(@Param("orgId") Long organizationId, @Param("collectionId") Long collectionId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: These methods bypass multi-tenant isolation.
    // Use tenant-filtered versions that verify collection ownership.

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    List<CollectionDocument> findByCollectionIdOrderByAddedAtDesc(Long collectionId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    boolean existsByCollectionIdAndAnalysisId(Long collectionId, Long analysisId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    Optional<CollectionDocument> findByCollectionIdAndAnalysisId(Long collectionId, Long analysisId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    long countByCollectionId(Long collectionId);

    /** @deprecated Verify analysis ownership through AIDocumentAnalysis.organizationId before calling */
    @Deprecated
    @Query("SELECT cd.collection.id FROM CollectionDocument cd WHERE cd.analysisId = :analysisId")
    List<Long> findCollectionIdsByAnalysisId(@Param("analysisId") Long analysisId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Query("SELECT cd.analysisId FROM CollectionDocument cd WHERE cd.collection.id = :collectionId")
    List<Long> findAnalysisIdsByCollectionId(@Param("collectionId") Long collectionId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Modifying
    @Transactional
    void deleteByCollectionIdAndAnalysisId(Long collectionId, Long analysisId);

    /** @deprecated Verify collection ownership through DocumentCollection.organizationId before calling */
    @Deprecated
    @Modifying
    @Transactional
    void deleteByCollectionId(Long collectionId);
}
