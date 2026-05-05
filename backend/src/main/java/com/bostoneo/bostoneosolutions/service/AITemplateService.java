package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.TemplateGenerationRequest;
import com.bostoneo.bostoneosolutions.dto.TemplateGenerationResponse;
import com.bostoneo.bostoneosolutions.enumeration.DocumentContextType;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.ai.AIService;
import com.bostoneo.bostoneosolutions.service.ai.importing.BinaryTemplateRenderer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class AITemplateService {

    @Autowired
    private AILegalTemplateRepository templateRepository;
    
    @Autowired
    private AITemplateVariableRepository variableRepository;
    
    @Autowired
    private AIStyleGuideRepository styleGuideRepository;

    @Autowired
    private TenantService tenantService;

    @Autowired
    private AIService aiService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BinaryTemplateRenderer binaryTemplateRenderer;

    @Autowired
    private LegalCaseRepository legalCaseRepository;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Current user id, or -1 when unauthenticated (no private templates will match).
     * Kept non-throwing because some callers (scheduled jobs, system contexts) may not have a principal.
     */
    private Long getCurrentUserIdOrSentinel() {
        return tenantService.getCurrentUserId().orElse(-1L);
    }

    /**
     * Get all templates accessible to the current organization (own + public approved),
     * with privacy scoping: private templates are only visible to the user who imported them.
     */
    public List<AILegalTemplate> getAllTemplates() {
        Long orgId = getRequiredOrganizationId();
        Long userId = getCurrentUserIdOrSentinel();
        return templateRepository.findAccessibleByOrganizationAndUser(orgId, userId);
    }

    public List<AILegalTemplate> getTemplatesByCategory(String category) {
        return getAllTemplates().stream()
            .filter(t -> t.getCategory().toString().equalsIgnoreCase(category))
            .collect(Collectors.toList());
    }

    public List<AILegalTemplate> getTemplatesByJurisdiction(String jurisdiction) {
        return getAllTemplates().stream()
            .filter(t -> t.getJurisdiction().equalsIgnoreCase(jurisdiction))
            .collect(Collectors.toList());
    }

    public AILegalTemplate getTemplateById(Long id) {
        Long orgId = getRequiredOrganizationId();
        Long userId = getCurrentUserIdOrSentinel();
        // SECURITY: Use tenant-filtered query (own + public approved), with privacy scoping for imported templates
        return templateRepository.findByIdAndAccessibleByOrganizationAndUser(id, orgId, userId)
            .orElseThrow(() -> new RuntimeException("Template not found or access denied: " + id));
    }

    public AILegalTemplate createTemplate(AILegalTemplate template) {
        Long orgId = getRequiredOrganizationId();
        template.setOrganizationId(orgId); // SECURITY: Set organization ID
        template.setCreatedAt(LocalDateTime.now());
        template.setUpdatedAt(LocalDateTime.now());

        AILegalTemplate savedTemplate = templateRepository.save(template);
        
        if (template.getVariableMappings() != null) {
            extractAndSaveVariables(savedTemplate);
        }
        
        return savedTemplate;
    }

    public AILegalTemplate updateTemplate(Long id, AILegalTemplate templateUpdate) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Only allow updating own templates (not public ones)
        AILegalTemplate existingTemplate = templateRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Template not found or access denied for update: " + id));

        existingTemplate.setName(templateUpdate.getName());
        existingTemplate.setCategory(templateUpdate.getCategory());
        existingTemplate.setJurisdiction(templateUpdate.getJurisdiction());
        existingTemplate.setAiPromptStructure(templateUpdate.getAiPromptStructure());
        existingTemplate.setVariableMappings(templateUpdate.getVariableMappings());
        existingTemplate.setTemplateContent(templateUpdate.getTemplateContent());
        existingTemplate.setIsApproved(templateUpdate.getIsApproved());
        existingTemplate.setUpdatedAt(LocalDateTime.now());

        // Path-C round-trip: when the controller regenerated templateBinary from edited HTML,
        // adopt the new bytes here AND mark the rendered PDF cache stale so the next preview
        // regenerates. Otherwise leave templateBinary untouched (controller decided not to /
        // could not regenerate; previous binary is still the best available).
        if (templateUpdate.getTemplateBinary() != null && templateUpdate.getTemplateBinary().length > 0) {
            existingTemplate.setTemplateBinary(templateUpdate.getTemplateBinary());
            existingTemplate.setTemplateBinaryFormat(
                templateUpdate.getTemplateBinaryFormat() != null
                    ? templateUpdate.getTemplateBinaryFormat()
                    : "DOCX"
            );
            existingTemplate.setHasBinaryTemplate(true);
            existingTemplate.setRenderedPdfStale(true);
        }

        if (templateUpdate.getStyleGuideId() != null) {
            existingTemplate.setStyleGuideId(templateUpdate.getStyleGuideId());
        }

        AILegalTemplate savedTemplate = templateRepository.save(existingTemplate);
        
        // variableRepository.deleteByTemplateId(id);
        if (templateUpdate.getVariableMappings() != null) {
            extractAndSaveVariables(savedTemplate);
        }
        
        return savedTemplate;
    }

    /**
     * Path-C: tenant-scoped template lookup used by the download endpoints. Same security
     * semantics as {@link #getTemplateById}, but takes the org id explicitly so the
     * controller can pass it without re-resolving from the security context.
     */
    public AILegalTemplate getTemplate(Long id, Long organizationId) {
        Long userId = getCurrentUserIdOrSentinel();
        return templateRepository.findByIdAndAccessibleByOrganizationAndUser(id, organizationId, userId)
            .orElse(null);
    }

    /**
     * Path-C: persist a freshly-rendered PDF after a cache miss / staleness regeneration.
     * Used by the {@code /download/pdf} endpoint so subsequent calls hit the cache.
     */
    @org.springframework.transaction.annotation.Transactional
    public void persistRenderedPdf(Long id, byte[] pdfBytes) {
        templateRepository.findById(id).ifPresent(t -> {
            t.setRenderedPdfBinary(pdfBytes);
            t.setRenderedPdfStale(false);
            templateRepository.save(t);
        });
    }

    public void deleteTemplate(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before deletion
        if (!templateRepository.existsByIdAndOrganizationId(id, orgId)) {
            throw new RuntimeException("Template not found or access denied for deletion: " + id);
        }
        // variableRepository.deleteByTemplateId(id);
        templateRepository.deleteById(id);
    }

    public Map<String, Object> autoFillTemplate(Long templateId, Long caseId) {
        AILegalTemplate template = getTemplateById(templateId);
        // SECURITY: Use findByTemplateId instead of findAll to avoid cross-tenant data access
        List<AITemplateVariable> variables = variableRepository.findByTemplateId(templateId);
        
        Map<String, Object> filledData = new HashMap<>();
        filledData.put("templateId", templateId);
        filledData.put("templateName", template.getName());
        
        Map<String, String> variableValues = new HashMap<>();
        for (AITemplateVariable variable : variables) {
            String value = fetchVariableValue(variable, caseId);
            variableValues.put(variable.getVariableName(), value);
        }
        
        String filledContent = fillTemplateContent(template.getTemplateContent(), variableValues);
        
        if (template.getStyleGuideId() != null) {
            filledContent = applyStyleGuide(filledContent, template.getStyleGuideId());
        }
        
        filledData.put("content", filledContent);
        filledData.put("variables", variableValues);
        filledData.put("generatedAt", LocalDateTime.now());
        
        return filledData;
    }

    public String generateFromTemplate(Long templateId, Map<String, String> userInputs) {
        AILegalTemplate template = getTemplateById(templateId);

        String content = fillTemplateContent(template.getTemplateContent(), userInputs);

        if (template.getAiPromptStructure() != null && !template.getAiPromptStructure().isEmpty()) {
            content = enhanceWithAI(content, template.getAiPromptStructure(), userInputs);
        }

        if (template.getStyleGuideId() != null) {
            content = applyStyleGuide(content, template.getStyleGuideId());
        }

        return content;
    }

    /**
     * Binary-path counterpart to {@link #generateFromTemplate(Long, Map)}: when the template
     * was imported with visual fidelity (Sprint 1.6), return the rendered DOCX/PDF bytes
     * instead of an HTML string. The caller (controller) sets the appropriate Content-Type.
     *
     * <p>Tenant + privacy scoping is inherited from {@link #getTemplateById(Long)}.
     */
    public RenderedBinary renderBinaryTemplate(Long templateId, Map<String, String> values) {
        AILegalTemplate template = getTemplateById(templateId);
        if (!Boolean.TRUE.equals(template.getHasBinaryTemplate())) {
            throw new IllegalStateException("Template has no binary copy: " + templateId);
        }
        byte[] bytes = template.getTemplateBinary();
        if (bytes == null || bytes.length == 0) {
            throw new IllegalStateException("Template binary is empty or not loaded: " + templateId);
        }
        String format = template.getTemplateBinaryFormat();
        byte[] rendered = binaryTemplateRenderer.render(bytes, format, values);
        return new RenderedBinary(rendered, format, template.getName());
    }

    /** Result of {@link #renderBinaryTemplate(Long, Map)} — carries enough to stream a download. */
    public record RenderedBinary(byte[] bytes, String format, String templateName) {}

    public List<String> validateTemplate(Long templateId) {
        AILegalTemplate template = getTemplateById(templateId);
        List<String> errors = new ArrayList<>();
        
        if (template.getTemplateContent() == null || template.getTemplateContent().isEmpty()) {
            errors.add("Template content is empty");
        }
        
        Set<String> contentVariables = extractVariables(template.getTemplateContent());
        // SECURITY: Use findByTemplateId instead of findAll to avoid cross-tenant data access
        List<AITemplateVariable> definedVariables = variableRepository.findByTemplateId(templateId);
        Set<String> definedVariableNames = definedVariables.stream()
            .map(AITemplateVariable::getVariableName)
            .collect(Collectors.toSet());
        
        for (String var : contentVariables) {
            if (!definedVariableNames.contains(var)) {
                errors.add("Undefined variable in template: " + var);
            }
        }
        
        for (String var : definedVariableNames) {
            if (!contentVariables.contains(var)) {
                errors.add("Defined variable not used in template: " + var);
            }
        }
        
        return errors;
    }

    public List<AIStyleGuide> getAllStyleGuides() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return styleGuideRepository.findByOrganizationIdAndIsActiveTrue(orgId);
    }

    public AIStyleGuide getStyleGuideById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return styleGuideRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Style guide not found or access denied: " + id));
    }

    public AIStyleGuide createStyleGuide(AIStyleGuide styleGuide) {
        Long orgId = getRequiredOrganizationId();
        styleGuide.setOrganizationId(orgId); // SECURITY: Set organization ID
        styleGuide.setCreatedAt(LocalDateTime.now());
        styleGuide.setUpdatedAt(LocalDateTime.now());
        return styleGuideRepository.save(styleGuide);
    }

    private void extractAndSaveVariables(AILegalTemplate template) {
        Set<String> variables = extractVariables(template.getTemplateContent());
        
        for (String varName : variables) {
            AITemplateVariable variable = new AITemplateVariable();
            variable.setTemplateId(template.getId());
            variable.setVariableName(varName);
            variable.setVariableType(com.bostoneo.bostoneosolutions.enumeration.VariableType.TEXT);
            variable.setDataSource(com.bostoneo.bostoneosolutions.enumeration.DataSource.USER_INPUT);
            variable.setIsRequired(true);
            variable.setCreatedAt(LocalDateTime.now());
            variableRepository.save(variable);
        }
    }

    private Set<String> extractVariables(String content) {
        Set<String> variables = new HashSet<>();
        Pattern pattern = Pattern.compile("\\{\\{([^}]+)\\}\\}");
        Matcher matcher = pattern.matcher(content);
        
        while (matcher.find()) {
            variables.add(matcher.group(1).trim());
        }
        
        return variables;
    }

    private String fillTemplateContent(String content, Map<String, String> values) {
        String filled = content;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            filled = filled.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return filled;
    }

    private String fetchVariableValue(AITemplateVariable variable, Long caseId) {
        return "Sample Value for " + variable.getVariableName();
    }

    private String enhanceWithAI(String content, String aiPrompt, Map<String, String> context) {
        try {
            String prompt = String.format(
                "%s\n\nDocument content:\n%s\n\nContext:\n%s",
                aiPrompt,
                content,
                objectMapper.writeValueAsString(context)
            );
            
            String enhanced = aiService.generateCompletion(prompt, false).get();
            return enhanced != null ? enhanced : content;
        } catch (Exception e) {
            e.printStackTrace();
            return content;
        }
    }

    private String applyStyleGuide(String content, Long styleGuideId) {
        try {
            AIStyleGuide styleGuide = getStyleGuideById(styleGuideId);
            
            if (styleGuide.getRulesJson() != null) {
                JsonNode rules = objectMapper.readTree(styleGuide.getRulesJson());
                
                if (rules.has("formatting")) {
                    JsonNode formatting = rules.get("formatting");
                    if (formatting.has("lineSpacing")) {
                        String spacing = formatting.get("lineSpacing").asText();
                        if ("double".equals(spacing)) {
                            content = content.replace("\n", "\n\n");
                        }
                    }
                }
                
                if (styleGuide.getCitationStyle() != null) {
                    content = applyCitationStyle(content, styleGuide.getCitationStyle().toString());
                }
                
                if (styleGuide.getTerminologyPreferences() != null) {
                    JsonNode terms = objectMapper.readTree(styleGuide.getTerminologyPreferences());
                    Iterator<Map.Entry<String, JsonNode>> fields = terms.fields();
                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> field = fields.next();
                        content = content.replace(field.getKey(), field.getValue().asText());
                    }
                }
            }
            
            return content;
        } catch (Exception e) {
            e.printStackTrace();
            return content;
        }
    }

    private String applyCitationStyle(String content, String style) {
        return content;
    }

    public Map<String, Object> analyzeTemplate(Long templateId) {
        AILegalTemplate template = getTemplateById(templateId);
        Map<String, Object> analysis = new HashMap<>();
        
        analysis.put("templateId", templateId);
        analysis.put("name", template.getName());
        analysis.put("category", template.getCategory());
        analysis.put("jurisdiction", template.getJurisdiction());
        
        Set<String> variables = extractVariables(template.getTemplateContent());
        analysis.put("variableCount", variables.size());
        analysis.put("variables", variables);
        
        int wordCount = template.getTemplateContent().split("\\s+").length;
        analysis.put("wordCount", wordCount);
        
        analysis.put("hasAIEnhancement", template.getAiPromptStructure() != null && !template.getAiPromptStructure().isEmpty());
        analysis.put("hasStyleGuide", template.getStyleGuideId() != null);
        
        List<String> validationErrors = validateTemplate(templateId);
        analysis.put("isValid", validationErrors.isEmpty());
        analysis.put("validationErrors", validationErrors);
        
        return analysis;
    }

    public List<Map<String, Object>> searchTemplates(String query) {
        Long orgId = getRequiredOrganizationId();
        Long userId = getCurrentUserIdOrSentinel();
        // SECURITY: tenant + privacy filter — only org's + public-approved, minus other users' private imports
        List<AILegalTemplate> allTemplates = templateRepository.findAccessibleByOrganizationAndUser(orgId, userId);
        List<Map<String, Object>> results = new ArrayList<>();

        String lowerQuery = query.toLowerCase();

        for (AILegalTemplate template : allTemplates) {
            boolean matches = false;
            int relevanceScore = 0;

            if (template.getName().toLowerCase().contains(lowerQuery)) {
                matches = true;
                relevanceScore += 10;
            }

            if (template.getCategory() != null && template.getCategory().toString().toLowerCase().contains(lowerQuery)) {
                matches = true;
                relevanceScore += 5;
            }

            if (template.getTemplateContent() != null && template.getTemplateContent().toLowerCase().contains(lowerQuery)) {
                matches = true;
                relevanceScore += 3;
            }

            if (template.getJurisdiction() != null && template.getJurisdiction().toLowerCase().contains(lowerQuery)) {
                matches = true;
                relevanceScore += 7;
            }

            if (matches) {
                Map<String, Object> result = new HashMap<>();
                result.put("id", template.getId());
                result.put("name", template.getName());
                result.put("category", template.getCategory());
                result.put("jurisdiction", template.getJurisdiction());
                result.put("relevanceScore", relevanceScore);
                results.add(result);
            }
        }

        results.sort((a, b) -> ((Integer) b.get("relevanceScore")).compareTo((Integer) a.get("relevanceScore")));

        return results;
    }

    public TemplateGenerationResponse generateWithContext(TemplateGenerationRequest request) {
        AILegalTemplate template = getTemplateById(request.getTemplateId());

        Map<String, String> variableValues = new HashMap<>();
        List<TemplateGenerationResponse.AiSuggestion> aiSuggestions = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Determine data source based on context type
        switch (request.getContextType()) {
            case STANDALONE:
                // Use only user inputs
                if (request.getUserInputs() != null) {
                    variableValues.putAll(request.getUserInputs());
                }
                break;

            case CLIENT:
                // Fetch client data
                if (request.getClientId() != null) {
                    Map<String, String> clientData = fetchClientData(request.getClientId());
                    variableValues.putAll(clientData);
                }
                if (request.getUserInputs() != null) {
                    variableValues.putAll(request.getUserInputs());
                }
                break;

            case CASE:
                // Fetch case and related client data
                if (request.getCaseId() != null) {
                    Map<String, String> caseData = fetchCaseData(request.getCaseId());
                    variableValues.putAll(caseData);
                }
                if (request.getUserInputs() != null) {
                    variableValues.putAll(request.getUserInputs());
                }
                break;

            case MULTI_CASE:
                // Aggregate data from multiple cases
                if (request.getCaseIds() != null && !request.getCaseIds().isEmpty()) {
                    Map<String, String> aggregatedData = aggregateMultiCaseData(request.getCaseIds());
                    variableValues.putAll(aggregatedData);
                }
                if (request.getUserInputs() != null) {
                    variableValues.putAll(request.getUserInputs());
                }
                break;

            case EXTERNAL:
                // Use external data
                if (request.getExternalData() != null) {
                    request.getExternalData().forEach((key, value) ->
                        variableValues.put(key, value != null ? value.toString() : ""));
                }
                if (request.getUserInputs() != null) {
                    variableValues.putAll(request.getUserInputs());
                }
                break;
        }

        // Get AI suggestions if requested
        if (request.isUseAiSuggestions()) {
            // SECURITY: Use findByTemplateId instead of findAll to avoid cross-tenant data access
            List<AITemplateVariable> variables = variableRepository.findByTemplateId(request.getTemplateId());

            for (AITemplateVariable variable : variables) {
                if (!variableValues.containsKey(variable.getVariableName()) ||
                    variableValues.get(variable.getVariableName()).isEmpty()) {

                    String suggestion = generateAiSuggestion(variable, variableValues);
                    if (suggestion != null && !suggestion.isEmpty()) {
                        aiSuggestions.add(TemplateGenerationResponse.AiSuggestion.builder()
                            .variableName(variable.getVariableName())
                            .suggestedValue(suggestion)
                            .reasoning("AI-generated suggestion based on context")
                            .confidenceScore(0.85)
                            .source("AI Assistant")
                            .build());
                        variableValues.put(variable.getVariableName(), suggestion);
                    }
                }
            }
        }

        // Fill template content
        String generatedContent = fillTemplateContent(template.getTemplateContent(), variableValues);

        // Apply AI enhancement if requested
        if (request.isUseAiEnhancement() && template.getAiPromptStructure() != null) {
            generatedContent = enhanceWithAI(generatedContent, template.getAiPromptStructure(), variableValues);
        }

        // Apply style guide if configured
        if (template.getStyleGuideId() != null) {
            generatedContent = applyStyleGuide(generatedContent, template.getStyleGuideId());
        }

        // Check for missing variables
        Set<String> requiredVariables = extractVariables(template.getTemplateContent());
        for (String varName : requiredVariables) {
            if (!variableValues.containsKey(varName) || variableValues.get(varName).isEmpty()) {
                warnings.add("Missing value for required variable: " + varName);
            }
        }

        return TemplateGenerationResponse.builder()
            .templateId(request.getTemplateId())
            .templateName(template.getName())
            .generatedContent(generatedContent)
            .appliedVariables(variableValues)
            .aiSuggestions(aiSuggestions)
            .contextType(request.getContextType().toString())
            .generatedAt(LocalDateTime.now())
            .outputFormat(request.getOutputFormat() != null ? request.getOutputFormat() : "HTML")
            .aiEnhanced(request.isUseAiEnhancement())
            .warnings(warnings)
            .complianceChecks(performComplianceChecks(generatedContent, template.getJurisdiction()))
            .build();
    }

    public Map<String, Object> suggestVariableValues(Long templateId, Map<String, Object> context) {
        AILegalTemplate template = getTemplateById(templateId);
        // SECURITY: Use findByTemplateId instead of findAll to avoid cross-tenant data access
        List<AITemplateVariable> variables = variableRepository.findByTemplateId(templateId);

        Map<String, Object> suggestions = new HashMap<>();
        suggestions.put("templateId", templateId);
        suggestions.put("templateName", template.getName());

        // Build the canonical case data map ONCE if a case is linked. This is the source of
        // truth for variable auto-fill — real DB values, no AI hallucination.
        Map<String, String> caseDataMap = Collections.emptyMap();
        if (context != null && "CASE".equalsIgnoreCase(String.valueOf(context.get("contextType")))) {
            Object caseIdObj = context.get("caseId");
            if (caseIdObj != null) {
                try {
                    Long caseId = Long.valueOf(caseIdObj.toString());
                    Long orgId = getRequiredOrganizationId();
                    LegalCase legalCase = legalCaseRepository
                            .findByIdAndOrganizationId(caseId, orgId)
                            .orElse(null);
                    if (legalCase != null) {
                        caseDataMap = buildCaseVariableDataMap(legalCase);
                    } else {
                        log.warn("Case {} not found in org {} for variable suggestions", caseId, orgId);
                    }
                } catch (NumberFormatException e) {
                    log.warn("Invalid caseId in suggestVariableValues context: {}", caseIdObj);
                } catch (Exception e) {
                    log.warn("Failed to load case data for variable suggestions: {}", e.getMessage());
                }
            }
        }

        List<Map<String, Object>> variableSuggestions = new ArrayList<>();
        for (AITemplateVariable variable : variables) {
            Map<String, Object> suggestion = new HashMap<>();
            suggestion.put("variableName", variable.getVariableName());
            suggestion.put("variableType", variable.getVariableType());
            suggestion.put("isRequired", variable.getIsRequired());

            // Resolve via real data first; fall back to default value, then empty.
            String matched = findValueForVariable(variable.getVariableName(), caseDataMap);
            // Reformat for the variable's input type so HTML date/number inputs accept it.
            // (Date inputs need yyyy-MM-dd; number inputs reject "$1,234.56".)
            matched = reformatForVariableType(matched, variable.getVariableType());

            String suggestedValue;
            String source;
            double confidence;

            if (matched != null && !matched.isBlank()) {
                suggestedValue = matched;
                source = "Case data";
                confidence = 1.0;
            } else if (variable.getDefaultValue() != null && !variable.getDefaultValue().isBlank()) {
                suggestedValue = variable.getDefaultValue();
                source = "Template default";
                confidence = 0.5;
            } else {
                // No real data + no default — leave empty so the attorney fills manually.
                // We deliberately do NOT call AI here: it produces hallucinated values that
                // mislead attorneys (e.g. fabricates a client name, policy number, or date).
                suggestedValue = "";
                source = "User input";
                confidence = 0.0;
            }

            suggestion.put("suggestedValue", suggestedValue);
            suggestion.put("source", source);
            suggestion.put("confidence", confidence);
            variableSuggestions.add(suggestion);
        }

        suggestions.put("variables", variableSuggestions);
        suggestions.put("context", context);
        suggestions.put("generatedAt", LocalDateTime.now());

        return suggestions;
    }

    private Map<String, String> fetchClientData(Long clientId) {
        Map<String, String> data = new HashMap<>();
        // Placeholder — real client-fetching is not used in the current draft path.
        // The case-linked draft path goes through buildCaseVariableDataMap() instead.
        data.put("clientName", "Client " + clientId);
        data.put("clientAddress", "Address for Client " + clientId);
        data.put("clientEmail", "client" + clientId + "@example.com");
        return data;
    }

    /**
     * Fetch real case data as a canonical {@code Map<canonical_var_name, value>}.
     * Replaces the prior stub that returned hardcoded placeholders. Used by both
     * {@link #suggestVariableValues} (variable auto-fill) and {@link #generateWithContext}
     * (legacy generate-with-context path).
     */
    private Map<String, String> fetchCaseData(Long caseId) {
        try {
            Long orgId = getRequiredOrganizationId();
            return legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                    .map(this::buildCaseVariableDataMap)
                    .orElseGet(HashMap::new);
        } catch (Exception e) {
            log.warn("fetchCaseData failed for caseId={}: {}", caseId, e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * Build a canonical variable→value map from a LegalCase. Keys are snake_case
     * variable names that an attorney would naturally write in a template body
     * (client_name, policy_number, accident_date, …). Null/blank fields are skipped.
     *
     * <p>Aliases are intentionally permissive (client_name + clientname + name) so the
     * downstream {@link #findValueForVariable} heuristic can match templates authored
     * with different naming conventions.</p>
     */
    private Map<String, String> buildCaseVariableDataMap(LegalCase c) {
        Map<String, String> data = new LinkedHashMap<>();
        if (c == null) return data;

        // ------------ Identifiers / case ------------
        putIfPresent(data, "case_id", c.getId() != null ? String.valueOf(c.getId()) : null);
        putIfPresent(data, "case_number", c.getCaseNumber());
        putIfPresent(data, "case_no", c.getCaseNumber());
        putIfPresent(data, "docket_number", c.getDocketNumber() != null ? c.getDocketNumber() : c.getCaseNumber());
        putIfPresent(data, "case_title", c.getTitle());
        putIfPresent(data, "matter", c.getTitle());
        putIfPresent(data, "case_type", c.getType());
        putIfPresent(data, "practice_area", c.getEffectivePracticeArea());
        putIfPresent(data, "case_description", c.getDescription());

        // ------------ Client (plaintiff in PI / petitioner in family) ------------
        putIfPresent(data, "client_name", c.getClientName());
        putIfPresent(data, "client_full_name", c.getClientName());
        putIfPresent(data, "plaintiff_name", c.getClientName());
        putIfPresent(data, "client_email", c.getClientEmail());
        putIfPresent(data, "client_phone", c.getClientPhone());
        putIfPresent(data, "client_address", c.getClientAddress());

        // ------------ Court ------------
        putIfPresent(data, "jurisdiction", c.getJurisdiction());
        putIfPresent(data, "state", c.getJurisdiction());
        putIfPresent(data, "county", c.getCountyName());
        putIfPresent(data, "county_name", c.getCountyName());
        putIfPresent(data, "courtroom", c.getCourtroom());
        putIfPresent(data, "judge_name", c.getJudgeName());
        putIfPresent(data, "judge", c.getJudgeName());

        // ------------ Dates ------------
        putIfPresent(data, "filing_date", formatUtilDate(c.getFilingDate()));
        putIfPresent(data, "next_hearing", formatUtilDate(c.getNextHearing()));
        putIfPresent(data, "next_hearing_date", formatUtilDate(c.getNextHearing()));
        putIfPresent(data, "trial_date", formatUtilDate(c.getTrialDate()));
        putIfPresent(data, "closed_date", formatUtilDate(c.getClosedDate()));
        // Common "today" aliases for letter dates
        String todayStr = formatLocalDate(LocalDate.now());
        data.put("today", todayStr);
        data.put("today_date", todayStr);
        data.put("date", todayStr);
        data.put("current_date", todayStr);

        // ------------ Personal Injury fields ------------
        String injuryDate = formatLocalDate(c.getInjuryDate());
        putIfPresent(data, "injury_date", injuryDate);
        putIfPresent(data, "date_of_injury", injuryDate);
        putIfPresent(data, "accident_date", injuryDate);
        putIfPresent(data, "date_of_accident", injuryDate);
        putIfPresent(data, "incident_date", injuryDate);
        putIfPresent(data, "injury_type", c.getInjuryType());
        putIfPresent(data, "injury_description", c.getInjuryDescription());
        putIfPresent(data, "accident_location", c.getAccidentLocation());
        putIfPresent(data, "incident_location", c.getAccidentLocation());

        // ------------ PI financials ------------
        putIfPresent(data, "medical_expenses", formatMoney(c.getMedicalExpensesTotal()));
        putIfPresent(data, "medical_expenses_total", formatMoney(c.getMedicalExpensesTotal()));
        putIfPresent(data, "lost_wages", formatMoney(c.getLostWages()));
        putIfPresent(data, "future_medical", formatMoney(c.getFutureMedicalEstimate()));
        putIfPresent(data, "future_medical_estimate", formatMoney(c.getFutureMedicalEstimate()));
        putIfPresent(data, "settlement_demand", formatMoney(c.getSettlementDemandAmount()));
        putIfPresent(data, "demand_amount", formatMoney(c.getSettlementDemandAmount()));

        // ------------ Insurance (defendant carrier) ------------
        putIfPresent(data, "insurance_company", c.getInsuranceCompany());
        putIfPresent(data, "insurance_carrier", c.getInsuranceCompany());
        putIfPresent(data, "carrier", c.getInsuranceCompany());
        putIfPresent(data, "policy_number", c.getInsurancePolicyNumber());
        putIfPresent(data, "insurance_policy_number", c.getInsurancePolicyNumber());
        putIfPresent(data, "policy_limit", formatMoney(c.getInsurancePolicyLimit()));
        putIfPresent(data, "policy_limits", formatMoney(c.getInsurancePolicyLimit()));
        putIfPresent(data, "adjuster_name", c.getInsuranceAdjusterName());
        putIfPresent(data, "insurance_adjuster_name", c.getInsuranceAdjusterName());
        putIfPresent(data, "adjuster_email", c.getInsuranceAdjusterEmail());
        putIfPresent(data, "adjuster_phone", c.getInsuranceAdjusterPhone());
        putIfPresent(data, "insurance_adjuster_phone", c.getInsuranceAdjusterPhone());

        // ------------ Client's own insurance (PIP/UIM) ------------
        putIfPresent(data, "client_insurance_company", c.getClientInsuranceCompany());
        putIfPresent(data, "pip_carrier", c.getClientInsuranceCompany());
        putIfPresent(data, "client_policy_number", c.getClientInsurancePolicyNumber());

        // ------------ Defendant ------------
        putIfPresent(data, "defendant_name", c.getDefendantName());
        putIfPresent(data, "defendant", c.getDefendantName());
        putIfPresent(data, "respondent_name", c.getDefendantName());
        putIfPresent(data, "defendant_address", c.getDefendantAddress());

        // ------------ Employer (wage docs) ------------
        putIfPresent(data, "employer_name", c.getEmployerName());
        putIfPresent(data, "employer", c.getEmployerName());
        putIfPresent(data, "employer_email", c.getEmployerEmail());
        putIfPresent(data, "employer_phone", c.getEmployerPhone());

        // ------------ Criminal ------------
        putIfPresent(data, "primary_charge", c.getPrimaryCharge());
        putIfPresent(data, "charge", c.getPrimaryCharge());
        putIfPresent(data, "charge_level", c.getChargeLevel());
        putIfPresent(data, "bail_amount", formatMoney(c.getBailAmount()));
        putIfPresent(data, "arrest_date", formatUtilDate(c.getArrestDate()));
        putIfPresent(data, "prosecutor_name", c.getProsecutorName());
        putIfPresent(data, "prosecutor", c.getProsecutorName());

        // ------------ Family law ------------
        putIfPresent(data, "spouse_name", c.getSpouseName());
        putIfPresent(data, "marriage_date", formatUtilDate(c.getMarriageDate()));
        putIfPresent(data, "separation_date", formatUtilDate(c.getSeparationDate()));
        putIfPresent(data, "children_count", c.getChildrenCount() != null ? String.valueOf(c.getChildrenCount()) : null);

        // ------------ Immigration ------------
        putIfPresent(data, "form_type", c.getFormType());
        putIfPresent(data, "uscis_number", c.getUscisNumber());
        putIfPresent(data, "petitioner_name", c.getPetitionerName());
        putIfPresent(data, "beneficiary_name", c.getBeneficiaryName());
        putIfPresent(data, "priority_date", formatUtilDate(c.getPriorityDate()));
        putIfPresent(data, "visa_category", c.getVisaCategory());

        // ------------ Real estate ------------
        putIfPresent(data, "transaction_type", c.getTransactionType());
        putIfPresent(data, "property_address", c.getPropertyAddress());
        putIfPresent(data, "purchase_price", formatMoney(c.getPurchasePrice()));
        putIfPresent(data, "closing_date", formatUtilDate(c.getClosingDate()));
        putIfPresent(data, "buyer_name", c.getBuyerName());
        putIfPresent(data, "seller_name", c.getSellerName());

        return data;
    }

    private void putIfPresent(Map<String, String> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    private String formatUtilDate(java.util.Date d) {
        if (d == null) return null;
        return new SimpleDateFormat("MMMM d, yyyy").format(d);
    }

    private String formatLocalDate(LocalDate d) {
        if (d == null) return null;
        return d.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
    }

    private String formatMoney(Double amount) {
        if (amount == null) return null;
        return String.format("$%,.2f", amount);
    }

    /**
     * Heuristic match: given a template variable name and a canonical case data map,
     * return the best-matching value or null. Tolerates naming-style differences
     * ({@code client_name}, {@code clientName}, {@code ClientFullName}, {@code client name}).
     */
    private String findValueForVariable(String varName, Map<String, String> dataMap) {
        if (varName == null || dataMap == null || dataMap.isEmpty()) return null;

        // 1. Exact match (case-sensitive) — fastest path, attorney wrote canonical name.
        String exact = dataMap.get(varName);
        if (exact != null) return exact;

        // 2. Case-insensitive direct match.
        for (Map.Entry<String, String> e : dataMap.entrySet()) {
            if (e.getKey().equalsIgnoreCase(varName)) return e.getValue();
        }

        // 3. Normalized match (strip non-alphanumerics, lowercase) — handles
        //    snake_case ↔ camelCase ↔ "Client Full Name" naming drift.
        String normVar = normalizeVarName(varName);
        if (normVar.isEmpty()) return null;
        for (Map.Entry<String, String> e : dataMap.entrySet()) {
            if (normalizeVarName(e.getKey()).equals(normVar)) return e.getValue();
        }
        return null;
    }

    private String normalizeVarName(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    /**
     * Reformat a human-readable case-data value so the form's input type accepts it.
     *
     * <p>The case data map produces letter-friendly strings ({@code "April 27, 2026"},
     * {@code "$1,234.56"}). HTML's {@code <input type="date">} only accepts
     * {@code yyyy-MM-dd}; {@code <input type="number">} rejects the {@code $} and commas.
     * Without this post-processing, auto-fill would silently render those fields empty.</p>
     */
    private String reformatForVariableType(String value, com.bostoneo.bostoneosolutions.enumeration.VariableType type) {
        if (value == null || value.isBlank() || type == null) return value;

        switch (type) {
            case DATE:
                // Parse "April 27, 2026" or "yyyy-MM-dd" and emit yyyy-MM-dd for <input type="date">.
                LocalDate parsed = tryParseDate(value);
                return parsed != null ? parsed.format(DateTimeFormatter.ISO_LOCAL_DATE) : value;
            case NUMBER:
                // Strip currency symbols and grouping commas: "$1,234.56" → "1234.56".
                String stripped = value.replaceAll("[$,\\s]", "");
                try {
                    Double.parseDouble(stripped);
                    return stripped;
                } catch (NumberFormatException nfe) {
                    return value;
                }
            default:
                return value;
        }
    }

    /** Best-effort date parse — covers the formats this service emits in {@link #buildCaseVariableDataMap}. */
    private LocalDate tryParseDate(String s) {
        if (s == null || s.isBlank()) return null;
        DateTimeFormatter[] formats = new DateTimeFormatter[]{
                DateTimeFormatter.ISO_LOCAL_DATE,                       // 2026-04-27
                DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH),  // April 27, 2026
                DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH),   // Apr 27, 2026
                DateTimeFormatter.ofPattern("M/d/yyyy", Locale.ENGLISH),      // 4/27/2026
                DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.ENGLISH)     // 04/27/2026
        };
        for (DateTimeFormatter fmt : formats) {
            try { return LocalDate.parse(s.trim(), fmt); } catch (Exception ignored) {}
        }
        return null;
    }

    private Map<String, String> aggregateMultiCaseData(List<Long> caseIds) {
        Map<String, String> data = new HashMap<>();
        // Aggregate data from multiple cases
        data.put("totalCases", String.valueOf(caseIds.size()));
        data.put("caseNumbers", caseIds.stream()
            .map(id -> "CASE-" + id)
            .collect(Collectors.joining(", ")));
        return data;
    }

    private String generateAiSuggestion(AITemplateVariable variable, Map<String, String> context) {
        try {
            String prompt = String.format(
                "Generate a value for the template variable '%s' of type '%s'. Context: %s",
                variable.getVariableName(),
                variable.getVariableType(),
                objectMapper.writeValueAsString(context)
            );

            String suggestion = aiService.generateCompletion(prompt, false).get();
            return suggestion != null ? suggestion.trim() : "";
        } catch (Exception e) {
            e.printStackTrace();
            return "";
        }
    }

    private String generateAiSuggestionWithContext(AITemplateVariable variable, Map<String, Object> context) {
        try {
            String prompt = String.format(
                "Suggest a value for the legal template variable '%s' (type: %s). Context: %s",
                variable.getVariableName(),
                variable.getVariableType(),
                objectMapper.writeValueAsString(context)
            );

            String suggestion = aiService.generateCompletion(prompt, false).get();
            return suggestion != null ? suggestion.trim() : "";
        } catch (Exception e) {
            e.printStackTrace();
            return "";
        }
    }

    private String determineSourceFromContext(AITemplateVariable variable, Map<String, Object> context) {
        if (context.containsKey("caseId")) {
            return "Case Data";
        } else if (context.containsKey("clientId")) {
            return "Client Data";
        } else if (context.containsKey("previousDocument")) {
            return "Previous Document";
        } else {
            return "AI Generated";
        }
    }

    private double calculateConfidence(AITemplateVariable variable, Map<String, Object> context, String suggestedValue) {
        if (suggestedValue == null || suggestedValue.isEmpty()) {
            return 0.0;
        }

        // Higher confidence if we have specific context data
        if (context.containsKey("caseId") || context.containsKey("clientId")) {
            return 0.9;
        }

        // Medium confidence for AI-generated values
        return 0.7;
    }

    private List<String> performComplianceChecks(String content, String jurisdiction) {
        List<String> checks = new ArrayList<>();

        // Basic compliance checks
        if (jurisdiction != null && jurisdiction.toLowerCase().contains("massachusetts")) {
            checks.add("Massachusetts jurisdiction requirements checked");

            // Check for required disclaimers
            if (!content.toLowerCase().contains("commonwealth of massachusetts")) {
                checks.add("Warning: May need Massachusetts jurisdiction disclaimer");
            }
        }

        // Check for common required elements
        if (!content.toLowerCase().contains("date")) {
            checks.add("Warning: Document may need date field");
        }

        if (!content.toLowerCase().contains("signature")) {
            checks.add("Warning: Document may need signature block");
        }

        return checks;
    }
}