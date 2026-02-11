package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Long> {
    
    // Basic queries
    List<Folder> findByDeletedFalseOrderByNameAsc();
    
    List<Folder> findByParentFolderIdAndDeletedFalse(Long parentFolderId);
    
    List<Folder> findByParentFolderIdIsNullAndDeletedFalse();
    
    @Query("SELECT f FROM Folder f WHERE f.parentFolderId IS NULL AND f.deleted = false " +
           "AND f.caseId IS NULL AND f.createdBy = :userId")
    List<Folder> findPersonalRootFolders(@Param("userId") Long userId);

    @Query("SELECT f FROM Folder f WHERE f.parentFolderId IS NULL AND f.deleted = false " +
           "AND f.caseId IS NULL AND f.createdBy = :userId AND f.organizationId = :orgId")
    List<Folder> findPersonalRootFoldersByOrganization(@Param("userId") Long userId, @Param("orgId") Long organizationId);

    @Query("SELECT f FROM Folder f WHERE f.parentFolderId = :parentId AND f.deleted = false " +
           "AND f.caseId IS NULL AND f.createdBy = :userId")
    List<Folder> findPersonalSubfolders(@Param("parentId") Long parentId, @Param("userId") Long userId);

    @Query("SELECT f FROM Folder f WHERE f.parentFolderId = :parentId AND f.deleted = false " +
           "AND f.caseId IS NULL AND f.createdBy = :userId AND f.organizationId = :orgId")
    List<Folder> findPersonalSubfoldersByOrganization(@Param("parentId") Long parentId, @Param("userId") Long userId, @Param("orgId") Long organizationId);
    
    List<Folder> findByCreatedByAndDeletedFalse(Long createdBy);
    
    // Case-related queries
    List<Folder> findByCaseIdAndDeletedFalse(Long caseId);
    
    @Query("SELECT f FROM Folder f WHERE f.caseId = :caseId AND f.parentFolderId IS NULL AND f.deleted = false")
    List<Folder> findRootFoldersByCaseId(@Param("caseId") Long caseId);
    
    List<Folder> findByDepartmentIdAndDeletedFalse(Long departmentId);
    
    List<Folder> findByPracticeAreaAndDeletedFalse(String practiceArea);
    
    // Search queries
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND " +
           "LOWER(f.name) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<Folder> searchByNameOrDescription(@Param("searchTerm") String searchTerm);
    
    // Hierarchy queries
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND " +
           "f.parentFolderId = :parentId ORDER BY f.name ASC")
    List<Folder> findSubFolders(@Param("parentId") Long parentId);
    
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND " +
           "f.parentFolderId IS NULL ORDER BY f.name ASC")
    List<Folder> findRootFolders();
    
    // Path queries
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND f.name = :name AND " +
           "(:parentId IS NULL AND f.parentFolderId IS NULL OR f.parentFolderId = :parentId)")
    Optional<Folder> findByNameAndParent(@Param("name") String name, @Param("parentId") Long parentId);
    
    // Template queries
    List<Folder> findByIsTemplateTrueAndDeletedFalse();
    
    List<Folder> findByIsTemplateTrueAndPracticeAreaAndDeletedFalse(String practiceArea);
    
    List<Folder> findByIsTemplateTrueAndFolderTypeAndDeletedFalse(String folderType);
    
    // Statistics
    @Query("SELECT COUNT(f) FROM Folder f WHERE f.deleted = false")
    Long countActiveFolders();
    
    @Query("SELECT COUNT(f) FROM Folder f WHERE f.deleted = false AND f.caseId = :caseId")
    Long countFoldersByCase(@Param("caseId") Long caseId);
    
    @Query("SELECT COUNT(f) FROM Folder f WHERE f.deleted = false AND f.createdBy = :userId")
    Long countFoldersByUser(@Param("userId") Long userId);
    
    // Advanced filtering
    @Query("SELECT f FROM Folder f WHERE f.deleted = false " +
           "AND (:parentId IS NULL OR f.parentFolderId = :parentId) " +
           "AND (:caseId IS NULL OR f.caseId = :caseId) " +
           "AND (:createdBy IS NULL OR f.createdBy = :createdBy) " +
           "AND (:practiceArea IS NULL OR f.practiceArea = :practiceArea) " +
           "AND (:folderType IS NULL OR f.folderType = :folderType)")
    List<Folder> findWithFilters(
        @Param("parentId") Long parentId,
        @Param("caseId") Long caseId,
        @Param("createdBy") Long createdBy,
        @Param("practiceArea") String practiceArea,
        @Param("folderType") String folderType
    );
    
    // Orphaned folders (for cleanup)
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND f.parentFolderId IS NOT NULL " +
           "AND NOT EXISTS (SELECT 1 FROM Folder p WHERE p.id = f.parentFolderId AND p.deleted = false)")
    List<Folder> findOrphanedFolders();
    
    // Empty folders
    @Query("SELECT f FROM Folder f WHERE f.deleted = false " +
           "AND NOT EXISTS (SELECT 1 FROM FileItem fi WHERE fi.folderId = f.id AND fi.deleted = false) " +
           "AND NOT EXISTS (SELECT 1 FROM Folder sf WHERE sf.parentFolderId = f.id AND sf.deleted = false)")
    List<Folder> findEmptyFolders();

    // ==================== TENANT-FILTERED METHODS ====================

    List<Folder> findByOrganizationIdAndDeletedFalse(Long organizationId);

    @Query("SELECT f FROM Folder f WHERE f.organizationId = :orgId AND f.parentFolderId IS NULL AND f.deleted = false")
    List<Folder> findRootFoldersByOrganization(@Param("orgId") Long organizationId);

    @Query("SELECT f FROM Folder f WHERE f.organizationId = :orgId AND f.parentFolderId = :parentId AND f.deleted = false")
    List<Folder> findSubFoldersByOrganization(@Param("orgId") Long organizationId, @Param("parentId") Long parentId);

    @Query("SELECT f FROM Folder f WHERE f.organizationId = :orgId AND f.caseId = :caseId AND f.deleted = false")
    List<Folder> findByOrganizationIdAndCaseId(@Param("orgId") Long organizationId, @Param("caseId") Long caseId);

    @Query("SELECT f FROM Folder f WHERE f.organizationId = :orgId AND f.deleted = false AND " +
           "LOWER(f.name) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<Folder> searchByOrganizationAndName(@Param("orgId") Long organizationId, @Param("searchTerm") String searchTerm);

    @Query("SELECT COUNT(f) FROM Folder f WHERE f.organizationId = :orgId AND f.deleted = false")
    Long countByOrganization(@Param("orgId") Long organizationId);

    @Query("SELECT f FROM Folder f WHERE f.organizationId = :orgId AND f.caseId = :caseId AND f.parentFolderId IS NULL AND f.deleted = false")
    List<Folder> findRootFoldersByCaseIdAndOrganization(@Param("orgId") Long organizationId, @Param("caseId") Long caseId);

    Optional<Folder> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    /** SECURITY: Find subfolders by parent with org filter */
    @Query("SELECT f FROM Folder f WHERE f.parentFolderId = :parentId AND f.deleted = false AND f.organizationId = :orgId")
    List<Folder> findByParentFolderIdAndDeletedFalseAndOrganizationId(
        @Param("parentId") Long parentFolderId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find folder by name and parent with org filter */
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND f.name = :name AND f.organizationId = :orgId AND " +
           "(:parentId IS NULL AND f.parentFolderId IS NULL OR f.parentFolderId = :parentId)")
    Optional<Folder> findByNameAndParentAndOrganizationId(
        @Param("name") String name,
        @Param("parentId") Long parentId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find folder by name, parent, case, and org filter */
    @Query("SELECT f FROM Folder f WHERE f.deleted = false AND f.name = :name AND f.organizationId = :orgId AND f.caseId = :caseId AND " +
           "(:parentId IS NULL AND f.parentFolderId IS NULL OR f.parentFolderId = :parentId)")
    Optional<Folder> findByNameAndParentAndCaseAndOrganizationId(
        @Param("name") String name,
        @Param("parentId") Long parentId,
        @Param("caseId") Long caseId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find subfolders in folder with org filter */
    @Query("SELECT f FROM Folder f WHERE f.parentFolderId = :parentFolderId AND f.deleted = false AND f.organizationId = :orgId")
    List<Folder> findByParentFolderIdAndDeletedFalseAndOrgId(
        @Param("parentFolderId") Long parentFolderId,
        @Param("orgId") Long organizationId);
}