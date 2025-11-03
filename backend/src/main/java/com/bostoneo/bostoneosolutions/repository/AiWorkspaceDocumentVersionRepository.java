package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiWorkspaceDocumentVersionRepository extends JpaRepository<AiWorkspaceDocumentVersion, Long> {

    /**
     * Find all versions for a document, ordered by version number
     */
    List<AiWorkspaceDocumentVersion> findByDocumentIdOrderByVersionNumberDesc(Long documentId);

    /**
     * Find specific version by document ID and version number
     */
    Optional<AiWorkspaceDocumentVersion> findByDocumentIdAndVersionNumber(Long documentId, Integer versionNumber);

    /**
     * Find latest version for a document
     */
    @Query("SELECT v FROM AiWorkspaceDocumentVersion v WHERE v.document.id = :documentId " +
           "ORDER BY v.versionNumber DESC LIMIT 1")
    Optional<AiWorkspaceDocumentVersion> findLatestVersion(@Param("documentId") Long documentId);

    /**
     * Get version count for a document
     */
    long countByDocumentId(Long documentId);

    /**
     * Find versions by transformation type
     */
    List<AiWorkspaceDocumentVersion> findByDocumentIdAndTransformationType(Long documentId, String transformationType);

    /**
     * Get AI-generated versions only (not manual edits)
     */
    List<AiWorkspaceDocumentVersion> findByDocumentIdAndCreatedByUserFalseOrderByVersionNumberDesc(Long documentId);

    /**
     * Get manual edit versions only
     */
    List<AiWorkspaceDocumentVersion> findByDocumentIdAndCreatedByUserTrueOrderByVersionNumberDesc(Long documentId);
}
