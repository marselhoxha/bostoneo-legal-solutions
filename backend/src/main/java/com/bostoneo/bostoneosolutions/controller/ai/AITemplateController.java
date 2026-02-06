package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.TemplateGenerationRequest;
import com.bostoneo.bostoneosolutions.dto.TemplateGenerationResponse;
import com.bostoneo.bostoneosolutions.enumeration.DocumentContextType;
import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AITemplateVariableRepository;
import com.bostoneo.bostoneosolutions.service.AITemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai/templates")
@RequiredArgsConstructor
public class AITemplateController {

    private final AITemplateService templateService;
    private final AITemplateVariableRepository variableRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * GET /api/ai/templates/categories - Get all template categories
     */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> getTemplateCategories() {
        List<String> categories = Arrays.stream(TemplateCategory.values())
                .map(Enum::name)
                .collect(Collectors.toList());
        return ResponseEntity.ok(categories);
    }

    /**
     * GET /api/ai/templates/search - Search templates with query parameters
     */
    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> searchTemplates(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String practiceArea,
            @RequestParam(required = false) String jurisdiction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        try {
            if (q != null && !q.trim().isEmpty()) {
                // Use the search method from service for text search
                List<Map<String, Object>> results = templateService.searchTemplates(q.trim());
                return ResponseEntity.ok(results);
            } else {
                // Filter-based search
                List<AILegalTemplate> templates = templateService.getAllTemplates();
                
                if (category != null && !category.trim().isEmpty()) {
                    templates = templates.stream()
                            .filter(t -> t.getCategory().name().equalsIgnoreCase(category))
                            .collect(Collectors.toList());
                }
                
                if (practiceArea != null && !practiceArea.trim().isEmpty()) {
                    templates = templates.stream()
                            .filter(t -> t.getPracticeArea() != null && 
                                    t.getPracticeArea().toLowerCase().contains(practiceArea.toLowerCase()))
                            .collect(Collectors.toList());
                }
                
                if (jurisdiction != null && !jurisdiction.trim().isEmpty()) {
                    templates = templates.stream()
                            .filter(t -> t.getJurisdiction() != null && 
                                    t.getJurisdiction().toLowerCase().contains(jurisdiction.toLowerCase()))
                            .collect(Collectors.toList());
                }
                
                // Convert to map format for consistency
                List<Map<String, Object>> results = templates.stream()
                        .skip((long) page * size)
                        .limit(size)
                        .map(this::convertToSearchResult)
                        .collect(Collectors.toList());
                        
                return ResponseEntity.ok(results);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/{id} - Get single template
     */
    @GetMapping("/{id}")
    public ResponseEntity<AILegalTemplate> getTemplate(@PathVariable Long id) {
        try {
            AILegalTemplate template = templateService.getTemplateById(id);
            return ResponseEntity.ok(template);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/{id}/variables - Get template variables
     */
    @GetMapping("/{id}/variables")
    public ResponseEntity<List<AITemplateVariable>> getTemplateVariables(@PathVariable Long id) {
        try {
            // First verify the template exists
            templateService.getTemplateById(id);
            
            List<AITemplateVariable> variables = variableRepository.findByTemplateIdOrderByDisplayOrder(id);
            return ResponseEntity.ok(variables);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Additional endpoints for comprehensive template management
     */
    
    /**
     * GET /api/ai/templates - Get all templates with pagination
     */
    @GetMapping
    public ResponseEntity<List<AILegalTemplate>> getAllTemplates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<AILegalTemplate> templates = templateService.getAllTemplates();
            List<AILegalTemplate> pagedTemplates = templates.stream()
                    .skip((long) page * size)
                    .limit(size)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(pagedTemplates);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/category/{category} - Get templates by category
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<AILegalTemplate>> getTemplatesByCategory(@PathVariable String category) {
        try {
            List<AILegalTemplate> templates = templateService.getTemplatesByCategory(category);
            return ResponseEntity.ok(templates);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/templates/{id}/generate - Generate document from template (legacy endpoint)
     */
    @PostMapping("/{id}/generate")
    public ResponseEntity<Map<String, Object>> generateFromTemplate(
            @PathVariable Long id,
            @RequestBody Map<String, String> userInputs) {
        try {
            String generatedContent = templateService.generateFromTemplate(id, userInputs);

            Map<String, Object> response = Map.of(
                "templateId", id,
                "content", generatedContent,
                "generatedAt", java.time.LocalDateTime.now()
            );

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/templates/generate-flexible - Flexible document generation with context
     */
    @PostMapping("/generate-flexible")
    public ResponseEntity<TemplateGenerationResponse> generateWithContext(
            @RequestBody TemplateGenerationRequest request) {
        try {
            TemplateGenerationResponse response = templateService.generateWithContext(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/context-types - Get available context types
     */
    @GetMapping("/context-types")
    public ResponseEntity<List<Map<String, String>>> getContextTypes() {
        List<Map<String, String>> contextTypes = Arrays.stream(DocumentContextType.values())
                .map(type -> Map.of(
                    "value", type.name(),
                    "label", type.name().replace("_", " "),
                    "description", type.getDescription()
                ))
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(contextTypes);
    }

    /**
     * POST /api/ai/templates/{id}/suggest-values - Get AI suggestions for template variables
     */
    @PostMapping("/{id}/suggest-values")
    public ResponseEntity<Map<String, Object>> suggestVariableValues(
            @PathVariable Long id,
            @RequestBody Map<String, Object> context) {
        try {
            Map<String, Object> suggestions = templateService.suggestVariableValues(id, context);
            return ResponseEntity.ok(suggestions);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/{id}/analyze - Analyze template
     */
    @GetMapping("/{id}/analyze")
    public ResponseEntity<Map<String, Object>> analyzeTemplate(@PathVariable Long id) {
        try {
            Map<String, Object> analysis = templateService.analyzeTemplate(id);
            return ResponseEntity.ok(analysis);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/templates - Create new template
     */
    @PostMapping
    public ResponseEntity<AILegalTemplate> createTemplate(@RequestBody AILegalTemplate template) {
        try {
            // Set default values if not provided
            if (template.getUsageCount() == null) {
                template.setUsageCount(0);
            }
            if (template.getIsPublic() == null) {
                template.setIsPublic(false);
            }
            if (template.getIsApproved() == null) {
                template.setIsApproved(false);
            }

            AILegalTemplate created = templateService.createTemplate(template);
            return ResponseEntity.ok(created);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * PUT /api/ai/templates/{id} - Update existing template
     */
    @PutMapping("/{id}")
    public ResponseEntity<AILegalTemplate> updateTemplate(
            @PathVariable Long id,
            @RequestBody AILegalTemplate template) {
        try {
            AILegalTemplate updated = templateService.updateTemplate(id, template);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * DELETE /api/ai/templates/{id} - Delete template
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteTemplate(@PathVariable Long id) {
        try {
            templateService.deleteTemplate(id);
            return ResponseEntity.ok(Map.of(
                "message", "Template deleted successfully",
                "id", id.toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/{id}/validate - Validate template
     */
    @GetMapping("/{id}/validate")
    public ResponseEntity<Map<String, Object>> validateTemplate(@PathVariable Long id) {
        try {
            List<String> errors = templateService.validateTemplate(id);
            return ResponseEntity.ok(Map.of(
                "isValid", errors.isEmpty(),
                "errors", errors
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/ai/templates/{id}/duplicate - Duplicate a template
     */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<AILegalTemplate> duplicateTemplate(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            AILegalTemplate original = templateService.getTemplateById(id);
            AILegalTemplate duplicate = AILegalTemplate.builder()
                    .name(request.getOrDefault("name", "Copy of " + original.getName()))
                    .description(original.getDescription())
                    .category(original.getCategory())
                    .practiceArea(original.getPracticeArea())
                    .jurisdiction(original.getJurisdiction())
                    .maJurisdictionSpecific(original.getMaJurisdictionSpecific())
                    .documentType(original.getDocumentType())
                    .templateContent(original.getTemplateContent())
                    .templateType(original.getTemplateType())
                    .aiPromptStructure(original.getAiPromptStructure())
                    .variableMappings(original.getVariableMappings())
                    .formattingRules(original.getFormattingRules())
                    .styleGuideId(original.getStyleGuideId())
                    .usageCount(0)
                    .isPublic(false)
                    .isApproved(false)
                    .build();

            AILegalTemplate created = templateService.createTemplate(duplicate);
            return ResponseEntity.ok(created);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/pdf-forms - Get all PDF form templates
     */
    @GetMapping("/pdf-forms")
    public ResponseEntity<List<AILegalTemplate>> getPDFFormTemplates() {
        try {
            List<AILegalTemplate> templates = templateService.getAllTemplates().stream()
                    .filter(t -> "PDF_FORM".equals(t.getTemplateType()))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(templates);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Helper method to convert template to search result format
     */
    private Map<String, Object> convertToSearchResult(AILegalTemplate template) {
        return Map.of(
            "id", template.getId(),
            "name", template.getName(),
            "category", template.getCategory(),
            "practiceArea", template.getPracticeArea() != null ? template.getPracticeArea() : "",
            "jurisdiction", template.getJurisdiction() != null ? template.getJurisdiction() : "",
            "description", template.getDescription() != null ? template.getDescription() : "",
            "usageCount", template.getUsageCount() != null ? template.getUsageCount() : 0,
            "isApproved", template.getIsApproved() != null ? template.getIsApproved() : false
        );
    }
}