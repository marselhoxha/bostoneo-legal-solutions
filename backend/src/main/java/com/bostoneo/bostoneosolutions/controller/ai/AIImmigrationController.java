package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIImmigrationService;
import com.bostoneo.bostoneosolutions.service.AIPDFFormService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/ai/immigration")
@RequiredArgsConstructor
@Slf4j
public class AIImmigrationController {

    private final AIImmigrationService immigrationService;
    private final ClaudeSonnet4Service claudeService;
    private final AIPDFFormService pdfFormService;
    private final AILegalTemplateRepository templateRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @PostMapping("/generate-uscis-form")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateUSCISForm(@RequestBody Map<String, Object> request) {
        log.info("Generating USCIS form with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        // Extract address if nested
        Map<String, Object> address = (Map<String, Object>) request.getOrDefault("currentAddress", new HashMap<>());
        
        String prompt = String.format("""
            Generate a completed USCIS %s form with the following information:
            
            PETITIONER INFORMATION:
            Name: %s %s
            Date of Birth: %s
            Country of Birth: %s
            US Citizen: %s
            Alien Number: %s
            
            BENEFICIARY INFORMATION:
            Name: %s %s  
            Date of Birth: %s
            Country of Birth: %s
            Alien Number: %s
            Relationship: %s
            
            ADDRESS:
            Street: %s
            City: %s
            State: %s
            ZIP: %s
            Country: %s
            
            EMPLOYMENT (if applicable):
            Employer: %s
            Job Title: %s
            Annual Income: %s
            Start Date: %s
            
            Please generate:
            1. Complete form with all sections properly filled
            2. Instructions for any supporting documents needed
            3. Filing fees and addresses
            4. Processing time estimates
            5. Any special considerations or warnings
            
            Format the form according to USCIS standards.
            """,
            request.get("formType"),
            request.get("petitionerFirstName"),
            request.get("petitionerLastName"),
            request.get("petitionerDOB"),
            request.get("petitionerCountryOfBirth"),
            request.get("petitionerUSCitizen"),
            request.get("petitionerAlienNumber"),
            request.get("beneficiaryFirstName"),
            request.get("beneficiaryLastName"),
            request.get("beneficiaryDOB"),
            request.get("beneficiaryCountryOfBirth"),
            request.get("beneficiaryAlienNumber"),
            request.get("beneficiaryRelationship"),
            address.get("street"),
            address.get("city"),
            address.get("state"),
            address.get("zipCode"),
            address.get("country"),
            request.get("employerName"),
            request.get("jobTitle"),
            request.get("annualIncome"),
            request.get("startDate")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("form", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating USCIS form with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate form: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-visa-petition")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateVisaPetition(@RequestBody Map<String, Object> request) {
        log.info("Generating visa petition with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a comprehensive %s visa petition:
            
            PETITIONER:
            Name: %s
            Type: %s
            
            BENEFICIARY:
            Name: %s
            Current Status: %s
            Priority Date: %s
            
            QUALIFICATIONS:
            %s
            
            POSITION/PURPOSE:
            %s
            
            SPECIALIZED KNOWLEDGE (if applicable):
            %s
            
            SUPPORTING EVIDENCE:
            %s
            
            Generate a complete petition including:
            1. Cover letter to USCIS
            2. Detailed petition narrative
            3. Legal arguments supporting eligibility
            4. Evidence checklist
            5. Filing instructions
            6. Premium processing considerations
            
            Follow USCIS requirements and cite relevant regulations.
            """,
            request.get("visaType"),
            request.get("petitionerName"),
            request.get("petitionerType"),
            request.get("beneficiaryName"),
            request.get("previousStatus"),
            request.get("priorityDate"),
            request.get("beneficiaryQualifications"),
            request.get("jobDescription"),
            request.get("specializedKnowledge"),
            request.get("supportingEvidence")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("petition", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating visa petition with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate petition: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/check-case-status")
    public DeferredResult<ResponseEntity<Map<String, Object>>> checkCaseStatus(@RequestBody Map<String, Object> request) {
        log.info("Checking case status with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Analyze immigration case status and provide insights:
            
            Receipt Number: %s
            Case Type: %s
            Filing Date: %s
            Service Center: %s
            Priority Date: %s
            Current Status: %s
            Notes: %s
            
            Provide:
            1. Interpretation of current status
            2. Typical next steps
            3. Estimated timeline to completion
            4. Red flags or concerns
            5. Recommended actions
            6. Historical processing trends for this case type
            7. Potential delays or issues to watch for
            
            Base analysis on current USCIS processing times and patterns.
            """,
            request.get("receiptNumber"),
            request.get("caseType"),
            request.get("filingDate"),
            request.get("serviceCenter"),
            request.get("priorityDate"),
            request.get("currentStatus"),
            request.get("notes")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("analysis", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error checking case status with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to analyze status: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-document-checklist")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateDocumentChecklist(@RequestBody Map<String, Object> request) {
        log.info("Generating document checklist with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a comprehensive document checklist for:
            
            Case Type: %s
            Visa Category: %s
            Application Type: %s
            Include Derivatives: %s
            Number of Derivatives: %s
            
            Create a detailed checklist including:
            1. Primary applicant required documents
            2. Supporting documents
            3. Financial documents
            4. Government forms required
            5. Derivative documents (if applicable)
            6. Translation requirements
            7. Document format specifications
            8. Tips for each document type
            9. Common mistakes to avoid
            10. Order of arrangement for submission
            
            Organize by priority and indicate which are mandatory vs recommended.
            """,
            request.get("caseType"),
            request.get("visaCategory"),
            request.get("applicationType"),
            request.get("includeDerivatives"),
            request.get("numberOfDerivatives")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("checklist", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating document checklist with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate checklist: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/calculate-timeline")
    public DeferredResult<ResponseEntity<Map<String, Object>>> calculateTimeline(@RequestBody Map<String, Object> request) {
        log.info("Calculating case timeline with Claude AI: {}", request);

        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);

        String prompt = String.format("""
            Calculate detailed immigration case timeline:

            Case Type: %s
            Filing Date: %s
            Service Center: %s
            Priority Date: %s
            Current Status: %s
            Premium Processing: %s
            Has RFE: %s
            Country of Origin: %s

            Provide:
            1. Step-by-step timeline with dates
            2. Current processing times at specified service center
            3. Impact of priority date on timeline
            4. Premium processing timeline (if applicable)
            5. RFE impact on timeline
            6. Country-specific considerations
            7. Best case scenario timeline
            8. Worst case scenario timeline
            9. Most likely timeline
            10. Factors that could accelerate or delay

            Base calculations on current USCIS processing data.
            """,
            request.get("caseType"),
            request.get("filingDate"),
            request.get("serviceCenter"),
            request.get("priorityDate"),
            request.get("currentStatus"),
            request.get("premiumProcessing"),
            request.get("hasRFE"),
            request.get("country")
        );

        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("timeline", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error calculating timeline with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to calculate timeline: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);

        return deferredResult;
    }

    @PostMapping("/pdf-forms/{templateId}/fill")
    public ResponseEntity<Map<String, Object>> fillPDFForm(
            @PathVariable Long templateId,
            @RequestBody Map<String, Object> request) {
        log.info("Filling PDF form for template {}: {}", templateId, request);

        try {
            Map<String, Object> caseData = (Map<String, Object>) request.get("caseData");
            if (caseData == null) {
                caseData = request; // Use entire request as case data if not nested
            }

            // Log the data being sent
            log.info("Case data received: {}", caseData);

            // Ensure template exists and is properly configured as PDF_FORM
            ensurePDFTemplateExists(templateId, caseData);

            Map<String, Object> response = pdfFormService.fillPDFForm(templateId, caseData);
            log.info("Successfully filled PDF form: {}", response.get("filledPdfPath"));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error filling PDF form: ", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Failed to fill PDF form: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/pdf-forms/extract-fields")
    public ResponseEntity<Map<String, Object>> extractPDFFields(
            @RequestParam String formType) {
        log.info("Extracting PDF fields for form type: {}", formType);

        try {
            String pdfPath = "uploads/pdf-forms/USCIS_" + formType + ".pdf";
            List<String> fieldNames = pdfFormService.extractPDFFieldNames(pdfPath);

            Map<String, Object> response = new HashMap<>();
            response.put("formType", formType);
            response.put("pdfPath", pdfPath);
            response.put("fieldCount", fieldNames.size());
            response.put("fields", fieldNames);

            log.info("Extracted {} fields from {}", fieldNames.size(), pdfPath);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error extracting PDF fields: ", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Failed to extract PDF fields: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    private void ensurePDFTemplateExists(Long templateId, Map<String, Object> caseData) {
        try {
            Long orgId = getRequiredOrganizationId();
            // Check if template exists and is PDF_FORM type (tenant-filtered)
            Optional<AILegalTemplate> existingTemplate = templateRepository.findByIdAndAccessibleByOrganization(templateId, orgId);

            if (existingTemplate.isEmpty() ||
                (!"PDF_FORM".equals(existingTemplate.get().getTemplateType()) &&
                 !"HYBRID".equals(existingTemplate.get().getTemplateType()))) {

                log.info("Template {} does not exist or is not PDF_FORM type. Creating default template.", templateId);
                createDefaultPDFTemplate(templateId, caseData);
            }
        } catch (Exception e) {
            log.warn("Error checking template existence: {}", e.getMessage());
            // Continue with execution - let pdfFormService handle the error
        }
    }

    private void createDefaultPDFTemplate(Long templateId, Map<String, Object> caseData) {
        Long orgId = getRequiredOrganizationId();
        // Determine form type from case data
        String formType = (String) caseData.getOrDefault("formType", "I-130");
        String formName = "USCIS Form " + formType;

        // Create or update template (tenant-filtered)
        AILegalTemplate template = templateRepository.findByIdAndAccessibleByOrganization(templateId, orgId)
            .orElse(AILegalTemplate.builder().id(templateId).build());

        template.setName(formName);
        template.setDescription("USCIS " + formType + " form for " +
            (formType.equals("I-130") ? "family-based immigration petitions" :
             formType.equals("I-765") ? "employment authorization applications" :
             formType.equals("N-400") ? "naturalization applications" :
             "immigration applications"));
        template.setCategory(TemplateCategory.IMMIGRATION_FORM);
        template.setPracticeArea("Immigration");
        template.setTemplateType("PDF_FORM");
        template.setPdfFormUrl("uploads/pdf-forms/USCIS_" + formType + ".pdf");
        template.setIsPublic(true);
        template.setIsApproved(true);
        template.setOrganizationId(orgId); // Set organization for tenant isolation

        AILegalTemplate savedTemplate = templateRepository.save(template);
        log.info("Created default PDF template for {}: {}", templateId, formName);

        // Create default field mappings for the form
        pdfFormService.createDefaultFieldsForImmigrationForm(savedTemplate.getId(), formType);
        log.info("Created default field mappings for {}", formType);
    }
}