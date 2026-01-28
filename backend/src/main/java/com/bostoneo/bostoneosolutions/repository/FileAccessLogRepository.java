package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileAccessLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FileAccessLogRepository extends JpaRepository<FileAccessLog, Long> {
    
    // Basic queries
    List<FileAccessLog> findByFileIdOrderByAccessedAtDesc(Long fileId);
    
    Page<FileAccessLog> findByFileIdOrderByAccessedAtDesc(Long fileId, Pageable pageable);
    
    List<FileAccessLog> findByUserIdOrderByAccessedAtDesc(Long userId);
    
    Page<FileAccessLog> findByUserIdOrderByAccessedAtDesc(Long userId, Pageable pageable);
    
    // Action type queries
    List<FileAccessLog> findByFileIdAndActionTypeOrderByAccessedAtDesc(Long fileId, FileAccessLog.ActionType actionType);
    
    List<FileAccessLog> findByUserIdAndActionTypeOrderByAccessedAtDesc(Long userId, FileAccessLog.ActionType actionType);
    
    Page<FileAccessLog> findByActionTypeOrderByAccessedAtDesc(FileAccessLog.ActionType actionType, Pageable pageable);
    
    // Time-based queries
    @Query("SELECT l FROM FileAccessLog l WHERE l.accessedAt >= :since ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findLogsSince(@Param("since") LocalDateTime since);
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.accessedAt BETWEEN :start AND :end ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findLogsBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.fileId = :fileId AND l.accessedAt >= :since ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findFileLogsSince(@Param("fileId") Long fileId, @Param("since") LocalDateTime since);
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.userId = :userId AND l.accessedAt >= :since ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findUserLogsSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    
    // Statistics queries
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.fileId = :fileId")
    Long countAccessesForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.fileId = :fileId AND l.actionType = :actionType")
    Long countFileAccessesByAction(@Param("fileId") Long fileId, @Param("actionType") FileAccessLog.ActionType actionType);
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.userId = :userId")
    Long countAccessesByUser(@Param("userId") Long userId);
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.actionType = :actionType")
    Long countAccessesByAction(@Param("actionType") FileAccessLog.ActionType actionType);
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.accessedAt >= :since")
    Long countAccessesSince(@Param("since") LocalDateTime since);
    
    // Download statistics
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.actionType = 'DOWNLOAD' AND l.downloadSuccess = true")
    Long countSuccessfulDownloads();
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.fileId = :fileId AND l.actionType = 'DOWNLOAD' AND l.downloadSuccess = true")
    Long countSuccessfulDownloadsForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT SUM(l.bytesTransferred) FROM FileAccessLog l WHERE l.actionType = 'DOWNLOAD' AND l.downloadSuccess = true")
    Long getTotalBytesTransferred();
    
    @Query("SELECT SUM(l.bytesTransferred) FROM FileAccessLog l WHERE l.fileId = :fileId AND l.actionType = 'DOWNLOAD' AND l.downloadSuccess = true")
    Long getBytesTransferredForFile(@Param("fileId") Long fileId);
    
    // Popular files
    @Query("SELECT l.fileId, COUNT(l) as accessCount FROM FileAccessLog l " +
           "WHERE l.accessedAt >= :since GROUP BY l.fileId ORDER BY accessCount DESC")
    List<Object[]> findMostAccessedFiles(@Param("since") LocalDateTime since);
    
    @Query("SELECT l.fileId, COUNT(l) as downloadCount FROM FileAccessLog l " +
           "WHERE l.actionType = 'DOWNLOAD' AND l.downloadSuccess = true AND l.accessedAt >= :since " +
           "GROUP BY l.fileId ORDER BY downloadCount DESC")
    List<Object[]> findMostDownloadedFiles(@Param("since") LocalDateTime since);
    
    // User activity
    @Query("SELECT l.userId, COUNT(l) as activityCount FROM FileAccessLog l " +
           "WHERE l.accessedAt >= :since AND l.userId IS NOT NULL " +
           "GROUP BY l.userId ORDER BY activityCount DESC")
    List<Object[]> findMostActiveUsers(@Param("since") LocalDateTime since);
    
    @Query("SELECT l.actionType, COUNT(l) as actionCount FROM FileAccessLog l " +
           "WHERE l.userId = :userId AND l.accessedAt >= :since " +
           "GROUP BY l.actionType ORDER BY actionCount DESC")
    List<Object[]> getUserActivityBreakdown(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    
    // Access method statistics
    @Query("SELECT l.accessMethod, COUNT(l) as methodCount FROM FileAccessLog l " +
           "WHERE l.accessedAt >= :since GROUP BY l.accessMethod ORDER BY methodCount DESC")
    List<Object[]> getAccessMethodStatistics(@Param("since") LocalDateTime since);
    
    List<FileAccessLog> findByAccessMethodOrderByAccessedAtDesc(String accessMethod);
    
    // External access tracking
    @Query("SELECT l FROM FileAccessLog l WHERE l.shareToken IS NOT NULL ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findExternalAccesses();
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.shareToken = :shareToken ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findAccessesByShareToken(@Param("shareToken") String shareToken);
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.shareToken IS NOT NULL AND l.accessedAt >= :since")
    Long countExternalAccessesSince(@Param("since") LocalDateTime since);
    
    // Error tracking
    @Query("SELECT l FROM FileAccessLog l WHERE l.downloadSuccess = false ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findFailedAccesses();
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.errorMessage IS NOT NULL ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findAccessesWithErrors();
    
    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.downloadSuccess = false AND l.accessedAt >= :since")
    Long countFailedAccessesSince(@Param("since") LocalDateTime since);
    
    // Performance monitoring
    @Query("SELECT AVG(l.requestDurationMs) FROM FileAccessLog l WHERE l.requestDurationMs IS NOT NULL AND l.accessedAt >= :since")
    Double getAverageRequestDuration(@Param("since") LocalDateTime since);
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.requestDurationMs > :threshold ORDER BY l.requestDurationMs DESC")
    List<FileAccessLog> findSlowRequests(@Param("threshold") Long threshold);
    
    // IP and security monitoring
    List<FileAccessLog> findByIpAddressOrderByAccessedAtDesc(String ipAddress);
    
    @Query("SELECT l.ipAddress, COUNT(l) as accessCount FROM FileAccessLog l " +
           "WHERE l.accessedAt >= :since GROUP BY l.ipAddress ORDER BY accessCount DESC")
    List<Object[]> getTopIpAddresses(@Param("since") LocalDateTime since);
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.ipAddress = :ipAddress AND l.accessedAt >= :since")
    List<FileAccessLog> findAccessesByIpSince(@Param("ipAddress") String ipAddress, @Param("since") LocalDateTime since);
    
    // File version tracking
    @Query("SELECT l FROM FileAccessLog l WHERE l.fileId = :fileId AND l.fileVersion = :version ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findAccessesToFileVersion(@Param("fileId") Long fileId, @Param("version") Integer version);
    
    @Query("SELECT l.fileVersion, COUNT(l) as accessCount FROM FileAccessLog l " +
           "WHERE l.fileId = :fileId AND l.fileVersion IS NOT NULL " +
           "GROUP BY l.fileVersion ORDER BY l.fileVersion DESC")
    List<Object[]> getVersionAccessStatistics(@Param("fileId") Long fileId);
    
    // Cleanup queries
    @Query("SELECT l FROM FileAccessLog l WHERE l.accessedAt < :cutoffDate")
    List<FileAccessLog> findLogsOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);
    
    @Query("SELECT l FROM FileAccessLog l WHERE l.fileId IS NOT NULL " +
           "AND NOT EXISTS (SELECT 1 FROM FileItem f WHERE f.id = l.fileId AND f.deleted = false)")
    List<FileAccessLog> findOrphanedLogs();
    
    // Bulk statistics
    /**
     * @deprecated Use getDailyAccessStatisticsByOrganization for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT CAST(l.accessed_at AS DATE) as access_date, COUNT(*) as daily_count FROM file_access_logs l " +
           "WHERE l.accessed_at >= :since GROUP BY CAST(l.accessed_at AS DATE) ORDER BY access_date DESC",
           nativeQuery = true)
    List<Object[]> getDailyAccessStatistics(@Param("since") LocalDateTime since);

    /**
     * @deprecated Use getHourlyAccessStatisticsByOrganization for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT EXTRACT(HOUR FROM l.accessed_at) as access_hour, COUNT(*) as hourly_count FROM file_access_logs l " +
           "WHERE l.accessed_at >= :since GROUP BY EXTRACT(HOUR FROM l.accessed_at) ORDER BY access_hour ASC",
           nativeQuery = true)
    List<Object[]> getHourlyAccessStatistics(@Param("since") LocalDateTime since);

    /**
     * @deprecated Use deleteByFileIdAndOrganizationId for tenant isolation
     */
    @Deprecated
    @Modifying
    void deleteByFileId(Long fileId);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query("SELECT l FROM FileAccessLog l WHERE l.fileId = :fileId AND l.organizationId = :organizationId ORDER BY l.accessedAt DESC")
    List<FileAccessLog> findByFileIdAndOrganizationIdOrderByAccessedAtDesc(@Param("fileId") Long fileId, @Param("organizationId") Long organizationId);

    @Query("SELECT l FROM FileAccessLog l WHERE l.fileId = :fileId AND l.organizationId = :organizationId ORDER BY l.accessedAt DESC")
    Page<FileAccessLog> findByFileIdAndOrganizationIdOrderByAccessedAtDesc(@Param("fileId") Long fileId, @Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT COUNT(l) FROM FileAccessLog l WHERE l.organizationId = :organizationId AND l.accessedAt >= :since")
    Long countAccessesSinceByOrganization(@Param("organizationId") Long organizationId, @Param("since") LocalDateTime since);

    @Query("SELECT l.fileId, COUNT(l) as accessCount FROM FileAccessLog l " +
           "WHERE l.organizationId = :organizationId AND l.accessedAt >= :since GROUP BY l.fileId ORDER BY accessCount DESC")
    List<Object[]> findMostAccessedFilesByOrganization(@Param("organizationId") Long organizationId, @Param("since") LocalDateTime since);

    @Modifying
    @Query("DELETE FROM FileAccessLog l WHERE l.fileId = :fileId AND l.organizationId = :organizationId")
    void deleteByFileIdAndOrganizationId(@Param("fileId") Long fileId, @Param("organizationId") Long organizationId);

    // Tenant-filtered analytics methods
    @Query(value = "SELECT CAST(l.accessed_at AS DATE) as access_date, COUNT(*) as daily_count FROM file_access_logs l " +
           "WHERE l.organization_id = :orgId AND l.accessed_at >= :since GROUP BY CAST(l.accessed_at AS DATE) ORDER BY access_date DESC",
           nativeQuery = true)
    List<Object[]> getDailyAccessStatisticsByOrganization(@Param("orgId") Long organizationId, @Param("since") LocalDateTime since);

    @Query(value = "SELECT EXTRACT(HOUR FROM l.accessed_at) as access_hour, COUNT(*) as hourly_count FROM file_access_logs l " +
           "WHERE l.organization_id = :orgId AND l.accessed_at >= :since GROUP BY EXTRACT(HOUR FROM l.accessed_at) ORDER BY access_hour ASC",
           nativeQuery = true)
    List<Object[]> getHourlyAccessStatisticsByOrganization(@Param("orgId") Long organizationId, @Param("since") LocalDateTime since);

    /**
     * SECURITY: Find all access logs for an organization (tenant isolation)
     */
    @Query("SELECT l FROM FileAccessLog l WHERE l.organizationId = :organizationId")
    List<FileAccessLog> findByOrganizationId(@Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find access log by ID and organization (tenant isolation)
     */
    @Query("SELECT l FROM FileAccessLog l WHERE l.id = :id AND l.organizationId = :organizationId")
    java.util.Optional<FileAccessLog> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);
}