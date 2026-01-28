package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIStyleGuide;
import com.bostoneo.bostoneosolutions.enumeration.CitationStyle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIStyleGuideRepository extends JpaRepository<AIStyleGuide, Long> {
    
    List<AIStyleGuide> findByCreatedByAndIsActiveTrue(Long userId);
    
    List<AIStyleGuide> findByFirmIdAndIsActiveTrue(Long firmId);
    
    List<AIStyleGuide> findByFirmId(Long firmId);
    
    List<AIStyleGuide> findByCreatedBy(Long userId);
    
    List<AIStyleGuide> findByIsActiveTrue();
    
    Optional<AIStyleGuide> findByFirmIdAndIsDefaultTrueAndIsActiveTrue(Long firmId);
    
    List<AIStyleGuide> findByCitationStyle(CitationStyle citationStyle);
    
    List<AIStyleGuide> findByNameContainingIgnoreCase(String name);
    
    @Query("SELECT sg FROM AIStyleGuide sg WHERE sg.firmId = :firmId AND sg.isActive = true ORDER BY sg.isDefault DESC, sg.createdAt DESC")
    List<AIStyleGuide> findByFirmIdOrderedByDefaultFirst(@Param("firmId") Long firmId);
    
    @Query("SELECT sg FROM AIStyleGuide sg WHERE (sg.createdBy = :userId OR sg.firmId = :firmId) AND sg.isActive = true")
    List<AIStyleGuide> findAccessibleStyleGuides(@Param("userId") Long userId, @Param("firmId") Long firmId);
    
    @Query("SELECT COUNT(sg) FROM AIStyleGuide sg WHERE sg.firmId = :firmId AND sg.isDefault = true AND sg.isActive = true")
    Long countDefaultStyleGuidesByFirm(@Param("firmId") Long firmId);

    // ==================== TENANT-FILTERED METHODS ====================

    List<AIStyleGuide> findByOrganizationId(Long organizationId);

    List<AIStyleGuide> findByOrganizationIdAndIsActiveTrue(Long organizationId);

    Optional<AIStyleGuide> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find style guide by ID that is accessible to the organization
     * (either system-wide with null orgId OR belongs to the organization)
     */
    @Query("SELECT sg FROM AIStyleGuide sg WHERE sg.id = :id AND (sg.organizationId IS NULL OR sg.organizationId = :organizationId)")
    Optional<AIStyleGuide> findByIdAndAccessibleByOrganization(@Param("id") Long id, @Param("organizationId") Long organizationId);
}