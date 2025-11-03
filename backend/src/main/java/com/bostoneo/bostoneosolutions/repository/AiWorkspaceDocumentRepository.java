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

    /**
     * Find document by ID and user ID (security check)
     */
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
}
