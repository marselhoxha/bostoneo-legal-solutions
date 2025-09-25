package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AILegalTemplateRepository extends JpaRepository<AILegalTemplate, Long> {
    
    List<AILegalTemplate> findByCreatedBy(Long userId);
    
    List<AILegalTemplate> findByFirmId(Long firmId);
    
    List<AILegalTemplate> findByCreatedByOrderByCreatedAtDesc(Long userId);
    
    List<AILegalTemplate> findByCategory(TemplateCategory category);
    
    List<AILegalTemplate> findByCategoryAndPracticeArea(TemplateCategory category, String practiceArea);
    
    List<AILegalTemplate> findByPracticeArea(String practiceArea);
    
    List<AILegalTemplate> findByJurisdiction(String jurisdiction);
    
    List<AILegalTemplate> findByMaJurisdictionSpecificTrue();
    
    Page<AILegalTemplate> findByMaJurisdictionSpecificTrueAndIsApprovedTrue(Pageable pageable);
    
    List<AILegalTemplate> findByIsPublicTrueAndIsApprovedTrue();
    
    Page<AILegalTemplate> findByIsApprovedTrueAndIsPublicTrue(Pageable pageable);
    
    Page<AILegalTemplate> findByCategoryAndIsApprovedTrue(TemplateCategory category, Pageable pageable);
    
    Page<AILegalTemplate> findByPracticeAreaAndIsApprovedTrue(String practiceArea, Pageable pageable);
    
    List<AILegalTemplate> findByIsMaCertifiedTrue();
    
    List<AILegalTemplate> findByFirmIdAndIsApprovedTrue(Long firmId);
    
    Page<AILegalTemplate> findByNameContainingIgnoreCase(String name, Pageable pageable);
    
    @Query("SELECT t FROM AILegalTemplate t WHERE t.practiceArea = :practiceArea AND t.isPublic = true AND t.isApproved = true ORDER BY t.usageCount DESC")
    List<AILegalTemplate> findPopularTemplatesByPracticeArea(@Param("practiceArea") String practiceArea);
    
    @Query("SELECT t FROM AILegalTemplate t WHERE (t.createdBy = :userId OR t.firmId = :firmId OR t.isPublic = true) AND t.isApproved = true ORDER BY t.createdAt DESC")
    List<AILegalTemplate> findAccessibleTemplates(@Param("userId") Long userId, @Param("firmId") Long firmId);
    
    @Query("SELECT t FROM AILegalTemplate t WHERE t.styleGuideId = :styleGuideId")
    List<AILegalTemplate> findByStyleGuideId(@Param("styleGuideId") Long styleGuideId);

    @Query("SELECT t FROM AILegalTemplate t WHERE t.name LIKE %:name%")
    List<AILegalTemplate> findByNameContaining(@Param("name") String name);

    List<AILegalTemplate> findByTemplateTypeIn(List<String> templateTypes);
}