package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.IntakeFormDTO;
import com.bostoneo.bostoneosolutions.dto.email.EmailBranding;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent;
import com.bostoneo.bostoneosolutions.dtomapper.IntakeFormDTOMapper;
import com.bostoneo.bostoneosolutions.model.IntakeForm;
import com.bostoneo.bostoneosolutions.model.IntakeSubmission;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.EmailTemplateEngine;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import com.bostoneo.bostoneosolutions.service.IntakeFormService;
import com.bostoneo.bostoneosolutions.service.IntakeSubmissionService;
import com.bostoneo.bostoneosolutions.service.EmailService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/public/intake-forms")
@RequiredArgsConstructor
@Slf4j
public class IntakeFormResource {

    private final IntakeFormService intakeFormService;
    private final IntakeSubmissionService intakeSubmissionService;
    private final IntakeFormDTOMapper intakeFormDTOMapper;
    private final FileStorageService fileStorageService;
    private final EmailService emailService;
    private final EmailTemplateEngine templateEngine;
    private final OrganizationRepository organizationRepository;

    @Value("${UI_APP_URL:http://localhost:4200}")
    private String frontendUrl;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png", "docx");

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
            response.put("redirectUrl", form.getRedirectUrl());

            // Send confirmation email asynchronously
            sendConfirmationEmail(submissionData, submission.getId(), form);

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

            // Send confirmation email asynchronously
            sendConfirmationEmail(submissionData, submission.getId(), practiceAreaForm);

            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error creating general submission", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "There was an error processing your submission. Please try again."
            ));
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadFile(@RequestParam("file") MultipartFile file) {
        log.info("Receiving file upload: {}, size: {}", file.getOriginalFilename(), file.getSize());

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "File exceeds maximum size of 10MB"
            ));
        }

        // Validate file extension
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        String extension = originalName.contains(".")
            ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase()
            : "";

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "File type not allowed. Accepted: PDF, JPG, PNG, DOCX"
            ));
        }

        try {
            String fileKey = fileStorageService.storeFile(file, "intake-uploads");

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("fileKey", fileKey);
            response.put("fileName", originalName);
            response.put("fileSize", file.getSize());
            response.put("contentType", file.getContentType());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error uploading file", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to upload file. Please try again."
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

    private void sendConfirmationEmail(Map<String, Object> submissionData, Long submissionId, IntakeForm form) {
        try {
            Object emailObj = submissionData.get("email");
            Object firstNameObj = submissionData.get("firstName");

            if (emailObj == null) return;

            String toEmail = emailObj.toString();
            String firstName = firstNameObj != null ? firstNameObj.toString() : "Client";
            String practiceArea = form.getPracticeArea() != null ? form.getPracticeArea() : "Legal";

            // Load organization data for branding
            String orgName = "Our Firm";
            String orgLogoUrl = null;
            String orgPrimaryColor = null;
            String orgEmail = null;
            String orgPhone = null;
            String orgAddress = null;

            if (form.getOrganizationId() != null) {
                Optional<Organization> orgOpt = organizationRepository.findById(form.getOrganizationId());
                if (orgOpt.isPresent()) {
                    Organization org = orgOpt.get();
                    orgName = org.getName() != null ? org.getName() : orgName;
                    orgLogoUrl = org.getLogoUrl();
                    orgPrimaryColor = org.getPrimaryColor();
                    orgEmail = org.getEmail();
                    orgPhone = org.getPhone();
                    orgAddress = org.getAddress();
                }
            }

            String subject = orgName + " - Consultation Request Received (#" + submissionId + ")";

            // Build branding
            EmailBranding branding = EmailBranding.firmClient(
                    orgName, orgLogoUrl, orgPrimaryColor,
                    orgEmail, orgPhone, orgAddress, frontendUrl
            );

            // Build detail card rows
            String submissionDate = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
            List<Map.Entry<String, String>> detailRows = List.of(
                    Map.entry("Practice Area", practiceArea),
                    Map.entry("Submitted", submissionDate),
                    Map.entry("Reference", "#" + submissionId)
            );

            // Build email content
            EmailContent content = EmailContent.builder()
                    .recipientName(firstName)
                    .greeting("Hello " + firstName + ",")
                    .bodyParagraphs(List.of(
                            "Thank you for reaching out. We have received your consultation request and our team will review it shortly."
                    ))
                    .detailCard(EmailContent.DetailCard.builder()
                            .title("Submission Details")
                            .rows(detailRows)
                            .build())
                    .signOffName(orgName)
                    .footerNote("This is an automated confirmation. Your information is protected by attorney-client privilege.")
                    .build();

            String body = templateEngine.render(branding, content);

            emailService.sendEmail(toEmail, subject, body);
            log.info("Confirmation email sent to {} for submission {}", toEmail, submissionId);
        } catch (Exception e) {
            log.warn("Failed to send confirmation email for submission {}: {}", submissionId, e.getMessage());
        }
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