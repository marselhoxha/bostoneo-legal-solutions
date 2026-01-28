package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ResearchAnnotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ResearchAnnotationRepository extends JpaRepository<ResearchAnnotation, Long> {

    // Find by user ID
    List<ResearchAnnotation> findByUserIdOrderByCreatedAtDesc(Long userId);

    // Find by session ID
    List<ResearchAnnotation> findBySessionIdOrderByCreatedAtDesc(String sessionId);

    // Find by document ID and type
    List<ResearchAnnotation> findByDocumentIdAndDocumentTypeOrderByCreatedAtDesc(Long documentId, String documentType);

    // Find by user and document
    List<ResearchAnnotation> findByUserIdAndDocumentIdAndDocumentTypeOrderByCreatedAtDesc(
            Long userId, Long documentId, String documentType);

    // Find by annotation type
    List<ResearchAnnotation> findByUserIdAndAnnotationTypeOrderByCreatedAtDesc(Long userId, String annotationType);

    // Find public annotations (is_private = false)
    List<ResearchAnnotation> findByIsPrivateFalseOrderByCreatedAtDesc();

    // Find annotations by text search
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.userId = :userId " +
           "AND (LOWER(a.annotationText) LIKE LOWER(CONCAT('%', :searchText, '%')) " +
           "OR LOWER(a.highlightedText) LIKE LOWER(CONCAT('%', :searchText, '%'))) " +
           "ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findByUserIdAndTextContaining(@Param("userId") Long userId,
                                                            @Param("searchText") String searchText);

    // Find annotations within date range
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.userId = :userId " +
           "AND a.createdAt BETWEEN :startDate AND :endDate " +
           "ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findByUserIdAndDateRange(@Param("userId") Long userId,
                                                       @Param("startDate") LocalDateTime startDate,
                                                       @Param("endDate") LocalDateTime endDate);

    // Count annotations by user
    long countByUserId(Long userId);

    // Count annotations by session
    long countBySessionId(String sessionId);

    // Count annotations by document
    long countByDocumentIdAndDocumentType(Long documentId, String documentType);

    // Find recent annotations for a user (last 30 days)
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.userId = :userId " +
           "AND a.createdAt >= :since " +
           "ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findRecentAnnotations(@Param("userId") Long userId,
                                                    @Param("since") LocalDateTime since);

    // Find most annotated documents
    @Query("SELECT a.documentId, a.documentType, a.documentTitle, COUNT(a) as annotationCount " +
           "FROM ResearchAnnotation a WHERE a.userId = :userId " +
           "GROUP BY a.documentId, a.documentType, a.documentTitle " +
           "ORDER BY annotationCount DESC")
    List<Object[]> findMostAnnotatedDocuments(@Param("userId") Long userId);

    // Delete old annotations (for cleanup)
    @Query("DELETE FROM ResearchAnnotation a WHERE a.createdAt < :cutoffDate AND a.isPrivate = true")
    void deleteOldPrivateAnnotations(@Param("cutoffDate") LocalDateTime cutoffDate);

    // ==================== TENANT-FILTERED METHODS (SECURE) ====================

    // SECURITY: Find by user with org filter
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.userId = :userId AND a.organizationId = :orgId ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
            @Param("userId") Long userId, @Param("orgId") Long organizationId);

    // SECURITY: Find by session with org filter
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.sessionId = :sessionId AND a.organizationId = :orgId ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findBySessionIdAndOrganizationIdOrderByCreatedAtDesc(
            @Param("sessionId") String sessionId, @Param("orgId") Long organizationId);

    // SECURITY: Find by document with org filter
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.documentId = :documentId AND a.documentType = :documentType AND a.organizationId = :orgId ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findByDocumentAndOrganizationIdOrderByCreatedAtDesc(
            @Param("documentId") Long documentId, @Param("documentType") String documentType, @Param("orgId") Long organizationId);

    // SECURITY: Find public annotations with org filter (CRITICAL - fixes cross-org exposure)
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.isPrivate = false AND a.organizationId = :orgId ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findByIsPrivateFalseAndOrganizationIdOrderByCreatedAtDesc(@Param("orgId") Long organizationId);

    // SECURITY: Text search with org filter
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.userId = :userId AND a.organizationId = :orgId " +
           "AND (LOWER(a.annotationText) LIKE LOWER(CONCAT('%', :searchText, '%')) " +
           "OR LOWER(a.highlightedText) LIKE LOWER(CONCAT('%', :searchText, '%'))) " +
           "ORDER BY a.createdAt DESC")
    List<ResearchAnnotation> findByUserIdAndOrganizationIdAndTextContaining(
            @Param("userId") Long userId, @Param("orgId") Long organizationId, @Param("searchText") String searchText);

    // SECURITY: Count with org filter
    @Query("SELECT COUNT(a) FROM ResearchAnnotation a WHERE a.userId = :userId AND a.organizationId = :orgId")
    long countByUserIdAndOrganizationId(@Param("userId") Long userId, @Param("orgId") Long organizationId);

    // SECURITY: Delete old annotations with org filter
    @Query("DELETE FROM ResearchAnnotation a WHERE a.createdAt < :cutoffDate AND a.isPrivate = true AND a.organizationId = :orgId")
    void deleteOldPrivateAnnotationsByOrganization(@Param("cutoffDate") LocalDateTime cutoffDate, @Param("orgId") Long organizationId);

    // SECURITY: Find by ID with org filter
    @Query("SELECT a FROM ResearchAnnotation a WHERE a.id = :id AND a.organizationId = :orgId")
    Optional<ResearchAnnotation> findByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long organizationId);
}