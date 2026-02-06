package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.AIPDFFormField;
import com.bostoneo.bostoneosolutions.service.AIPDFFormService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/pdf-forms")
public class AIPDFFormController {

    private final AIPDFFormService pdfFormService;

    public AIPDFFormController(AIPDFFormService pdfFormService) {
        this.pdfFormService = pdfFormService;
    }

    /**
     * GET /api/ai/pdf-forms/templates - Get available PDF form templates
     */
    @GetMapping("/templates")
    public ResponseEntity<List<Map<String, Object>>> getTemplates() {
        try {
            List<Map<String, Object>> templates = pdfFormService.getAvailableTemplates();
            return ResponseEntity.ok(templates);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/pdf-forms/{templateId}/fields - Get PDF form fields for a template
     */
    @GetMapping("/{templateId}/fields")
    public ResponseEntity<List<AIPDFFormField>> getFormFields(@PathVariable Long templateId) {
        try {
            List<AIPDFFormField> fields = pdfFormService.getFormFields(templateId);
            return ResponseEntity.ok(fields);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/pdf-forms/{templateId}/fill - Fill PDF form with case data
     */
    @PostMapping("/{templateId}/fill")
    public ResponseEntity<Map<String, Object>> fillPDFForm(
            @PathVariable Long templateId,
            @RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> caseData = (Map<String, Object>) request.get("caseData");
            Map<String, Object> result = pdfFormService.fillPDFForm(templateId, caseData);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/pdf-forms/{templateId}/fields - Create or update form fields
     */
    @PostMapping("/{templateId}/fields")
    public ResponseEntity<List<AIPDFFormField>> createFormFields(
            @PathVariable Long templateId,
            @RequestBody List<AIPDFFormField> fields) {
        try {
            List<AIPDFFormField> createdFields = pdfFormService.createFormFieldsForTemplate(templateId, fields);
            return ResponseEntity.ok(createdFields);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * DELETE /api/ai/pdf-forms/{templateId}/fields - Delete form fields for a template
     */
    @DeleteMapping("/{templateId}/fields")
    public ResponseEntity<Void> deleteFormFields(@PathVariable Long templateId) {
        try {
            pdfFormService.deleteFormFieldsForTemplate(templateId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/pdf-forms/{templateId}/fields/default - Create default fields for form type
     */
    @PostMapping("/{templateId}/fields/default")
    public ResponseEntity<Map<String, String>> createDefaultFields(
            @PathVariable Long templateId,
            @RequestBody Map<String, String> request) {
        try {
            String formType = request.get("formType");
            pdfFormService.createDefaultFieldsForImmigrationForm(templateId, formType);
            return ResponseEntity.ok(Map.of("message", "Default fields created successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}