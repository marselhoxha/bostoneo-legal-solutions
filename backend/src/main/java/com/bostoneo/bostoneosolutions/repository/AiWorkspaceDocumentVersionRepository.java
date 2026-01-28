package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * WARNING: Entity AiWorkspaceDocumentVersion lacks organization_id.
 * Tenant isolation is enforced through parent AiWorkspaceDocument which has organization_id.
 * Verify document ownership before calling these methods.
 */
@Repository
public interface AiWorkspaceDocumentVersionRepository extends JpaRepository<AiWorkspaceDocumentVersion, Long> {

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Verify parent document ownership through AiWorkspaceDocument.organizationId

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    List<AiWorkspaceDocumentVersion> findByDocumentIdOrderByVersionNumberDesc(Long documentId);

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    Optional<AiWorkspaceDocumentVersion> findByDocumentIdAndVersionNumber(Long documentId, Integer versionNumber);

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    @Query("SELECT v FROM AiWorkspaceDocumentVersion v WHERE v.document.id = :documentId " +
           "ORDER BY v.versionNumber DESC LIMIT 1")
    Optional<AiWorkspaceDocumentVersion> findLatestVersion(@Param("documentId") Long documentId);

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    long countByDocumentId(Long documentId);

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    List<AiWorkspaceDocumentVersion> findByDocumentIdAndTransformationType(Long documentId, String transformationType);

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    List<AiWorkspaceDocumentVersion> findByDocumentIdAndCreatedByUserFalseOrderByVersionNumberDesc(Long documentId);

    /** @deprecated Verify document ownership through AiWorkspaceDocument.organizationId before calling */
    @Deprecated
    List<AiWorkspaceDocumentVersion> findByDocumentIdAndCreatedByUserTrueOrderByVersionNumberDesc(Long documentId);
}
