package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.IntakeFormDTO;
import com.bostoneo.bostoneosolutions.dtomapper.IntakeFormDTOMapper;
import com.bostoneo.bostoneosolutions.model.IntakeForm;
import com.bostoneo.bostoneosolutions.model.IntakeSubmission;
import com.bostoneo.bostoneosolutions.service.IntakeFormService;
import com.bostoneo.bostoneosolutions.service.IntakeSubmissionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/public/intake-forms")
@RequiredArgsConstructor
@Slf4j
public class IntakeFormResource {

    private final IntakeFormService intakeFormService;
    private final IntakeSubmissionService intakeSubmissionService;
    private final IntakeFormDTOMapper intakeFormDTOMapper;

    @GetMapping
    public ResponseEntity<List<IntakeFormDTO>> getPublicForms() {
        log.info("Fetching public intake forms");
        
        List<IntakeForm> publicForms = intakeFormService.findPublicForms();
        List<IntakeFormDTO> formDTOs = publicForms.stream()
            .map(intakeFormDTOMapper::toDTO)
            .toList();
        
        return ResponseEntity.ok(formDTOs);
    }

    @GetMapping("/practice-area/{practiceArea}")
    public ResponseEntity<List<IntakeFormDTO>> getFormsByPracticeArea(@PathVariable String practiceArea) {
        log.info("Fetching public forms for practice area: {}", practiceArea);
        
        List<IntakeForm> forms = intakeFormService.findByPracticeAreaAndPublic(practiceArea, true);
        List<IntakeFormDTO> formDTOs = forms.stream()
            .map(intakeFormDTOMapper::toDTO)
            .toList();
        
        return ResponseEntity.ok(formDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IntakeFormDTO> getFormById(@PathVariable Long id) {
        log.info("Fetching intake form with ID: {}", id);
        
        IntakeForm form = intakeFormService.findById(id)
            .orElseThrow(() -> new RuntimeException("Form not found with ID: " + id));
        
        // Only return if public
        if (!Boolean.TRUE.equals(form.getIsPublic())) {
            throw new RuntimeException("Form is not publicly available");
        }
        
        IntakeFormDTO formDTO = intakeFormDTOMapper.toDTO(form);
        return ResponseEntity.ok(formDTO);
    }

    @GetMapping("/url/{publicUrl}")
    public ResponseEntity<IntakeFormDTO> getFormByPublicUrl(@PathVariable String publicUrl) {
        log.info("Fetching intake form with public URL: {}", publicUrl);
        
        IntakeForm form = intakeFormService.findByPublicUrl(publicUrl);
        if (form == null || !Boolean.TRUE.equals(form.getIsPublic())) {
            throw new RuntimeException("Form not found or not publicly available");
        }
        
        IntakeFormDTO formDTO = intakeFormDTOMapper.toDTO(form);
        return ResponseEntity.ok(formDTO);
    }

    @PostMapping("/{formId}/submit")
    public ResponseEntity<Map<String, Object>> submitForm(
            @PathVariable Long formId,
            @RequestBody @Valid Map<String, Object> submissionData,
            HttpServletRequest request) {
        
        log.info("Receiving form submission for form ID: {}", formId);
        
        // Verify form exists and is public
        IntakeForm form = intakeFormService.findById(formId)
            .orElseThrow(() -> new RuntimeException("Form not found with ID: " + formId));
        
        if (!Boolean.TRUE.equals(form.getIsPublic())) {
            throw new RuntimeException("Form is not accepting public submissions");
        }
        
        // Extract request information
        String ipAddress = getClientIpAddress(request);
        String userAgent = request.getHeader("User-Agent");
        String referrer = request.getHeader("Referer");
        
        try {
            // Create submission
            IntakeSubmission submission = intakeSubmissionService.createSubmission(
                formId, 
                objectMapperToJson(submissionData), 
                ipAddress, 
                userAgent, 
                referrer
            );
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", form.getSuccessMessage() != null ? form.getSuccessMessage() : "Thank you for your submission!");
            response.put("submissionId", submission.getId());
            response.put("redirectUrl", form.getRedirectUrl()); // This can be null
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error creating submission for form {}", formId, e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "There was an error processing your submission. Please try again."
            ));
        }
    }

    @GetMapping("/practice-areas")
    public ResponseEntity<List<String>> getAvailablePracticeAreas() {
        log.info("Fetching available practice areas");
        
        List<String> practiceAreas = List.of(
            "Personal Injury",
            "Family Law", 
            "Criminal Defense",
            "Business Law",
            "Real Estate Law",
            "Immigration Law"
        );
        
        return ResponseEntity.ok(practiceAreas);
    }

    @PostMapping("/url/{publicUrl}/submit")
    public ResponseEntity<Map<String, Object>> submitFormByUrl(
            @PathVariable String publicUrl,
            @RequestBody @Valid Map<String, Object> submissionData,
            HttpServletRequest request) {
        
        log.info("Receiving form submission for public URL: {}", publicUrl);
        
        // Find form by public URL
        IntakeForm form = intakeFormService.findByPublicUrl(publicUrl);
        if (form == null || !Boolean.TRUE.equals(form.getIsPublic())) {
            throw new RuntimeException("Form not found or not accepting submissions");
        }
        
        // Delegate to the ID-based submission method
        return submitForm(form.getId(), submissionData, request);
    }

    @PostMapping("/submit-general")
    public ResponseEntity<Map<String, Object>> submitGeneralForm(
            @RequestBody @Valid Map<String, Object> submissionData,
            HttpServletRequest request) {
        
        log.info("Receiving general form submission");
        
        // Extract request information
        String ipAddress = getClientIpAddress(request);
        String userAgent = request.getHeader("User-Agent");
        String referrer = request.getHeader("Referer");
        
        try {
            // Extract practice area from submission data
            String practiceArea = submissionData.get("practiceArea") != null ? 
                submissionData.get("practiceArea").toString() : "Personal Injury"; // default fallback
            
            log.info("Processing submission for practice area: {}", practiceArea);
            
            // Find or create intake form for the specific practice area
            IntakeForm practiceAreaForm = intakeFormService.findOrCreateFormForPracticeArea(practiceArea);
            
            // Create submission using the practice area form ID
            IntakeSubmission submission = intakeSubmissionService.createSubmission(
                practiceAreaForm.getId(),
                objectMapperToJson(submissionData), 
                ipAddress, 
                userAgent, 
                referrer
            );
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Thank you for your submission! We will contact you within 24 hours.");
            response.put("submissionId", submission.getId());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error creating general submission", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "There was an error processing your submission. Please try again."
            ));
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }

    private String objectMapperToJson(Map<String, Object> data) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.writeValueAsString(data);
        } catch (Exception e) {
            log.error("Error converting submission data to JSON", e);
            return "{}";
        }
    }
}