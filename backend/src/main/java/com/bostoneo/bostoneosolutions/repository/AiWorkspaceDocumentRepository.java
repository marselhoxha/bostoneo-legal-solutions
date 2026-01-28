package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiWorkspaceDocumentRepository extends JpaRepository<AiWorkspaceDocument, Long> {

    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /**
     * @deprecated Use findByIdAndUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    Optional<AiWorkspaceDocument> findByIdAndUserId(Long id, Long userId);

    /**
     * Find all documents for a user
     */
    List<AiWorkspaceDocument> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);

    /**
     * Find all documents for a case
     */
    List<AiWorkspaceDocument> findByCaseIdAndUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long caseId, Long userId);

    /**
     * Find documents by session ID
     */
    Optional<AiWorkspaceDocument> findBySessionIdAndUserId(Long sessionId, Long userId);

    /**
     * Find documents by type
     */
    List<AiWorkspaceDocument> findByUserIdAndDocumentTypeAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, String documentType
    );

    /**
     * Find documents by status
     */
    List<AiWorkspaceDocument> findByUserIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, String status
    );

    /**
     * Search documents by title
     */
    @Query("SELECT d FROM AiWorkspaceDocument d WHERE d.userId = :userId " +
           "AND d.deletedAt IS NULL " +
           "AND LOWER(d.title) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY d.createdAt DESC")
    List<AiWorkspaceDocument> searchByTitle(@Param("userId") Long userId, @Param("searchTerm") String searchTerm);

    /**
     * Get paginated documents for user
     */
    Page<AiWorkspaceDocument> findByUserIdAndDeletedAtIsNull(Long userId, Pageable pageable);

    /**
     * Count documents by user
     */
    long countByUserIdAndDeletedAtIsNull(Long userId);

    /**
     * Count documents by case
     */
    long countByCaseIdAndDeletedAtIsNull(Long caseId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * SECURITY: Find document by ID with organization verification
     */
    Optional<AiWorkspaceDocument> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find document by ID and user ID with organization verification
     */
    Optional<AiWorkspaceDocument> findByIdAndUserIdAndOrganizationId(Long id, Long userId, Long organizationId);

    /**
     * SECURITY: Find all documents for a user within organization
     */
    List<AiWorkspaceDocument> findByUserIdAndOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, Long organizationId);

    /**
     * SECURITY: Find all documents for a case within organization
     */
    List<AiWorkspaceDocument> findByCaseIdAndOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long caseId, Long organizationId);

    /**
     * SECURITY: Find documents by session ID within organization
     */
    Optional<AiWorkspaceDocument> findBySessionIdAndUserIdAndOrganizationId(
        Long sessionId, Long userId, Long organizationId);

    /**
     * SECURITY: Find documents by type within organization
     */
    List<AiWorkspaceDocument> findByUserIdAndOrganizationIdAndDocumentTypeAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, Long organizationId, String documentType);

    /**
     * SECURITY: Find documents by status within organization
     */
    List<AiWorkspaceDocument> findByUserIdAndOrganizationIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, Long organizationId, String status);

    /**
     * SECURITY: Search documents by title within organization
     */
    @Query("SELECT d FROM AiWorkspaceDocument d WHERE d.userId = :userId " +
           "AND d.organizationId = :organizationId " +
           "AND d.deletedAt IS NULL " +
           "AND LOWER(d.title) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY d.createdAt DESC")
    List<AiWorkspaceDocument> searchByTitleAndOrganizationId(
        @Param("userId") Long userId,
        @Param("organizationId") Long organizationId,
        @Param("searchTerm") String searchTerm);

    /**
     * SECURITY: Get paginated documents for user within organization
     */
    Page<AiWorkspaceDocument> findByUserIdAndOrganizationIdAndDeletedAtIsNull(
        Long userId, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Count documents by user within organization
     */
    long countByUserIdAndOrganizationIdAndDeletedAtIsNull(Long userId, Long organizationId);

    /**
     * SECURITY: Count documents by case within organization
     */
    long countByCaseIdAndOrganizationIdAndDeletedAtIsNull(Long caseId, Long organizationId);
}
