package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for FileTag entity with multi-tenant support.
 * All new methods require organizationId for tenant isolation.
 */
@Repository
public interface FileTagRepository extends JpaRepository<FileTag, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<FileTag> findByIdAndOrganizationId(Long id, Long organizationId);

    List<FileTag> findByOrganizationIdAndFileIdOrderByTagNameAsc(Long organizationId, Long fileId);

    List<FileTag> findByOrganizationIdAndTagNameOrderByCreatedAtDesc(Long organizationId, String tagName);

    List<FileTag> findByOrganizationIdAndCreatedByOrderByCreatedAtDesc(Long organizationId, Long createdBy);

    List<FileTag> findByOrganizationIdAndTagCategoryOrderByTagNameAsc(Long organizationId, String tagCategory);

    Optional<FileTag> findByOrganizationIdAndFileIdAndTagName(Long organizationId, Long fileId, String tagName);

    boolean existsByOrganizationIdAndFileIdAndTagName(Long organizationId, Long fileId, String tagName);

    @Query("SELECT DISTINCT t.fileId FROM FileTag t WHERE t.organizationId = :orgId AND t.tagName = :tagName")
    List<Long> findFileIdsByTagAndOrganizationId(@Param("orgId") Long organizationId, @Param("tagName") String tagName);

    @Query("SELECT DISTINCT t.tagName FROM FileTag t WHERE t.organizationId = :orgId ORDER BY t.tagName ASC")
    List<String> findAllUniqueTagNamesByOrganizationId(@Param("orgId") Long organizationId);

    @Query("SELECT t.tagName, COUNT(t) as usageCount FROM FileTag t WHERE t.organizationId = :orgId " +
           "GROUP BY t.tagName ORDER BY usageCount DESC")
    List<Object[]> getTagUsageStatisticsByOrganizationId(@Param("orgId") Long organizationId);

    @Query("SELECT DISTINCT t.tagName FROM FileTag t WHERE t.organizationId = :orgId " +
           "AND LOWER(t.tagName) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<String> searchTagNamesByOrganizationId(@Param("orgId") Long organizationId, @Param("searchTerm") String searchTerm);

    @Query("SELECT DISTINCT t.tagCategory FROM FileTag t WHERE t.organizationId = :orgId " +
           "AND t.tagCategory IS NOT NULL ORDER BY t.tagCategory ASC")
    List<String> findAllCategoriesByOrganizationId(@Param("orgId") Long organizationId);

    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.organizationId = :orgId AND t.fileId = :fileId")
    Long countTagsForFileByOrganizationId(@Param("orgId") Long organizationId, @Param("fileId") Long fileId);

    @Query("SELECT t FROM FileTag t WHERE t.organizationId = :orgId AND t.fileId IN :fileIds")
    List<FileTag> findTagsForFilesByOrganizationId(@Param("orgId") Long organizationId, @Param("fileIds") List<Long> fileIds);

    @Modifying
    @Query("DELETE FROM FileTag t WHERE t.organizationId = :orgId AND t.fileId = :fileId AND t.tagName = :tagName")
    void deleteByOrganizationIdAndFileIdAndTagName(@Param("orgId") Long organizationId, @Param("fileId") Long fileId, @Param("tagName") String tagName);

    @Modifying
    @Query("DELETE FROM FileTag t WHERE t.organizationId = :orgId AND t.fileId = :fileId")
    void deleteByOrganizationIdAndFileId(@Param("orgId") Long organizationId, @Param("fileId") Long fileId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: All methods bypass multi-tenant isolation.
    // Verify file ownership through FileItem.organizationId before calling.

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    List<FileTag> findByFileIdOrderByTagNameAsc(Long fileId);

    /** @deprecated May return data from all organizations */
    @Deprecated
    List<FileTag> findByTagNameOrderByCreatedAtDesc(String tagName);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    List<FileTag> findByCreatedByOrderByCreatedAtDesc(Long createdBy);

    /** @deprecated May return data from all organizations */
    @Deprecated
    List<FileTag> findByTagCategoryOrderByTagNameAsc(String tagCategory);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    Optional<FileTag> findByFileIdAndTagName(Long fileId, String tagName);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    boolean existsByFileIdAndTagName(Long fileId, String tagName);

    /** @deprecated May return data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.fileId FROM FileTag t WHERE t.tagName = :tagName")
    List<Long> findFileIdsByTag(@Param("tagName") String tagName);

    /** @deprecated May return data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.fileId FROM FileTag t WHERE t.tagName IN :tagNames")
    List<Long> findFileIdsByTags(@Param("tagNames") List<String> tagNames);

    /** @deprecated May return data from all organizations */
    @Deprecated
    @Query("SELECT t.fileId FROM FileTag t WHERE t.tagName IN :tagNames " +
           "GROUP BY t.fileId HAVING COUNT(DISTINCT t.tagName) = :tagCount")
    List<Long> findFileIdsWithAllTags(@Param("tagNames") List<String> tagNames,
                                     @Param("tagCount") Long tagCount);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.tagName FROM FileTag t ORDER BY t.tagName ASC")
    List<String> findAllUniqueTagNames();

    /** @deprecated May return data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.tagName FROM FileTag t WHERE t.tagCategory = :category ORDER BY t.tagName ASC")
    List<String> findUniqueTagNamesByCategory(@Param("category") String category);

    /** @deprecated Returns statistics from all organizations */
    @Deprecated
    @Query("SELECT t.tagName, COUNT(t) as usageCount FROM FileTag t " +
           "GROUP BY t.tagName ORDER BY usageCount DESC")
    List<Object[]> getTagUsageStatistics();

    /** @deprecated Returns statistics from all organizations */
    @Deprecated
    @Query("SELECT t.tagName, COUNT(t) as usageCount FROM FileTag t " +
           "WHERE t.tagCategory = :category GROUP BY t.tagName ORDER BY usageCount DESC")
    List<Object[]> getTagUsageStatisticsByCategory(@Param("category") String category);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT t.tagName FROM FileTag t GROUP BY t.tagName " +
           "ORDER BY COUNT(t) DESC LIMIT :limit")
    List<String> findMostPopularTags(@Param("limit") int limit);

    /** @deprecated Verify user organization before calling */
    @Deprecated
    @Query("SELECT t.tagName FROM FileTag t WHERE t.createdBy = :userId " +
           "GROUP BY t.tagName ORDER BY COUNT(t) DESC LIMIT :limit")
    List<String> findMostUsedTagsByUser(@Param("userId") Long userId, @Param("limit") int limit);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.tagName FROM FileTag t WHERE LOWER(t.tagName) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<String> searchTagNames(@Param("searchTerm") String searchTerm);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT t FROM FileTag t WHERE LOWER(t.tagName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY t.tagName ASC")
    List<FileTag> searchTags(@Param("searchTerm") String searchTerm);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.tagCategory FROM FileTag t WHERE t.tagCategory IS NOT NULL ORDER BY t.tagCategory ASC")
    List<String> findAllCategories();

    /** @deprecated Returns count from all organizations */
    @Deprecated
    @Query("SELECT COUNT(DISTINCT t.tagName) FROM FileTag t WHERE t.tagCategory = :category")
    Long countTagsInCategory(@Param("category") String category);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    List<FileTag> findByIsSystemTagTrueOrderByTagNameAsc();

    /** @deprecated Returns data from all organizations */
    @Deprecated
    List<FileTag> findByIsSystemTagFalseOrderByTagNameAsc();

    /** @deprecated Returns count from all organizations */
    @Deprecated
    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.isSystemTag = :isSystemTag")
    Long countSystemTags(@Param("isSystemTag") Boolean isSystemTag);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.fileId = :fileId")
    Long countTagsForFile(@Param("fileId") Long fileId);

    /** @deprecated Returns statistics from all organizations */
    @Deprecated
    @Query("SELECT t.fileId, COUNT(t) as tagCount FROM FileTag t " +
           "GROUP BY t.fileId ORDER BY tagCount DESC")
    List<Object[]> getFileTagCounts();

    /** @deprecated Returns count from all organizations */
    @Deprecated
    @Query("SELECT COUNT(DISTINCT t.fileId) FROM FileTag t")
    Long countTaggedFiles();

    /** @deprecated Verify user organization before calling */
    @Deprecated
    @Query("SELECT COUNT(t) FROM FileTag t WHERE t.createdBy = :userId")
    Long countTagsByUser(@Param("userId") Long userId);

    /** @deprecated Returns statistics from all organizations */
    @Deprecated
    @Query("SELECT t.createdBy, COUNT(t) as tagCount FROM FileTag t " +
           "GROUP BY t.createdBy ORDER BY tagCount DESC")
    List<Object[]> getUserTaggingActivity();

    /** @deprecated May return data from all organizations */
    @Deprecated
    List<FileTag> findByTagColorOrderByTagNameAsc(String tagColor);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT DISTINCT t.tagColor FROM FileTag t WHERE t.tagColor IS NOT NULL ORDER BY t.tagColor ASC")
    List<String> findAllTagColors();

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Query("SELECT t FROM FileTag t WHERE t.fileId IN :fileIds")
    List<FileTag> findTagsForFiles(@Param("fileIds") List<Long> fileIds);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Modifying
    void deleteByFileIdAndTagName(Long fileId, String tagName);

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Modifying
    void deleteByFileId(Long fileId);

    /** @deprecated Returns data from all organizations */
    @Deprecated
    @Query("SELECT t FROM FileTag t WHERE NOT EXISTS " +
           "(SELECT 1 FROM FileItem f WHERE f.id = t.fileId AND f.deleted = false)")
    List<FileTag> findOrphanedTags();

    /** @deprecated Verify file ownership through FileItem.organizationId before calling */
    @Deprecated
    @Query("SELECT DISTINCT t2.fileId FROM FileTag t1 JOIN FileTag t2 ON t1.tagName = t2.tagName " +
           "WHERE t1.fileId = :fileId AND t2.fileId != :fileId")
    List<Long> findRelatedFileIds(@Param("fileId") Long fileId);
}
