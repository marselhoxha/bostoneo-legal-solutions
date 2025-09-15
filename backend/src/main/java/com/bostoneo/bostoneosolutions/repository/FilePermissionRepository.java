package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FilePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FilePermissionRepository extends JpaRepository<FilePermission, Long> {
    
    // Basic queries
    List<FilePermission> findByFileIdAndIsRevokedFalse(Long fileId);
    
    List<FilePermission> findByUserIdAndIsRevokedFalse(Long userId);
    
    List<FilePermission> findByFileIdAndUserIdAndIsRevokedFalse(Long fileId, Long userId);
    
    Optional<FilePermission> findByFileIdAndUserIdAndPermissionTypeAndIsRevokedFalse(
        Long fileId, Long userId, FilePermission.PermissionType permissionType);
    
    // Permission checks
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM FilePermission p " +
           "WHERE p.fileId = :fileId AND p.userId = :userId AND p.permissionType = :permissionType " +
           "AND p.isRevoked = false AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    boolean hasActivePermission(@Param("fileId") Long fileId, 
                               @Param("userId") Long userId, 
                               @Param("permissionType") FilePermission.PermissionType permissionType);
    
    @Query("SELECT p.permissionType FROM FilePermission p " +
           "WHERE p.fileId = :fileId AND p.userId = :userId AND p.isRevoked = false " +
           "AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    List<FilePermission.PermissionType> getUserPermissionsForFile(@Param("fileId") Long fileId, 
                                                                  @Param("userId") Long userId);
    
    // Files accessible by user
    @Query("SELECT DISTINCT p.fileId FROM FilePermission p " +
           "WHERE p.userId = :userId AND p.isRevoked = false " +
           "AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getAccessibleFileIds(@Param("userId") Long userId);
    
    @Query("SELECT DISTINCT p.fileId FROM FilePermission p " +
           "WHERE p.userId = :userId AND p.permissionType = :permissionType AND p.isRevoked = false " +
           "AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getFileIdsWithPermission(@Param("userId") Long userId, 
                                       @Param("permissionType") FilePermission.PermissionType permissionType);
    
    // Users with access to file
    @Query("SELECT DISTINCT p.userId FROM FilePermission p " +
           "WHERE p.fileId = :fileId AND p.isRevoked = false " +
           "AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getUsersWithAccessToFile(@Param("fileId") Long fileId);
    
    @Query("SELECT DISTINCT p.userId FROM FilePermission p " +
           "WHERE p.fileId = :fileId AND p.permissionType = :permissionType AND p.isRevoked = false " +
           "AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    List<Long> getUsersWithSpecificPermission(@Param("fileId") Long fileId, 
                                            @Param("permissionType") FilePermission.PermissionType permissionType);
    
    // Permission management
    @Modifying
    @Query("UPDATE FilePermission p SET p.isRevoked = true, p.revokedAt = CURRENT_TIMESTAMP, " +
           "p.revokedBy = :revokedBy WHERE p.fileId = :fileId AND p.userId = :userId AND p.isRevoked = false")
    int revokeAllPermissionsForUser(@Param("fileId") Long fileId, 
                                   @Param("userId") Long userId, 
                                   @Param("revokedBy") Long revokedBy);
    
    @Modifying
    @Query("UPDATE FilePermission p SET p.isRevoked = true, p.revokedAt = CURRENT_TIMESTAMP, " +
           "p.revokedBy = :revokedBy WHERE p.fileId = :fileId AND p.isRevoked = false")
    int revokeAllPermissionsForFile(@Param("fileId") Long fileId, @Param("revokedBy") Long revokedBy);
    
    @Modifying
    @Query("UPDATE FilePermission p SET p.isRevoked = true, p.revokedAt = CURRENT_TIMESTAMP, " +
           "p.revokedBy = :revokedBy WHERE p.fileId = :fileId AND p.userId = :userId " +
           "AND p.permissionType = :permissionType AND p.isRevoked = false")
    int revokeSpecificPermission(@Param("fileId") Long fileId, 
                               @Param("userId") Long userId, 
                               @Param("permissionType") FilePermission.PermissionType permissionType,
                               @Param("revokedBy") Long revokedBy);
    
    // Expired permissions
    @Query("SELECT p FROM FilePermission p WHERE p.isRevoked = false AND p.expiresAt < CURRENT_TIMESTAMP")
    List<FilePermission> findExpiredPermissions();
    
    @Modifying
    @Query("UPDATE FilePermission p SET p.isRevoked = true, p.revokedAt = CURRENT_TIMESTAMP " +
           "WHERE p.isRevoked = false AND p.expiresAt < CURRENT_TIMESTAMP")
    int markExpiredPermissionsAsRevoked();
    
    // Statistics
    @Query("SELECT COUNT(p) FROM FilePermission p WHERE p.isRevoked = false")
    Long countActivePermissions();
    
    @Query("SELECT COUNT(DISTINCT p.fileId) FROM FilePermission p WHERE p.isRevoked = false")
    Long countFilesWithPermissions();
    
    @Query("SELECT COUNT(DISTINCT p.userId) FROM FilePermission p WHERE p.isRevoked = false")
    Long countUsersWithPermissions();
    
    @Query("SELECT p.permissionType, COUNT(p) FROM FilePermission p WHERE p.isRevoked = false " +
           "GROUP BY p.permissionType")
    List<Object[]> getPermissionTypeStatistics();
    
    // Audit queries
    List<FilePermission> findByGrantedByAndGrantedAtAfter(Long grantedBy, LocalDateTime since);
    
    List<FilePermission> findByRevokedByAndRevokedAtAfter(Long revokedBy, LocalDateTime since);
    
    @Query("SELECT p FROM FilePermission p WHERE p.fileId = :fileId ORDER BY p.grantedAt DESC")
    List<FilePermission> getPermissionHistoryForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT p FROM FilePermission p WHERE p.userId = :userId ORDER BY p.grantedAt DESC")
    List<FilePermission> getPermissionHistoryForUser(@Param("userId") Long userId);
    
    // Bulk operations
    @Modifying
    @Query("DELETE FROM FilePermission p WHERE p.fileId IN :fileIds")
    int deletePermissionsForFiles(@Param("fileIds") List<Long> fileIds);
    
    @Query("SELECT p FROM FilePermission p WHERE p.fileId IN :fileIds AND p.isRevoked = false")
    List<FilePermission> findActivePermissionsForFiles(@Param("fileIds") List<Long> fileIds);
}