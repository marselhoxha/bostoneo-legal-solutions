package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.IntakeForm;
import com.***REMOVED***.***REMOVED***solutions.repository.IntakeFormRepository;
import com.***REMOVED***.***REMOVED***solutions.service.IntakeFormService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class IntakeFormServiceImpl implements IntakeFormService {

    private final IntakeFormRepository intakeFormRepository;
    private final ObjectMapper objectMapper;

    // Available practice areas as constants
    private static final List<String> PRACTICE_AREAS = Arrays.asList(
        "Personal Injury", 
        "Family Law", 
        "Criminal Defense", 
        "Business Law", 
        "Real Estate Law", 
        "Immigration Law"
    );

    @Override
    public IntakeForm save(IntakeForm intakeForm) {
        log.debug("Saving intake form: {}", intakeForm.getName());
        return intakeFormRepository.save(intakeForm);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<IntakeForm> findById(Long id) {
        return intakeFormRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findAll() {
        return intakeFormRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IntakeForm> findAll(Pageable pageable) {
        return intakeFormRepository.findAll(pageable);
    }

    @Override
    public void deleteById(Long id) {
        log.info("Deleting intake form with ID: {}", id);
        intakeFormRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsById(Long id) {
        return intakeFormRepository.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findByPracticeArea(String practiceArea) {
        return intakeFormRepository.findByPracticeArea(practiceArea);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findPublishedFormsByPracticeArea(String practiceArea) {
        return intakeFormRepository.findPublishedFormsByPracticeArea(practiceArea);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findAvailablePracticeAreas() {
        // Return forms grouped by practice area
        return intakeFormRepository.findByPracticeAreas(PRACTICE_AREAS);
    }

    @Override
    public IntakeForm createForm(IntakeForm intakeForm, Long userId) {
        log.info("Creating new intake form: {} by user: {}", intakeForm.getName(), userId);
        
        intakeForm.setCreatedBy(userId);
        intakeForm.setStatus("DRAFT");
        intakeForm.setIsPublic(false);
        
        // Generate unique public URL if not provided
        if (intakeForm.getPublicUrl() == null || intakeForm.getPublicUrl().isEmpty()) {
            intakeForm.setPublicUrl(generateUniquePublicUrl(intakeForm.getName()));
        }
        
        return save(intakeForm);
    }

    @Override
    public IntakeForm updateForm(Long id, IntakeForm intakeForm, Long userId) {
        log.info("Updating intake form ID: {} by user: {}", id, userId);
        
        IntakeForm existing = intakeFormRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeForm not found with ID: " + id));
        
        // Update fields
        existing.setName(intakeForm.getName());
        existing.setDescription(intakeForm.getDescription());
        existing.setFormType(intakeForm.getFormType());
        existing.setPracticeArea(intakeForm.getPracticeArea());
        existing.setFormConfig(intakeForm.getFormConfig());
        existing.setSuccessMessage(intakeForm.getSuccessMessage());
        existing.setRedirectUrl(intakeForm.getRedirectUrl());
        existing.setAutoAssignTo(intakeForm.getAutoAssignTo());
        
        return save(existing);
    }

    @Override
    public IntakeForm publishForm(Long id, Long userId) {
        log.info("Publishing intake form ID: {} by user: {}", id, userId);
        
        IntakeForm form = intakeFormRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeForm not found with ID: " + id));
        
        form.setStatus("PUBLISHED");
        form.setIsPublic(true);
        form.setPublishedAt(new Timestamp(System.currentTimeMillis()));
        
        return save(form);
    }

    @Override
    public IntakeForm unpublishForm(Long id, Long userId) {
        log.info("Unpublishing intake form ID: {} by user: {}", id, userId);
        
        IntakeForm form = intakeFormRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeForm not found with ID: " + id));
        
        form.setStatus("DRAFT");
        form.setIsPublic(false);
        form.setPublishedAt(null);
        
        return save(form);
    }

    @Override
    public IntakeForm duplicateForm(Long id, String newName, Long userId) {
        log.info("Duplicating intake form ID: {} with new name: {} by user: {}", id, newName, userId);
        
        IntakeForm original = intakeFormRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeForm not found with ID: " + id));
        
        IntakeForm duplicate = IntakeForm.builder()
            .name(newName)
            .description(original.getDescription())
            .formType(original.getFormType())
            .practiceArea(original.getPracticeArea())
            .formConfig(original.getFormConfig())
            .successMessage(original.getSuccessMessage())
            .redirectUrl(original.getRedirectUrl())
            .autoAssignTo(original.getAutoAssignTo())
            .createdBy(userId)
            .status("DRAFT")
            .isPublic(false)
            .version(1)
            .publicUrl(generateUniquePublicUrl(newName))
            .build();
        
        return save(duplicate);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findPublicForms() {
        return intakeFormRepository.findPublishedPublicForms();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findByPracticeAreaAndPublic(String practiceArea, boolean isPublic) {
        return intakeFormRepository.findByPracticeAreaAndIsPublic(practiceArea, isPublic);
    }

    @Override
    @Transactional(readOnly = true)
    public IntakeForm findByPublicUrl(String publicUrl) {
        return intakeFormRepository.findByPublicUrl(publicUrl)
            .orElseThrow(() -> new RuntimeException("Form not found with public URL: " + publicUrl));
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findByStatus(String status) {
        return intakeFormRepository.findByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> findByFormType(String formType) {
        return intakeFormRepository.findByFormType(formType);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IntakeForm> findByCreatedBy(Long userId, Pageable pageable) {
        return intakeFormRepository.findByCreatedBy(userId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public long countPublishedByPracticeArea(String practiceArea) {
        return intakeFormRepository.countPublishedByPracticeArea(practiceArea);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeForm> getDefaultFormsForAllPracticeAreas() {
        return intakeFormRepository.findByPracticeAreas(PRACTICE_AREAS);
    }

    @Override
    public IntakeForm updateFormConfiguration(Long id, String formConfig, Long userId) {
        log.info("Updating form configuration for ID: {} by user: {}", id, userId);
        
        IntakeForm form = intakeFormRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeForm not found with ID: " + id));
        
        // Validate form configuration
        if (!validateFormConfiguration(formConfig)) {
            throw new RuntimeException("Invalid form configuration JSON");
        }
        
        form.setFormConfig(formConfig);
        return save(form);
    }

    @Override
    public IntakeForm updateFormSettings(Long id, String successMessage, String redirectUrl, Long userId) {
        log.info("Updating form settings for ID: {} by user: {}", id, userId);
        
        IntakeForm form = intakeFormRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeForm not found with ID: " + id));
        
        form.setSuccessMessage(successMessage);
        form.setRedirectUrl(redirectUrl);
        
        return save(form);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validateFormConfiguration(String formConfig) {
        try {
            JsonNode jsonNode = objectMapper.readTree(formConfig);
            // Basic validation - should have fields array
            return jsonNode.has("fields") || jsonNode.has("sections");
        } catch (Exception e) {
            log.error("Invalid form configuration JSON", e);
            return false;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isPublicUrlAvailable(String publicUrl, Long excludeFormId) {
        Optional<IntakeForm> existing = intakeFormRepository.findByPublicUrl(publicUrl);
        return existing.isEmpty() || (excludeFormId != null && existing.get().getId().equals(excludeFormId));
    }

    @Override
    public IntakeForm findOrCreateGeneralForm() {
        log.info("Finding or creating general intake form");
        
        // Try to find existing general form
        List<IntakeForm> generalForms = intakeFormRepository.findByName("General Consultation Form");
        if (!generalForms.isEmpty()) {
            IntakeForm existingForm = generalForms.get(0);
            log.info("Found existing general form with ID: {}", existingForm.getId());
            return existingForm;
        }
        
        // Create new general form if none exists
        log.info("Creating new general intake form");
        IntakeForm generalForm = IntakeForm.builder()
            .name("General Consultation Form")
            .description("General consultation intake form for all practice areas")
            .practiceArea("Personal Injury") // Use a valid practice area instead of "General"
            .formType("STANDARD")
            .isPublic(true)
            .status("PUBLISHED")
            .publicUrl("general-consultation")
            .successMessage("Thank you for your submission! We will contact you within 24 hours.")
            .formConfig("{\"fields\":[{\"name\":\"firstName\",\"type\":\"text\",\"label\":\"First Name\",\"required\":true},{\"name\":\"lastName\",\"type\":\"text\",\"label\":\"Last Name\",\"required\":true},{\"name\":\"email\",\"type\":\"email\",\"label\":\"Email Address\",\"required\":true},{\"name\":\"phone\",\"type\":\"tel\",\"label\":\"Phone Number\",\"required\":true},{\"name\":\"practiceArea\",\"type\":\"select\",\"label\":\"Practice Area\",\"required\":true},{\"name\":\"urgency\",\"type\":\"select\",\"label\":\"Urgency\",\"required\":true,\"options\":[{\"value\":\"LOW\",\"label\":\"Low\"},{\"value\":\"MEDIUM\",\"label\":\"Medium\"},{\"value\":\"HIGH\",\"label\":\"High\"},{\"value\":\"URGENT\",\"label\":\"Urgent\"}]},{\"name\":\"message\",\"type\":\"textarea\",\"label\":\"Brief Description\",\"required\":true}]}")
            .createdBy(1L) // System user
            .build();
        
        IntakeForm savedForm = save(generalForm);
        log.info("Created general form with ID: {}", savedForm.getId());
        return savedForm;
    }

    @Override
    public IntakeForm findOrCreateFormForPracticeArea(String practiceArea) {
        log.info("Finding or creating intake form for practice area: {}", practiceArea);
        
        // Try to find existing form for this practice area
        List<IntakeForm> existingForms = intakeFormRepository.findByPracticeArea(practiceArea);
        if (!existingForms.isEmpty()) {
            IntakeForm existingForm = existingForms.get(0);
            log.info("Found existing form for {} with ID: {}", practiceArea, existingForm.getId());
            return existingForm;
        }
        
        // Create new form for this practice area if none exists
        log.info("Creating new intake form for practice area: {}", practiceArea);
        String formName = practiceArea + " Consultation Form";
        String publicUrlBase = practiceArea.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        
        IntakeForm practiceAreaForm = IntakeForm.builder()
            .name(formName)
            .description("Consultation intake form for " + practiceArea)
            .practiceArea(practiceArea)
            .formType("STANDARD")
            .isPublic(true)
            .status("PUBLISHED")
            .publicUrl(generateUniquePublicUrl(publicUrlBase))
            .successMessage("Thank you for your " + practiceArea + " consultation request! We will contact you within 24 hours.")
            .formConfig("{\"fields\":[{\"name\":\"firstName\",\"type\":\"text\",\"label\":\"First Name\",\"required\":true},{\"name\":\"lastName\",\"type\":\"text\",\"label\":\"Last Name\",\"required\":true},{\"name\":\"email\",\"type\":\"email\",\"label\":\"Email Address\",\"required\":true},{\"name\":\"phone\",\"type\":\"tel\",\"label\":\"Phone Number\",\"required\":true},{\"name\":\"practiceArea\",\"type\":\"select\",\"label\":\"Practice Area\",\"required\":true},{\"name\":\"urgency\",\"type\":\"select\",\"label\":\"Urgency\",\"required\":true,\"options\":[{\"value\":\"LOW\",\"label\":\"Low\"},{\"value\":\"MEDIUM\",\"label\":\"Medium\"},{\"value\":\"HIGH\",\"label\":\"High\"},{\"value\":\"URGENT\",\"label\":\"Urgent\"}]},{\"name\":\"message\",\"type\":\"textarea\",\"label\":\"Brief Description\",\"required\":true}]}")
            .createdBy(1L) // System user
            .build();
        
        IntakeForm savedForm = save(practiceAreaForm);
        log.info("Created {} form with ID: {}", practiceArea, savedForm.getId());
        return savedForm;
    }

    private String generateUniquePublicUrl(String formName) {
        String baseUrl = formName.toLowerCase()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
        
        String publicUrl = baseUrl;
        int counter = 1;
        
        while (!isPublicUrlAvailable(publicUrl, null)) {
            publicUrl = baseUrl + "-" + counter++;
        }
        
        return publicUrl;
    }
}