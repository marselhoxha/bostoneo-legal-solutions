package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.IntakeForm;
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
    
    @Query("SELECT i FROM IntakeForm i WHERE i.practiceArea IN :practiceAreas")
    List<IntakeForm> findByPracticeAreas(@Param("practiceAreas") List<String> practiceAreas);
    
    @Query("SELECT i FROM IntakeForm i WHERE i.status = 'PUBLISHED' AND i.isPublic = true")
    List<IntakeForm> findPublishedPublicForms();
    
    @Query("SELECT i FROM IntakeForm i WHERE i.practiceArea = :practiceArea AND i.status = 'PUBLISHED' AND i.isPublic = true")
    List<IntakeForm> findPublishedFormsByPracticeArea(@Param("practiceArea") String practiceArea);
    
    Page<IntakeForm> findByCreatedBy(Long createdBy, Pageable pageable);
    
    @Query("SELECT COUNT(i) FROM IntakeForm i WHERE i.practiceArea = :practiceArea AND i.status = 'PUBLISHED'")
    long countPublishedByPracticeArea(@Param("practiceArea") String practiceArea);
}