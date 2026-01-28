package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FileItemRepository extends JpaRepository<FileItem, Long> {
    
    // Basic queries
    List<FileItem> findByDeletedFalseOrderByCreatedAtDesc();
    
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false")
    Page<FileItem> findByDeletedFalse(Pageable pageable);
    
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.folderId = :folderId")
    List<FileItem> findByFolderIdAndDeletedFalse(@Param("folderId") Long folderId);
    
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.folderId = :folderId")
    Page<FileItem> findByFolderIdAndDeletedFalse(@Param("folderId") Long folderId, Pageable pageable);
    
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.createdBy = :createdBy")
    List<FileItem> findByCreatedByAndDeletedFalse(@Param("createdBy") Long createdBy);
    
    // Case-related queries
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.caseId = :caseId")
    List<FileItem> findByCaseIdAndDeletedFalse(@Param("caseId") Long caseId);
    
    Page<FileItem> findByCaseIdAndDeletedFalse(Long caseId, Pageable pageable);
    
    Page<FileItem> findByFolderIdAndCaseIdIsNullAndDeletedFalse(Long folderId, Pageable pageable);
    
    // Personal documents - filter by user and no case association
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false " +
           "AND f.createdBy = :userId " +
           "AND f.caseId IS NULL " +
           "AND (:folderId IS NULL OR f.folderId = :folderId)")
    Page<FileItem> findPersonalDocuments(
        @Param("userId") Long userId,
        @Param("folderId") Long folderId,
        Pageable pageable
    );
    
    // Star toggle operation
    @Modifying
    @Query("UPDATE FileItem f SET f.starred = :starred WHERE f.id = :fileId AND f.deleted = false")
    int updateFileStarStatus(@Param("fileId") Long fileId, @Param("starred") Boolean starred);
    
    // Get starred files
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.starred = true ORDER BY f.updatedAt DESC")
    List<FileItem> findStarredFiles();
    
    List<FileItem> findByDepartmentIdAndDeletedFalse(Long departmentId);
    
    List<FileItem> findByPracticeAreaAndDeletedFalse(String practiceArea);
    
    List<FileItem> findByDocumentCategoryAndDeletedFalse(String documentCategory);
    
    List<FileItem> findByDocumentStatusAndDeletedFalse(String documentStatus);
    
    // Search queries
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND " +
           "(LOWER(f.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(f.originalName) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    List<FileItem> searchByNameOrDescription(@Param("searchTerm") String searchTerm);
    
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND " +
           "(LOWER(f.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(f.originalName) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<FileItem> searchByNameOrDescription(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    // Advanced search with filters
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false " +
           "AND (:folderId IS NULL OR f.folderId = :folderId) " +
           "AND (:caseId IS NULL OR f.caseId = :caseId) " +
           "AND (:mimeType IS NULL OR f.mimeType = :mimeType) " +
           "AND (:createdBy IS NULL OR f.createdBy = :createdBy) " +
           "AND (:documentCategory IS NULL OR f.documentCategory = :documentCategory) " +
           "AND (:practiceArea IS NULL OR f.practiceArea = :practiceArea)")
    Page<FileItem> findWithFilters(
        @Param("folderId") Long folderId,
        @Param("caseId") Long caseId,
        @Param("mimeType") String mimeType,
        @Param("createdBy") Long createdBy,
        @Param("documentCategory") String documentCategory,
        @Param("practiceArea") String practiceArea,
        Pageable pageable
    );
    
    // Statistics queries
    @Query("SELECT COUNT(f) FROM FileItem f WHERE f.deleted = false")
    Long countActiveFiles();
    
    @Query("SELECT COUNT(f) FROM FileItem f WHERE f.deleted = false AND f.caseId = :caseId")
    Long countFilesByCase(@Param("caseId") Long caseId);
    
    @Query("SELECT COUNT(f) FROM FileItem f WHERE f.deleted = false AND f.createdBy = :userId")
    Long countFilesByUser(@Param("userId") Long userId);
    
    @Query("SELECT SUM(f.size) FROM FileItem f WHERE f.deleted = false")
    Long getTotalStorageSize();
    
    @Query("SELECT SUM(f.size) FROM FileItem f WHERE f.deleted = false AND f.caseId = :caseId")
    Long getStorageSizeByCase(@Param("caseId") Long caseId);
    
    @Query("SELECT SUM(f.size) FROM FileItem f WHERE f.deleted = false AND f.createdBy = :userId")
    Long getStorageSizeByUser(@Param("userId") Long userId);
    
    // Recent files
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.createdBy = :userId " +
           "ORDER BY f.createdAt DESC")
    List<FileItem> findRecentFilesByUser(@Param("userId") Long userId, Pageable pageable);
    
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false " +
           "AND f.createdAt >= :since ORDER BY f.createdAt DESC")
    List<FileItem> findRecentFiles(@Param("since") LocalDateTime since);
    
    // Get media files (images, videos, audio)
    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false " +
           "AND (f.mimeType LIKE 'image/%' OR f.mimeType LIKE 'video/%' OR f.mimeType LIKE 'audio/%') " +
           "ORDER BY f.createdAt DESC")
    Page<FileItem> findMediaFiles(Pageable pageable);
    
    // Folder statistics
    Long countByFolderIdAndDeletedFalse(Long folderId);
    
    @Query("SELECT COALESCE(SUM(f.size), 0) FROM FileItem f WHERE f.folderId = :folderId AND f.deleted = false")
    Long sumSizeByFolderIdAndDeletedFalse(@Param("folderId") Long folderId);
    
    // Starred files
    List<FileItem> findByStarredTrueAndDeletedFalseAndCreatedBy(Long createdBy);
    
    // Shared files
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.sharedWithClient = true")
    List<FileItem> findSharedWithClient();

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.sharedWithClient = true " +
           "AND f.caseId = :caseId")
    List<FileItem> findSharedWithClientByCase(@Param("caseId") Long caseId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.sharedWithClient = true " +
           "AND f.caseId IN :caseIds")
    List<FileItem> findByCaseIdInAndSharedWithClientTrue(@Param("caseIds") List<Long> caseIds);
    
    // Files by extension/type
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.extension = :extension")
    List<FileItem> findByExtension(@Param("extension") String extension);
    
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.mimeType LIKE :mimeTypePattern")
    List<FileItem> findByMimeTypePattern(@Param("mimeTypePattern") String mimeTypePattern);
    
    // Deleted files queries
    Page<FileItem> findByDeletedTrueOrderByDeletedAtDesc(Pageable pageable);
    
    // Files needing cleanup (old versions, temp files, etc.)
    @Query("SELECT f FROM FileItem f WHERE f.deleted = true AND f.deletedAt < :cutoffDate")
    List<FileItem> findDeletedFilesOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);
    
    // Duplicate detection
    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.size = :size AND f.name = :name")
    List<FileItem> findPotentialDuplicates(@Param("size") Long size, @Param("name") String name);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query("SELECT f FROM FileItem f WHERE f.id = :id AND f.organizationId = :organizationId")
    java.util.Optional<FileItem> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.organizationId = :organizationId")
    Page<FileItem> findByDeletedFalseAndOrganizationId(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.organizationId = :organizationId ORDER BY f.createdAt DESC")
    List<FileItem> findByDeletedFalseAndOrganizationIdOrderByCreatedAtDesc(@Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.folderId = :folderId AND f.organizationId = :organizationId")
    List<FileItem> findByFolderIdAndDeletedFalseAndOrganizationId(@Param("folderId") Long folderId, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.folderId = :folderId AND f.organizationId = :organizationId")
    Page<FileItem> findByFolderIdAndDeletedFalseAndOrganizationId(@Param("folderId") Long folderId, @Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.caseId = :caseId AND f.organizationId = :organizationId")
    List<FileItem> findByCaseIdAndDeletedFalseAndOrganizationId(@Param("caseId") Long caseId, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.caseId = :caseId AND f.organizationId = :organizationId")
    Page<FileItem> findByCaseIdAndDeletedFalseAndOrganizationId(@Param("caseId") Long caseId, @Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.organizationId = :organizationId " +
           "AND f.createdBy = :userId AND f.caseId IS NULL AND (:folderId IS NULL OR f.folderId = :folderId)")
    Page<FileItem> findPersonalDocumentsByOrganization(
        @Param("userId") Long userId,
        @Param("folderId") Long folderId,
        @Param("organizationId") Long organizationId,
        Pageable pageable
    );

    @Modifying
    @Query("UPDATE FileItem f SET f.starred = :starred WHERE f.id = :fileId AND f.organizationId = :organizationId AND f.deleted = false")
    int updateFileStarStatusByOrganization(@Param("fileId") Long fileId, @Param("starred") Boolean starred, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.starred = true AND f.organizationId = :organizationId ORDER BY f.updatedAt DESC")
    List<FileItem> findStarredFilesByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.organizationId = :organizationId AND " +
           "(LOWER(f.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR LOWER(f.originalName) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    List<FileItem> searchByNameOrDescriptionAndOrganizationId(@Param("searchTerm") String searchTerm, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.organizationId = :organizationId AND " +
           "(LOWER(f.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR LOWER(f.originalName) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<FileItem> searchByNameOrDescriptionAndOrganizationId(@Param("searchTerm") String searchTerm, @Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.organizationId = :organizationId " +
           "AND (:folderId IS NULL OR f.folderId = :folderId) " +
           "AND (:caseId IS NULL OR f.caseId = :caseId) " +
           "AND (:mimeType IS NULL OR f.mimeType = :mimeType) " +
           "AND (:createdBy IS NULL OR f.createdBy = :createdBy) " +
           "AND (:documentCategory IS NULL OR f.documentCategory = :documentCategory) " +
           "AND (:practiceArea IS NULL OR f.practiceArea = :practiceArea)")
    Page<FileItem> findWithFiltersByOrganization(
        @Param("folderId") Long folderId,
        @Param("caseId") Long caseId,
        @Param("mimeType") String mimeType,
        @Param("createdBy") Long createdBy,
        @Param("documentCategory") String documentCategory,
        @Param("practiceArea") String practiceArea,
        @Param("organizationId") Long organizationId,
        Pageable pageable
    );

    @Query("SELECT COUNT(f) FROM FileItem f WHERE f.deleted = false AND f.organizationId = :organizationId")
    Long countActiveFilesByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT SUM(f.size) FROM FileItem f WHERE f.deleted = false AND f.organizationId = :organizationId")
    Long getTotalStorageSizeByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.sharedWithClient = true AND f.organizationId = :organizationId")
    List<FileItem> findSharedWithClientByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.sharedWithClient = true AND f.caseId = :caseId AND f.organizationId = :organizationId")
    List<FileItem> findSharedWithClientByCaseAndOrganization(@Param("caseId") Long caseId, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = false AND f.sharedWithClient = true AND f.caseId IN :caseIds AND f.organizationId = :organizationId")
    List<FileItem> findByCaseIdInAndSharedWithClientTrueAndOrganizationId(@Param("caseIds") List<Long> caseIds, @Param("organizationId") Long organizationId);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = true AND f.organizationId = :organizationId ORDER BY f.deletedAt DESC")
    Page<FileItem> findByDeletedTrueAndOrganizationIdOrderByDeletedAtDesc(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.organizationId = :organizationId " +
           "AND (f.mimeType LIKE 'image/%' OR f.mimeType LIKE 'video/%' OR f.mimeType LIKE 'audio/%') " +
           "ORDER BY f.createdAt DESC")
    Page<FileItem> findMediaFilesByOrganization(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT f FROM FileItem f LEFT JOIN FETCH f.legalCase WHERE f.deleted = false AND f.organizationId = :organizationId " +
           "AND f.createdAt >= :since ORDER BY f.createdAt DESC")
    List<FileItem> findRecentFilesByOrganization(@Param("organizationId") Long organizationId, @Param("since") LocalDateTime since);

    @Query("SELECT f FROM FileItem f WHERE f.deleted = true AND f.deletedAt < :cutoffDate AND f.organizationId = :organizationId")
    List<FileItem> findDeletedFilesOlderThanByOrganization(@Param("cutoffDate") LocalDateTime cutoffDate, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all file items for an organization (tenant isolation)
     */
    @Query("SELECT f FROM FileItem f WHERE f.organizationId = :organizationId")
    List<FileItem> findByOrganizationId(@Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find file by path within organization (tenant isolation)
     * Used for verifying file ownership before serving
     */
    @Query("SELECT f FROM FileItem f WHERE f.filePath = :filePath AND f.organizationId = :organizationId AND f.deleted = false")
    java.util.Optional<FileItem> findByFilePathAndOrganizationId(
        @Param("filePath") String filePath,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find file by filename within organization (tenant isolation)
     * Used for verifying file ownership when serving by filename
     */
    @Query("SELECT f FROM FileItem f WHERE f.name = :filename AND f.organizationId = :organizationId AND f.deleted = false")
    java.util.Optional<FileItem> findByNameAndOrganizationId(
        @Param("filename") String filename,
        @Param("organizationId") Long organizationId);
}