package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.model.IntakeForm;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface IntakeFormService {
    
    // Basic CRUD operations
    IntakeForm save(IntakeForm intakeForm);
    
    Optional<IntakeForm> findById(Long id);
    
    List<IntakeForm> findAll();
    
    Page<IntakeForm> findAll(Pageable pageable);
    
    void deleteById(Long id);
    
    boolean existsById(Long id);
    
    // Practice area specific operations
    List<IntakeForm> findByPracticeArea(String practiceArea);
    
    List<IntakeForm> findPublishedFormsByPracticeArea(String practiceArea);
    
    List<IntakeForm> findAvailablePracticeAreas();
    
    // Form management operations
    IntakeForm createForm(IntakeForm intakeForm, Long userId);
    
    IntakeForm updateForm(Long id, IntakeForm intakeForm, Long userId);
    
    IntakeForm publishForm(Long id, Long userId);
    
    IntakeForm unpublishForm(Long id, Long userId);
    
    IntakeForm duplicateForm(Long id, String newName, Long userId);
    
    // Public form operations
    List<IntakeForm> findPublicForms();
    
    List<IntakeForm> findByPracticeAreaAndPublic(String practiceArea, boolean isPublic);
    
    IntakeForm findByPublicUrl(String publicUrl);
    
    // Status and filtering operations
    List<IntakeForm> findByStatus(String status);
    
    List<IntakeForm> findByFormType(String formType);
    
    Page<IntakeForm> findByCreatedBy(Long userId, Pageable pageable);
    
    // Analytics and statistics
    long countPublishedByPracticeArea(String practiceArea);
    
    List<IntakeForm> getDefaultFormsForAllPracticeAreas();
    
    // Form configuration operations
    IntakeForm updateFormConfiguration(Long id, String formConfig, Long userId);
    
    IntakeForm updateFormSettings(Long id, String successMessage, String redirectUrl, Long userId);
    
    // Validation operations
    boolean validateFormConfiguration(String formConfig);
    
    boolean isPublicUrlAvailable(String publicUrl, Long excludeFormId);
}