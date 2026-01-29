package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for FileShare entity with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface FileShareRepository extends JpaRepository<FileShare, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<FileShare> findByIdAndOrganizationId(Long id, Long organizationId);

    List<FileShare> findByOrganizationIdAndFileIdAndIsActiveTrueOrderByCreatedAtDesc(Long organizationId, Long fileId);

    List<FileShare> findByOrganizationIdAndCreatedByAndIsActiveTrueOrderByCreatedAtDesc(Long organizationId, Long createdBy);

    List<FileShare> findByOrganizationIdAndSharedWithUserIdAndIsActiveTrueOrderByCreatedAtDesc(Long organizationId, Long sharedWithUserId);

    Optional<FileShare> findByOrganizationIdAndShareTokenAndIsActiveTrue(Long organizationId, String shareToken);

    List<FileShare> findByOrganizationIdAndShareTypeAndIsActiveTrueOrderByCreatedAtDesc(Long organizationId, FileShare.ShareType shareType);

    @Query("SELECT s FROM FileShare s WHERE s.organizationId = :orgId AND s.shareToken = :token AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP) " +
           "AND (s.maxDownloads IS NULL OR s.downloadCount < s.maxDownloads)")
    Optional<FileShare> findValidShareByTokenAndOrganizationId(@Param("orgId") Long organizationId, @Param("token") String token);

    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.organizationId = :orgId AND s.isActive = true")
    Long countActiveSharesByOrganizationId(@Param("orgId") Long organizationId);

    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.organizationId = :orgId AND s.fileId = :fileId AND s.isActive = true")
    Long countActiveSharesForFileAndOrganizationId(@Param("orgId") Long organizationId, @Param("fileId") Long fileId);

    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.organizationId = :orgId AND s.fileId = :fileId")
    int deactivateAllSharesForFileAndOrganizationId(@Param("orgId") Long organizationId, @Param("fileId") Long fileId);

    @Modifying
    @Query("UPDATE FileShare s SET s.downloadCount = s.downloadCount + 1, s.lastAccessedAt = CURRENT_TIMESTAMP " +
           "WHERE s.id = :shareId AND s.organizationId = :orgId")
    int incrementDownloadCountByOrganizationId(@Param("shareId") Long shareId, @Param("orgId") Long organizationId);

    @Query("SELECT DISTINCT s.fileId FROM FileShare s WHERE s.organizationId = :orgId AND s.sharedWithUserId = :userId AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getAccessibleFileIdsForUserAndOrganizationId(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    void deleteByFileIdAndOrganizationId(Long fileId, Long organizationId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: All methods bypass multi-tenant isolation.
    // Verify file ownership through FileItem.organizationId before calling.

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    List<FileShare> findByFileIdAndIsActiveTrueOrderByCreatedAtDesc(Long fileId);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    List<FileShare> findByCreatedByAndIsActiveTrueOrderByCreatedAtDesc(Long createdBy);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    List<FileShare> findBySharedWithUserIdAndIsActiveTrueOrderByCreatedAtDesc(Long sharedWithUserId);

    /** @deprecated Token-based access - verify file org after retrieving */
    @Deprecated
    Optional<FileShare> findByShareTokenAndIsActiveTrue(String shareToken);

    /** @deprecated May return data from all organizations */
    @Deprecated
    List<FileShare> findByShareTypeAndIsActiveTrueOrderByCreatedAtDesc(FileShare.ShareType shareType);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    List<FileShare> findByFileIdAndShareTypeAndIsActiveTrueOrderByCreatedAtDesc(Long fileId, FileShare.ShareType shareType);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    List<FileShare> findByFileIdAndAccessLevelAndIsActiveTrueOrderByCreatedAtDesc(Long fileId, FileShare.AccessLevel accessLevel);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    List<FileShare> findBySharedWithUserIdAndAccessLevelAndIsActiveTrueOrderByCreatedAtDesc(Long sharedWithUserId, FileShare.AccessLevel accessLevel);

    /** @deprecated May return data from all organizations */
    @Deprecated
    List<FileShare> findBySharedWithEmailAndIsActiveTrueOrderByCreatedAtDesc(String sharedWithEmail);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    Optional<FileShare> findByFileIdAndSharedWithEmailAndIsActiveTrue(Long fileId, String sharedWithEmail);

    /** @deprecated Token-based access - verify file org after retrieving */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.shareToken = :token AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP) " +
           "AND (s.maxDownloads IS NULL OR s.downloadCount < s.maxDownloads)")
    Optional<FileShare> findValidShareByToken(@Param("token") String token);

    /** @deprecated May check tokens from all organizations */
    @Deprecated
    boolean existsByShareToken(String shareToken);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.expiresAt < CURRENT_TIMESTAMP")
    List<FileShare> findExpiredShares();

    /** @deprecated Affects data from all organizations */
    @Deprecated
    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.isActive = true AND s.expiresAt < CURRENT_TIMESTAMP")
    int deactivateExpiredShares();

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.expiresAt IS NOT NULL " +
           "AND s.expiresAt BETWEEN CURRENT_TIMESTAMP AND :warningTime")
    List<FileShare> findSharesExpiringBefore(@Param("warningTime") LocalDateTime warningTime);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.maxDownloads IS NOT NULL " +
           "AND s.downloadCount >= s.maxDownloads")
    List<FileShare> findSharesAtDownloadLimit();

    /** @deprecated Verify share ownership before calling */
    @Deprecated
    @Modifying
    @Query("UPDATE FileShare s SET s.downloadCount = s.downloadCount + 1, s.lastAccessedAt = CURRENT_TIMESTAMP " +
           "WHERE s.id = :shareId")
    int incrementDownloadCount(@Param("shareId") Long shareId);

    /** @deprecated Returns count from all organizations */
    @Deprecated
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.isActive = true")
    Long countActiveShares();

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.fileId = :fileId AND s.isActive = true")
    Long countActiveSharesForFile(@Param("fileId") Long fileId);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.createdBy = :userId AND s.isActive = true")
    Long countActiveSharesByUser(@Param("userId") Long userId);

    /** @deprecated Returns statistics from all organizations */
    @Deprecated
    @Query("SELECT s.shareType, COUNT(s) FROM FileShare s WHERE s.isActive = true GROUP BY s.shareType")
    List<Object[]> getShareTypeStatistics();

    /** @deprecated Returns statistics from all organizations */
    @Deprecated
    @Query("SELECT s.accessLevel, COUNT(s) FROM FileShare s WHERE s.isActive = true GROUP BY s.accessLevel")
    List<Object[]> getAccessLevelStatistics();

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.lastAccessedAt >= :since " +
           "ORDER BY COALESCE(s.lastAccessedAt, s.createdAt) DESC")
    List<FileShare> findRecentlyAccessedShares(@Param("since") LocalDateTime since);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.createdAt >= :since ORDER BY s.createdAt DESC")
    List<FileShare> findRecentShares(@Param("since") LocalDateTime since);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Query("SELECT SUM(s.downloadCount) FROM FileShare s WHERE s.fileId = :fileId AND s.isActive = true")
    Long getTotalDownloadsForFile(@Param("fileId") Long fileId);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    @Query("SELECT DISTINCT s.fileId FROM FileShare s WHERE s.sharedWithUserId = :userId AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getAccessibleFileIdsForUser(@Param("userId") Long userId);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.sharedWithUserId = :userId AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP) ORDER BY s.createdAt DESC")
    List<FileShare> getActiveSharesForUser(@Param("userId") Long userId);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.shareType = 'PUBLIC_LINK' AND s.isActive = true " +
           "ORDER BY s.createdAt DESC")
    List<FileShare> findActivePublicLinks();

    /** @deprecated Returns count from all organizations */
    @Deprecated
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.shareType = 'PUBLIC_LINK' AND s.isActive = true")
    Long countActivePublicLinks();

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.passwordHash IS NOT NULL AND s.isActive = true")
    List<FileShare> findPasswordProtectedShares();

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = false AND s.createdAt < :cutoffDate")
    List<FileShare> findInactiveSharesOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true " +
           "AND NOT EXISTS (SELECT 1 FROM FileItem f WHERE f.id = s.fileId AND f.deleted = false)")
    List<FileShare> findOrphanedShares();

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.fileId = :fileId")
    int deactivateAllSharesForFile(@Param("fileId") Long fileId);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.fileId IN :fileIds")
    int deactivateSharesForFiles(@Param("fileIds") List<Long> fileIds);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.fileId IN :fileIds AND s.isActive = true")
    List<FileShare> findActiveSharesForFiles(@Param("fileIds") List<Long> fileIds);

    /** @deprecated May return data from all organizations */
    @Deprecated
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true " +
           "AND (:fileId IS NULL OR s.fileId = :fileId) " +
           "AND (:shareType IS NULL OR s.shareType = :shareType) " +
           "AND (:accessLevel IS NULL OR s.accessLevel = :accessLevel) " +
           "AND (:createdBy IS NULL OR s.createdBy = :createdBy)")
    List<FileShare> findWithFilters(@Param("fileId") Long fileId,
                                   @Param("shareType") FileShare.ShareType shareType,
                                   @Param("accessLevel") FileShare.AccessLevel accessLevel,
                                   @Param("createdBy") Long createdBy);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Modifying
    void deleteByFileId(Long fileId);
}
