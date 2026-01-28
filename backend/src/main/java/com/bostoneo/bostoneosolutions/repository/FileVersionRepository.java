package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FileVersionRepository extends JpaRepository<FileVersion, Long> {
    
    // Basic queries
    List<FileVersion> findByFileIdAndIsDeletedFalseOrderByVersionNumberDesc(Long fileId);
    
    List<FileVersion> findByFileIdOrderByVersionNumberDesc(Long fileId);
    
    Optional<FileVersion> findByFileIdAndIsCurrentTrueAndIsDeletedFalse(Long fileId);
    
    Optional<FileVersion> findByFileIdAndVersionNumberAndIsDeletedFalse(Long fileId, Integer versionNumber);
    
    List<FileVersion> findByCreatedByAndIsDeletedFalseOrderByUploadedAtDesc(Long createdBy);
    
    // Version management
    @Query("SELECT MAX(v.versionNumber) FROM FileVersion v WHERE v.fileId = :fileId AND v.isDeleted = false")
    Integer findLatestVersionNumber(@Param("fileId") Long fileId);
    
    // Get the highest version number including deleted versions (for avoiding constraint violations)
    @Query("SELECT MAX(v.versionNumber) FROM FileVersion v WHERE v.fileId = :fileId")
    Integer findHighestVersionNumberIncludingDeleted(@Param("fileId") Long fileId);
    
    @Query("SELECT v FROM FileVersion v WHERE v.fileId = :fileId AND v.isDeleted = false " +
           "ORDER BY v.versionNumber DESC")
    List<FileVersion> findAllVersionsForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT v FROM FileVersion v WHERE v.fileId = :fileId AND v.versionNumber > :fromVersion " +
           "AND v.isDeleted = false ORDER BY v.versionNumber ASC")
    List<FileVersion> findVersionsAfter(@Param("fileId") Long fileId, @Param("fromVersion") Integer fromVersion);
    
    // Statistics
    @Query("SELECT COUNT(v) FROM FileVersion v WHERE v.isDeleted = false")
    Long countActiveVersions();
    
    @Query("SELECT COUNT(v) FROM FileVersion v WHERE v.fileId = :fileId AND v.isDeleted = false")
    Long countVersionsForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT SUM(v.fileSize) FROM FileVersion v WHERE v.isDeleted = false")
    Long getTotalVersionsStorageSize();
    
    @Query("SELECT SUM(v.fileSize) FROM FileVersion v WHERE v.fileId = :fileId AND v.isDeleted = false")
    Long getStorageSizeForFileVersions(@Param("fileId") Long fileId);
    
    // Recent versions
    @Query("SELECT v FROM FileVersion v WHERE v.isDeleted = false AND v.uploadedAt >= :since " +
           "ORDER BY v.uploadedAt DESC")
    List<FileVersion> findRecentVersions(@Param("since") LocalDateTime since);
    
    @Query("SELECT v FROM FileVersion v WHERE v.isDeleted = false AND v.createdBy = :userId " +
           "ORDER BY v.uploadedAt DESC")
    List<FileVersion> findRecentVersionsByUser(@Param("userId") Long userId);
    
    // Cleanup queries
    @Query("SELECT v FROM FileVersion v WHERE v.isDeleted = true AND v.uploadedAt < :cutoffDate")
    List<FileVersion> findDeletedVersionsOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);
    
    @Query("SELECT v FROM FileVersion v WHERE v.fileId = :fileId AND v.isDeleted = false " +
           "AND v.isCurrent = false ORDER BY v.versionNumber DESC")
    List<FileVersion> findOldVersionsForFile(@Param("fileId") Long fileId);
    
    // Keep only latest N versions for a file
    @Query("SELECT v FROM FileVersion v WHERE v.fileId = :fileId AND v.isDeleted = false " +
           "AND v.isCurrent = false ORDER BY v.versionNumber DESC OFFSET :keepCount")
    List<FileVersion> findVersionsToCleanup(@Param("fileId") Long fileId, @Param("keepCount") int keepCount);
    
    // Integrity checks
    @Query("SELECT v FROM FileVersion v WHERE v.isDeleted = false " +
           "AND NOT EXISTS (SELECT 1 FROM FileItem f WHERE f.id = v.fileId AND f.deleted = false)")
    List<FileVersion> findOrphanedVersions();
    
    @Query("SELECT v FROM FileVersion v WHERE v.fileId = :fileId AND v.isCurrent = true AND v.isDeleted = false")
    List<FileVersion> findMultipleCurrentVersions(@Param("fileId") Long fileId);
    
    // Search by checksum for duplicate detection
    List<FileVersion> findByChecksumAndIsDeletedFalse(String checksum);
    
    // Encryption related - commented out as encrypted field doesn't exist in DB
    // List<FileVersion> findByEncryptedTrueAndIsDeletedFalse();
    
    // @Query("SELECT COUNT(v) FROM FileVersion v WHERE v.encrypted = true AND v.isDeleted = false")
    // Long countEncryptedVersions();
    
    @Modifying
    void deleteByFileId(Long fileId);

    // ==================== TENANT-FILTERED METHODS ====================

    Optional<FileVersion> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    List<FileVersion> findByOrganizationIdAndFileIdAndIsDeletedFalseOrderByVersionNumberDesc(Long organizationId, Long fileId);

    Optional<FileVersion> findByOrganizationIdAndFileIdAndIsCurrentTrueAndIsDeletedFalse(Long organizationId, Long fileId);

    Optional<FileVersion> findByOrganizationIdAndFileIdAndVersionNumberAndIsDeletedFalse(Long organizationId, Long fileId, Integer versionNumber);

    @Query("SELECT MAX(v.versionNumber) FROM FileVersion v WHERE v.organizationId = :orgId AND v.fileId = :fileId AND v.isDeleted = false")
    Integer findLatestVersionNumberByOrganization(@Param("orgId") Long organizationId, @Param("fileId") Long fileId);

    List<FileVersion> findByOrganizationIdAndFileIdOrderByVersionNumberDesc(Long organizationId, Long fileId);

    @Modifying
    @Query("DELETE FROM FileVersion v WHERE v.fileId = :fileId AND v.organizationId = :orgId")
    void deleteByFileIdAndOrganizationId(@Param("fileId") Long fileId, @Param("orgId") Long organizationId);
}