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

@Repository
public interface FileShareRepository extends JpaRepository<FileShare, Long> {
    
    // Basic queries
    List<FileShare> findByFileIdAndIsActiveTrueOrderByCreatedAtDesc(Long fileId);
    
    List<FileShare> findByCreatedByAndIsActiveTrueOrderByCreatedAtDesc(Long createdBy);
    
    List<FileShare> findBySharedWithUserIdAndIsActiveTrueOrderByCreatedAtDesc(Long sharedWithUserId);
    
    Optional<FileShare> findByShareTokenAndIsActiveTrue(String shareToken);
    
    // Share type queries
    List<FileShare> findByShareTypeAndIsActiveTrueOrderByCreatedAtDesc(FileShare.ShareType shareType);
    
    List<FileShare> findByFileIdAndShareTypeAndIsActiveTrueOrderByCreatedAtDesc(Long fileId, FileShare.ShareType shareType);
    
    // Access level queries
    List<FileShare> findByFileIdAndAccessLevelAndIsActiveTrueOrderByCreatedAtDesc(Long fileId, FileShare.AccessLevel accessLevel);
    
    List<FileShare> findBySharedWithUserIdAndAccessLevelAndIsActiveTrueOrderByCreatedAtDesc(Long sharedWithUserId, FileShare.AccessLevel accessLevel);
    
    // Email-based sharing
    List<FileShare> findBySharedWithEmailAndIsActiveTrueOrderByCreatedAtDesc(String sharedWithEmail);
    
    Optional<FileShare> findByFileIdAndSharedWithEmailAndIsActiveTrue(Long fileId, String sharedWithEmail);
    
    // Token validation
    @Query("SELECT s FROM FileShare s WHERE s.shareToken = :token AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP) " +
           "AND (s.maxDownloads IS NULL OR s.downloadCount < s.maxDownloads)")
    Optional<FileShare> findValidShareByToken(@Param("token") String token);
    
    boolean existsByShareToken(String shareToken);
    
    // Expiration management
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.expiresAt < CURRENT_TIMESTAMP")
    List<FileShare> findExpiredShares();
    
    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.isActive = true AND s.expiresAt < CURRENT_TIMESTAMP")
    int deactivateExpiredShares();
    
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.expiresAt IS NOT NULL " +
           "AND s.expiresAt BETWEEN CURRENT_TIMESTAMP AND :warningTime")
    List<FileShare> findSharesExpiringBefore(@Param("warningTime") LocalDateTime warningTime);
    
    // Download limit management
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.maxDownloads IS NOT NULL " +
           "AND s.downloadCount >= s.maxDownloads")
    List<FileShare> findSharesAtDownloadLimit();
    
    @Modifying
    @Query("UPDATE FileShare s SET s.downloadCount = s.downloadCount + 1, s.lastAccessedAt = CURRENT_TIMESTAMP " +
           "WHERE s.id = :shareId")
    int incrementDownloadCount(@Param("shareId") Long shareId);
    
    // Statistics
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.isActive = true")
    Long countActiveShares();
    
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.fileId = :fileId AND s.isActive = true")
    Long countActiveSharesForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.createdBy = :userId AND s.isActive = true")
    Long countActiveSharesByUser(@Param("userId") Long userId);
    
    @Query("SELECT s.shareType, COUNT(s) FROM FileShare s WHERE s.isActive = true GROUP BY s.shareType")
    List<Object[]> getShareTypeStatistics();
    
    @Query("SELECT s.accessLevel, COUNT(s) FROM FileShare s WHERE s.isActive = true GROUP BY s.accessLevel")
    List<Object[]> getAccessLevelStatistics();
    
    // Activity tracking
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true AND s.lastAccessedAt >= :since " +
           "ORDER BY s.lastAccessedAt DESC")
    List<FileShare> findRecentlyAccessedShares(@Param("since") LocalDateTime since);
    
    @Query("SELECT s FROM FileShare s WHERE s.createdAt >= :since ORDER BY s.createdAt DESC")
    List<FileShare> findRecentShares(@Param("since") LocalDateTime since);
    
    @Query("SELECT SUM(s.downloadCount) FROM FileShare s WHERE s.fileId = :fileId AND s.isActive = true")
    Long getTotalDownloadsForFile(@Param("fileId") Long fileId);
    
    // User access queries
    @Query("SELECT DISTINCT s.fileId FROM FileShare s WHERE s.sharedWithUserId = :userId AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getAccessibleFileIdsForUser(@Param("userId") Long userId);
    
    @Query("SELECT s FROM FileShare s WHERE s.sharedWithUserId = :userId AND s.isActive = true " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > CURRENT_TIMESTAMP) ORDER BY s.createdAt DESC")
    List<FileShare> getActiveSharesForUser(@Param("userId") Long userId);
    
    // Public link queries
    @Query("SELECT s FROM FileShare s WHERE s.shareType = 'PUBLIC_LINK' AND s.isActive = true " +
           "ORDER BY s.createdAt DESC")
    List<FileShare> findActivePublicLinks();
    
    @Query("SELECT COUNT(s) FROM FileShare s WHERE s.shareType = 'PUBLIC_LINK' AND s.isActive = true")
    Long countActivePublicLinks();
    
    // Security and cleanup
    @Query("SELECT s FROM FileShare s WHERE s.passwordHash IS NOT NULL AND s.isActive = true")
    List<FileShare> findPasswordProtectedShares();
    
    @Query("SELECT s FROM FileShare s WHERE s.isActive = false AND s.createdAt < :cutoffDate")
    List<FileShare> findInactiveSharesOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);
    
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true " +
           "AND NOT EXISTS (SELECT 1 FROM FileItem f WHERE f.id = s.fileId AND f.deleted = false)")
    List<FileShare> findOrphanedShares();
    
    // Bulk operations
    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.fileId = :fileId")
    int deactivateAllSharesForFile(@Param("fileId") Long fileId);
    
    @Modifying
    @Query("UPDATE FileShare s SET s.isActive = false WHERE s.fileId IN :fileIds")
    int deactivateSharesForFiles(@Param("fileIds") List<Long> fileIds);
    
    @Query("SELECT s FROM FileShare s WHERE s.fileId IN :fileIds AND s.isActive = true")
    List<FileShare> findActiveSharesForFiles(@Param("fileIds") List<Long> fileIds);
    
    // Advanced filtering
    @Query("SELECT s FROM FileShare s WHERE s.isActive = true " +
           "AND (:fileId IS NULL OR s.fileId = :fileId) " +
           "AND (:shareType IS NULL OR s.shareType = :shareType) " +
           "AND (:accessLevel IS NULL OR s.accessLevel = :accessLevel) " +
           "AND (:createdBy IS NULL OR s.createdBy = :createdBy)")
    List<FileShare> findWithFilters(@Param("fileId") Long fileId,
                                   @Param("shareType") FileShare.ShareType shareType,
                                   @Param("accessLevel") FileShare.AccessLevel accessLevel,
                                   @Param("createdBy") Long createdBy);
    
    @Modifying
    void deleteByFileId(Long fileId);
}