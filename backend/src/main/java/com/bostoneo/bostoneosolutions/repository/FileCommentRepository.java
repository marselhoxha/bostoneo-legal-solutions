package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.FileComment;
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
public interface FileCommentRepository extends JpaRepository<FileComment, Long> {
    
    // Basic queries
    List<FileComment> findByFileIdAndIsDeletedFalseOrderByCreatedAtAsc(Long fileId);
    
    Page<FileComment> findByFileIdAndIsDeletedFalse(Long fileId, Pageable pageable);
    
    List<FileComment> findByCreatedByAndIsDeletedFalseOrderByCreatedAtDesc(Long createdBy);
    
    List<FileComment> findByParentCommentIdAndIsDeletedFalseOrderByCreatedAtAsc(Long parentCommentId);
    
    // Thread queries (top-level comments only)
    @Query("SELECT c FROM FileComment c WHERE c.fileId = :fileId AND c.parentCommentId IS NULL " +
           "AND c.isDeleted = false ORDER BY c.createdAt ASC")
    List<FileComment> findTopLevelComments(@Param("fileId") Long fileId);
    
    @Query("SELECT c FROM FileComment c WHERE c.fileId = :fileId AND c.parentCommentId IS NULL " +
           "AND c.isDeleted = false ORDER BY c.createdAt ASC")
    Page<FileComment> findTopLevelComments(@Param("fileId") Long fileId, Pageable pageable);
    
    // Reply queries
    @Query("SELECT c FROM FileComment c WHERE c.parentCommentId = :parentId " +
           "AND c.isDeleted = false ORDER BY c.createdAt ASC")
    List<FileComment> findReplies(@Param("parentId") Long parentId);
    
    @Query("SELECT COUNT(c) FROM FileComment c WHERE c.parentCommentId = :parentId AND c.isDeleted = false")
    Long countReplies(@Param("parentId") Long parentId);
    
    // Statistics
    @Query("SELECT COUNT(c) FROM FileComment c WHERE c.fileId = :fileId AND c.isDeleted = false")
    Long countCommentsForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT COUNT(c) FROM FileComment c WHERE c.createdBy = :userId AND c.isDeleted = false")
    Long countCommentsByUser(@Param("userId") Long userId);
    
    @Query("SELECT COUNT(c) FROM FileComment c WHERE c.isDeleted = false")
    Long countAllActiveComments();
    
    // Recent comments
    @Query("SELECT c FROM FileComment c WHERE c.isDeleted = false AND c.createdAt >= :since " +
           "ORDER BY c.createdAt DESC")
    List<FileComment> findRecentComments(@Param("since") LocalDateTime since);
    
    @Query("SELECT c FROM FileComment c WHERE c.fileId = :fileId AND c.isDeleted = false " +
           "AND c.createdAt >= :since ORDER BY c.createdAt DESC")
    List<FileComment> findRecentCommentsForFile(@Param("fileId") Long fileId, @Param("since") LocalDateTime since);
    
    @Query("SELECT c FROM FileComment c WHERE c.createdBy = :userId AND c.isDeleted = false " +
           "ORDER BY c.createdAt DESC")
    List<FileComment> findRecentCommentsByUser(@Param("userId") Long userId, Pageable pageable);
    
    // Internal vs external comments
    List<FileComment> findByFileIdAndIsInternalAndIsDeletedFalseOrderByCreatedAtAsc(Long fileId, Boolean isInternal);
    
    @Query("SELECT COUNT(c) FROM FileComment c WHERE c.fileId = :fileId AND c.isInternal = :isInternal " +
           "AND c.isDeleted = false")
    Long countCommentsByType(@Param("fileId") Long fileId, @Param("isInternal") Boolean isInternal);
    
    // Search comments
    @Query("SELECT c FROM FileComment c WHERE c.fileId = :fileId AND c.isDeleted = false " +
           "AND LOWER(c.commentText) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY c.createdAt DESC")
    List<FileComment> searchCommentsForFile(@Param("fileId") Long fileId, @Param("searchTerm") String searchTerm);
    
    @Query("SELECT c FROM FileComment c WHERE c.isDeleted = false " +
           "AND LOWER(c.commentText) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY c.createdAt DESC")
    List<FileComment> searchAllComments(@Param("searchTerm") String searchTerm);
    
    // Comments with mentions - DISABLED: mentionUsers column doesn't exist in database
    // @Query("SELECT c FROM FileComment c WHERE c.isDeleted = false AND c.mentionUsers IS NOT NULL " +
    //        "AND c.mentionUsers LIKE CONCAT('%', :userId, '%')")
    // List<FileComment> findCommentsWithUserMention(@Param("userId") String userId);
    
    // File activity (comments as activity indicators)
    @Query("SELECT c.fileId, COUNT(c) as commentCount FROM FileComment c " +
           "WHERE c.isDeleted = false AND c.createdAt >= :since " +
           "GROUP BY c.fileId ORDER BY commentCount DESC")
    List<Object[]> findMostCommentedFiles(@Param("since") LocalDateTime since);
    
    // Cleanup queries
    @Query("SELECT c FROM FileComment c WHERE c.isDeleted = true AND c.updatedAt < :cutoffDate")
    List<FileComment> findDeletedCommentsOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);
    
    @Query("SELECT c FROM FileComment c WHERE c.isDeleted = false " +
           "AND NOT EXISTS (SELECT 1 FROM FileItem f WHERE f.id = c.fileId AND f.deleted = false)")
    List<FileComment> findOrphanedComments();
    
    // User activity
    @Query("SELECT c FROM FileComment c WHERE c.createdBy = :userId AND c.isDeleted = false " +
           "AND c.createdAt BETWEEN :startDate AND :endDate ORDER BY c.createdAt DESC")
    List<FileComment> findUserCommentsInDateRange(@Param("userId") Long userId, 
                                                 @Param("startDate") LocalDateTime startDate,
                                                 @Param("endDate") LocalDateTime endDate);
    
    // Latest comment per file
    @Query("SELECT c1 FROM FileComment c1 WHERE c1.isDeleted = false " +
           "AND c1.createdAt = (SELECT MAX(c2.createdAt) FROM FileComment c2 " +
           "WHERE c2.fileId = c1.fileId AND c2.isDeleted = false)")
    List<FileComment> findLatestCommentPerFile();
    
    @Modifying
    void deleteByFileId(Long fileId);
}