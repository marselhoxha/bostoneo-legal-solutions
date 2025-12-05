package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.SignatureTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SignatureTemplateRepository extends JpaRepository<SignatureTemplate, Long> {

    // Find by organization (includes org-specific and global templates)
    @Query("SELECT st FROM SignatureTemplate st WHERE st.isActive = true " +
            "AND (st.organizationId = :orgId OR st.isGlobal = true) " +
            "ORDER BY st.isGlobal ASC, st.name ASC")
    List<SignatureTemplate> findAvailableForOrganization(@Param("orgId") Long organizationId);

    // Find by organization with pagination
    @Query("SELECT st FROM SignatureTemplate st WHERE st.isActive = true " +
            "AND (st.organizationId = :orgId OR st.isGlobal = true)")
    Page<SignatureTemplate> findAvailableForOrganization(@Param("orgId") Long organizationId, Pageable pageable);

    // Find only organization-specific templates
    List<SignatureTemplate> findByOrganizationIdAndIsActiveTrue(Long organizationId);

    Page<SignatureTemplate> findByOrganizationId(Long organizationId, Pageable pageable);

    // Find global templates only
    List<SignatureTemplate> findByIsGlobalTrueAndIsActiveTrue();

    // Find by category
    List<SignatureTemplate> findByOrganizationIdAndCategoryAndIsActiveTrue(Long organizationId, String category);

    @Query("SELECT st FROM SignatureTemplate st WHERE st.isActive = true " +
            "AND st.category = :category AND (st.organizationId = :orgId OR st.isGlobal = true)")
    List<SignatureTemplate> findAvailableByCategoryForOrganization(@Param("orgId") Long organizationId,
                                                                     @Param("category") String category);

    // Find by name (for duplicate checking)
    Optional<SignatureTemplate> findByOrganizationIdAndNameAndIsActiveTrue(Long organizationId, String name);

    // Find by BoldSign template ID
    Optional<SignatureTemplate> findByBoldsignTemplateId(String boldsignTemplateId);

    // Search templates
    @Query("SELECT st FROM SignatureTemplate st WHERE st.isActive = true " +
            "AND (st.organizationId = :orgId OR st.isGlobal = true) " +
            "AND (LOWER(st.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(st.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<SignatureTemplate> searchAvailableForOrganization(@Param("orgId") Long organizationId,
                                                            @Param("search") String search,
                                                            Pageable pageable);

    // Count by organization
    long countByOrganizationIdAndIsActiveTrue(Long organizationId);

    // Find distinct categories for organization
    @Query("SELECT DISTINCT st.category FROM SignatureTemplate st WHERE st.isActive = true " +
            "AND (st.organizationId = :orgId OR st.isGlobal = true) AND st.category IS NOT NULL")
    List<String> findDistinctCategoriesForOrganization(@Param("orgId") Long organizationId);
}
