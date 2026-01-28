package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.IntakeForm;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IntakeFormRepository extends JpaRepository<IntakeForm, Long> {

    List<IntakeForm> findByPracticeArea(String practiceArea);
    
    List<IntakeForm> findByPracticeAreaAndIsPublic(String practiceArea, Boolean isPublic);
    
    List<IntakeForm> findByFormType(String formType);
    
    List<IntakeForm> findByStatus(String status);
    
    List<IntakeForm> findByIsPublicTrue();
    
    Optional<IntakeForm> findByPublicUrl(String publicUrl);
    
    List<IntakeForm> findByName(String name);
    
    @Query("SELECT i FROM IntakeForm i WHERE i.practiceArea IN :practiceAreas")
    List<IntakeForm> findByPracticeAreas(@Param("practiceAreas") List<String> practiceAreas);
    
    @Query("SELECT i FROM IntakeForm i WHERE i.status = 'PUBLISHED' AND i.isPublic = true")
    List<IntakeForm> findPublishedPublicForms();
    
    @Query("SELECT i FROM IntakeForm i WHERE i.practiceArea = :practiceArea AND i.status = 'PUBLISHED' AND i.isPublic = true")
    List<IntakeForm> findPublishedFormsByPracticeArea(@Param("practiceArea") String practiceArea);
    
    Page<IntakeForm> findByCreatedBy(Long createdBy, Pageable pageable);
    
    @Query("SELECT COUNT(i) FROM IntakeForm i WHERE i.practiceArea = :practiceArea AND i.status = 'PUBLISHED'")
    long countPublishedByPracticeArea(@Param("practiceArea") String practiceArea);

    // ==================== TENANT-FILTERED METHODS ====================

    List<IntakeForm> findByOrganizationId(Long organizationId);

    Page<IntakeForm> findByOrganizationId(Long organizationId, Pageable pageable);

    List<IntakeForm> findByOrganizationIdAndStatus(Long organizationId, String status);

    List<IntakeForm> findByOrganizationIdAndPracticeArea(Long organizationId, String practiceArea);

    @Query("SELECT i FROM IntakeForm i WHERE i.organizationId = :organizationId AND i.status = 'PUBLISHED'")
    List<IntakeForm> findPublishedByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT i FROM IntakeForm i WHERE i.organizationId = :orgId AND i.practiceArea = :practiceArea AND i.status = 'PUBLISHED' AND i.isPublic = true")
    List<IntakeForm> findPublishedFormsByOrganizationAndPracticeArea(@Param("orgId") Long organizationId, @Param("practiceArea") String practiceArea);

    @Query("SELECT i FROM IntakeForm i WHERE i.organizationId = :orgId AND i.practiceArea IN :practiceAreas")
    List<IntakeForm> findByOrganizationIdAndPracticeAreas(@Param("orgId") Long organizationId, @Param("practiceAreas") List<String> practiceAreas);

    // Secure findById with org verification
    Optional<IntakeForm> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    List<IntakeForm> findByOrganizationIdAndName(Long organizationId, String name);

    List<IntakeForm> findByOrganizationIdAndFormType(Long organizationId, String formType);

    Page<IntakeForm> findByOrganizationIdAndCreatedBy(Long organizationId, Long createdBy, Pageable pageable);

    @Query("SELECT COUNT(i) FROM IntakeForm i WHERE i.organizationId = :orgId AND i.practiceArea = :practiceArea AND i.status = 'PUBLISHED'")
    long countPublishedByOrganizationAndPracticeArea(@Param("orgId") Long organizationId, @Param("practiceArea") String practiceArea);
}