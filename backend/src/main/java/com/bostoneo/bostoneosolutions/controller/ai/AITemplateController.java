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
import com.bostoneo.bostoneosolutions.service.ai.importing.HtmlToDocxConverter;
import com.bostoneo.bostoneosolutions.service.ai.importing.LibreOfficeConverterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY', 'ROLE_PARALEGAL', 'ROLE_ASSOCIATE')")
@RestController
@RequestMapping("/api/ai/templates")
@RequiredArgsConstructor
@Slf4j
public class AITemplateController {

    private final AITemplateService templateService;
    private final AITemplateVariableRepository variableRepository;
    private final TenantService tenantService;
    private final HtmlToDocxConverter htmlToDocxConverter;
    private final LibreOfficeConverterService libreOfficeConverter;

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
     * POST /api/ai/templates/{id}/generate - Generate document from template (legacy text path).
     *
     * <p><b>HYBRID templates:</b> if {@code template.hasBinaryTemplate == true} the attorney
     * almost certainly wants {@link #renderBinary(Long, Map)} instead — this endpoint still
     * works and returns the extracted text as HTML, but it silently loses the visual fidelity
     * of the uploaded DOCX/PDF. Prefer {@code /render-binary} for imported templates.
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
     * POST /api/ai/templates/{id}/render-binary - Sprint 1.6 visual-fidelity render path.
     *
     * <p>Swaps every {@code {{key}}} token in the cached DOCX/PDF binary for the attorney's
     * value and streams the resulting bytes back with the correct Content-Type so the browser
     * can download the file or hand it to {@code docx-preview}/PDF.js for in-browser preview.
     *
     * <p>Response codes:
     * <ul>
     *   <li>200 — bytes streamed; {@code Content-Type} is DOCX or PDF; {@code Content-Disposition}
     *       is {@code attachment} with a filename derived from the template name.</li>
     *   <li>404 — template not found, access denied, or tenant mismatch.</li>
     *   <li>422 — template is text-only ({@code hasBinaryTemplate=false}); caller should use
     *       {@code /generate} instead.</li>
     *   <li>500 — render pipeline failed (corrupt binary, iText/POI error).</li>
     * </ul>
     */
    @PostMapping("/{id}/render-binary")
    public ResponseEntity<byte[]> renderBinary(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> values) {
        try {
            AITemplateService.RenderedBinary rendered =
                templateService.renderBinaryTemplate(id, values == null ? Map.of() : values);

            MediaType mediaType = "DOCX".equalsIgnoreCase(rendered.format())
                ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                : MediaType.APPLICATION_PDF;

            String extension = "DOCX".equalsIgnoreCase(rendered.format()) ? ".docx" : ".pdf";
            String filename = encodeContentDispositionName(rendered.templateName() + extension);

            return ResponseEntity.ok()
                .contentType(mediaType)
                .header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(rendered.bytes());
        } catch (IllegalStateException e) {
            // Template exists but has no binary copy — caller should use /generate instead.
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).build();
        } catch (RuntimeException e) {
            // Covers "not found / access denied" thrown from getTemplateById.
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * RFC 5987-safe filename encoding so a template named "Letter — résumé" doesn't break the
     * Content-Disposition header. Strips quotes + CR/LF (header-injection vectors), then
     * URL-encodes the result using UTF-8 with space → %20.
     */
    private String encodeContentDispositionName(String raw) {
        String safe = raw == null ? "template" : raw;
        safe = safe.replace("\"", "").replace("\r", "").replace("\n", "");
        return URLEncoder.encode(safe, StandardCharsets.UTF_8).replace("+", "%20");
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
     * PUT /api/ai/templates/{id} - Update existing template.
     *
     * <p>Path-C round-trip: when the attorney edits in CKEditor and saves, we
     * (a) update {@code templateContent} (the HTML body — used for editing + draft fill),
     * (b) regenerate {@code templateBinary} via docx4j HTML→DOCX so "Download as DOCX"
     *     stays in sync with the edited HTML,
     * (c) mark {@code renderedPdfStale=true} so the next preview / PDF download
     *     re-renders via LibreOffice.
     *
     * <p>If docx4j round-trip fails, we keep the previous {@code templateBinary}
     * untouched and let the request succeed — the edited HTML is preserved either way.
     */
    @PutMapping("/{id}")
    public ResponseEntity<AILegalTemplate> updateTemplate(
            @PathVariable Long id,
            @RequestBody AILegalTemplate template) {
        try {
            // If the body content changed, try to regenerate the canonical DOCX bytes.
            // We don't compare to the existing record's content here (the service does that);
            // a best-effort regeneration is fine — failure leaves prior binary in place.
            if (template.getTemplateContent() != null && !template.getTemplateContent().isBlank()) {
                byte[] regenerated = htmlToDocxConverter.convert(template.getTemplateContent());
                if (regenerated != null && regenerated.length > 0) {
                    template.setTemplateBinary(regenerated);
                    template.setTemplateBinaryFormat("DOCX");
                    template.setHasBinaryTemplate(true);
                    template.setRenderedPdfStale(true);  // invalidate PDF cache
                }
            }
            AILegalTemplate updated = templateService.updateTemplate(id, template);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/{id}/download/docx - Stream the canonical tokenized DOCX
     * to the browser as a download. Always available because Path-C templates always
     * have {@code templateBinary} populated (DOCX format).
     */
    @GetMapping("/{id}/download/docx")
    public ResponseEntity<byte[]> downloadDocx(@PathVariable Long id) {
        try {
            AILegalTemplate t = templateService.getTemplate(id, getRequiredOrganizationId());
            if (t == null || t.getTemplateBinary() == null || t.getTemplateBinary().length == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            String filename = sanitizeFilename(t.getName()) + ".docx";
            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + filename + "\"")
                .body(t.getTemplateBinary());
        } catch (Exception e) {
            log.error("Download DOCX failed for template {}: {}", id, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/ai/templates/{id}/download/pdf - Stream the rendered PDF (DOCX→PDF via
     * LibreOffice). Regenerates from {@code templateBinary} if the cache is stale or empty.
     */
    @GetMapping("/{id}/download/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long id) {
        try {
            AILegalTemplate t = templateService.getTemplate(id, getRequiredOrganizationId());
            if (t == null || t.getTemplateBinary() == null || t.getTemplateBinary().length == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            byte[] pdf = t.getRenderedPdfBinary();
            boolean stale = Boolean.TRUE.equals(t.getRenderedPdfStale());
            if (pdf == null || pdf.length == 0 || stale) {
                if (!libreOfficeConverter.isEnabled()) {
                    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(("PDF rendering is unavailable on this server "
                            + "(LibreOffice not configured)").getBytes(StandardCharsets.UTF_8));
                }
                pdf = libreOfficeConverter.renderToPdf(t.getTemplateBinary());
                // Persist the freshly-rendered PDF back so subsequent calls hit the cache.
                t.setRenderedPdfBinary(pdf);
                t.setRenderedPdfStale(false);
                templateService.persistRenderedPdf(t.getId(), pdf);
            }
            String filename = sanitizeFilename(t.getName()) + ".pdf";
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + filename + "\"")
                .body(pdf);
        } catch (Exception e) {
            log.error("Download PDF failed for template {}: {}", id, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private String sanitizeFilename(String name) {
        if (name == null || name.isBlank()) return "template";
        return name.replaceAll("[^A-Za-z0-9._-]+", "_");
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
        // Map.of() caps at 10 entries — use ofEntries to include Sprint 1.5 import metadata
        // plus Sprint 1.6 binary signal (so the library "VISUAL" chip renders on search hits too).
        return Map.ofEntries(
            Map.entry("id", template.getId()),
            Map.entry("name", template.getName()),
            Map.entry("category", template.getCategory()),
            Map.entry("practiceArea", template.getPracticeArea() != null ? template.getPracticeArea() : ""),
            Map.entry("jurisdiction", template.getJurisdiction() != null ? template.getJurisdiction() : ""),
            Map.entry("description", template.getDescription() != null ? template.getDescription() : ""),
            Map.entry("usageCount", template.getUsageCount() != null ? template.getUsageCount() : 0),
            Map.entry("isApproved", template.getIsApproved() != null ? template.getIsApproved() : false),
            Map.entry("sourceType", template.getSourceType() != null ? template.getSourceType() : "MANUAL"),
            Map.entry("sourceFilename", template.getSourceFilename() != null ? template.getSourceFilename() : ""),
            Map.entry("isPrivate", Boolean.TRUE.equals(template.getIsPrivate())),
            Map.entry("hasBinaryTemplate", Boolean.TRUE.equals(template.getHasBinaryTemplate())),
            Map.entry("templateBinaryFormat", template.getTemplateBinaryFormat() != null ? template.getTemplateBinaryFormat() : "")
        );
    }
}