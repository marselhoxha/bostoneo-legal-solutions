package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileTagRepository extends JpaRepository<FileTag, Long> {
    
    // Basic queries
    List<FileTag> findByFileIdOrderByTagNameAsc(Long fileId);
    
    List<FileTag> findByTagNameOrderByCreatedAtDesc(String tagName);
    
    List<FileTag> findByCreatedByOrderByCreatedAtDesc(Long createdBy);
    
    List<FileTag> findByTagCategoryOrderByTagNameAsc(String tagCategory);
    
    // Tag existence checks
    Optional<FileTag> findByFileIdAndTagName(Long fileId, String tagName);
    
    boolean existsByFileIdAndTagName(Long fileId, String tagName);
    
    // File-tag queries
    @Query("SELECT DISTINCT t.fileId FROM FileTag t WHERE t.tagName = :tagName")
    List<Long> findFileIdsByTag(@Param("tagName") String tagName);
    
    @Query("SELECT DISTINCT t.fileId FROM FileTag t WHERE t.tagName IN :tagNames")
    List<Long> findFileIdsByTags(@Param("tagNames") List<String> tagNames);
    
    @Query("SELECT t.fileId FROM FileTag t WHERE t.tagName IN :tagNames " +
           "GROUP BY t.fileId HAVING COUNT(DISTINCT t.tagName) = :tagCount")
    List<Long> findFileIdsWithAllTags(@Param("tagNames") List<String> tagNames, 
                                     @Param("tagCount") Long tagCount);
    
    // Tag discovery and statistics
    @Query("SELECT DISTINCT t.tagName FROM FileTag t ORDER BY t.tagName ASC")
    List<String> findAllUniqueTagNames();
    
    @Query("SELECT DISTINCT t.tagName FROM FileTag t WHERE t.tagCategory = :category ORDER BY t.tagName ASC")
    List<String> findUniqueTagNamesByCategory(@Param("category") String category);
    
    @Query("SELECT t.tagName, COUNT(t) as usageCount FROM FileTag t " +
           "GROUP BY t.tagName ORDER BY usageCount DESC")
    List<Object[]> getTagUsageStatistics();
    
    @Query("SELECT t.tagName, COUNT(t) as usageCount FROM FileTag t " +
           "WHERE t.tagCategory = :category GROUP BY t.tagName ORDER BY usageCount DESC")
    List<Object[]> getTagUsageStatisticsByCategory(@Param("category") String category);
    
    // Popular tags
    @Query("SELECT t.tagName FROM FileTag t GROUP BY t.tagName " +
           "ORDER BY COUNT(t) DESC LIMIT :limit")
    List<String> findMostPopularTags(@Param("limit") int limit);
    
    @Query("SELECT t.tagName FROM FileTag t WHERE t.createdBy = :userId " +
           "GROUP BY t.tagName ORDER BY COUNT(t) DESC LIMIT :limit")
    List<String> findMostUsedTagsByUser(@Param("userId") Long userId, @Param("limit") int limit);
    
    // Tag search and filtering
    @Query("SELECT DISTINCT t.tagName FROM FileTag t WHERE LOWER(t.tagName) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<String> searchTagNames(@Param("searchTerm") String searchTerm);
    
    @Query("SELECT t FROM FileTag t WHERE LOWER(t.tagName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY t.tagName ASC")
    List<FileTag> searchTags(@Param("searchTerm") String searchTerm);
    
    // Category queries
    @Query("SELECT DISTINCT t.tagCategory FROM FileTag t WHERE t.tagCategory IS NOT NULL ORDER BY t.tagCategory ASC")
    List<String> findAllCategories();
    
    @Query("SELECT COUNT(DISTINCT t.tagName) FROM FileTag t WHERE t.tagCategory = :category")
    Long countTagsInCategory(@Param("category") String category);
    
    // System vs user tags
    List<FileTag> findByIsSystemTagTrueOrderByTagNameAsc();
    
    List<FileTag> findByIsSystemTagFalseOrderByTagNameAsc();
    
    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.isSystemTag = :isSystemTag")
    Long countSystemTags(@Param("isSystemTag") Boolean isSystemTag);
    
    // File tagging statistics
    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.fileId = :fileId")
    Long countTagsForFile(@Param("fileId") Long fileId);
    
    @Query("SELECT t.fileId, COUNT(t) as tagCount FROM FileTag t " +
           "GROUP BY t.fileId ORDER BY tagCount DESC")
    List<Object[]> getFileTagCounts();
    
    @Query("SELECT COUNT(DISTINCT t.fileId) FROM FileTag t")
    Long countTaggedFiles();
    
    // User tagging activity
    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.createdBy = :userId")
    Long countTagsByUser(@Param("userId") Long userId);
    
    @Query("SELECT t.createdBy, COUNT(t) as tagCount FROM FileTag t " +
           "GROUP BY t.createdBy ORDER BY tagCount DESC")
    List<Object[]> getUserTaggingActivity();
    
    // Color-based queries
    List<FileTag> findByTagColorOrderByTagNameAsc(String tagColor);
    
    @Query("SELECT DISTINCT t.tagColor FROM FileTag t WHERE t.tagColor IS NOT NULL ORDER BY t.tagColor ASC")
    List<String> findAllTagColors();
    
    // Bulk operations
    @Query("SELECT t FROM FileTag t WHERE t.fileId IN :fileIds")
    List<FileTag> findTagsForFiles(@Param("fileIds") List<Long> fileIds);
    
    @Modifying
    void deleteByFileIdAndTagName(Long fileId, String tagName);
    
    @Modifying
    void deleteByFileId(Long fileId);
    
    // Cleanup queries
    @Query("SELECT t FROM FileTag t WHERE NOT EXISTS " +
           "(SELECT 1 FROM FileItem f WHERE f.id = t.fileId AND f.deleted = false)")
    List<FileTag> findOrphanedTags();
    
    // Related files by tags
    @Query("SELECT DISTINCT t2.fileId FROM FileTag t1 JOIN FileTag t2 ON t1.tagName = t2.tagName " +
           "WHERE t1.fileId = :fileId AND t2.fileId != :fileId")
    List<Long> findRelatedFileIds(@Param("fileId") Long fileId);
}