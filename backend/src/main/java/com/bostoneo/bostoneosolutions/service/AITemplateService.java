package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.TemplateGenerationRequest;
import com.bostoneo.bostoneosolutions.dto.TemplateGenerationResponse;
import com.bostoneo.bostoneosolutions.enumeration.DocumentContextType;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.ai.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.stream.Collectors;

@Service
@Transactional
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

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Get all templates accessible to the current organization (own + public approved)
     */
    public List<AILegalTemplate> getAllTemplates() {
        Long orgId = getRequiredOrganizationId();
        return templateRepository.findAccessibleByOrganization(orgId);
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
        // SECURITY: Use tenant-filtered query (includes own + public approved)
        return templateRepository.findByIdAndAccessibleByOrganization(id, orgId)
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
        // SECURITY: Use tenant-filtered query - only search accessible templates
        List<AILegalTemplate> allTemplates = templateRepository.findAccessibleByOrganization(orgId);
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

        List<Map<String, Object>> variableSuggestions = new ArrayList<>();

        for (AITemplateVariable variable : variables) {
            Map<String, Object> suggestion = new HashMap<>();
            suggestion.put("variableName", variable.getVariableName());
            suggestion.put("variableType", variable.getVariableType());
            suggestion.put("isRequired", variable.getIsRequired());

            // Generate AI suggestion based on context
            String suggestedValue = generateAiSuggestionWithContext(variable, context);
            suggestion.put("suggestedValue", suggestedValue);

            // Add metadata about the suggestion
            suggestion.put("source", determineSourceFromContext(variable, context));
            suggestion.put("confidence", calculateConfidence(variable, context, suggestedValue));

            variableSuggestions.add(suggestion);
        }

        suggestions.put("variables", variableSuggestions);
        suggestions.put("context", context);
        suggestions.put("generatedAt", LocalDateTime.now());

        return suggestions;
    }

    private Map<String, String> fetchClientData(Long clientId) {
        Map<String, String> data = new HashMap<>();
        // Placeholder for fetching actual client data from repository
        // In production, this would query the client repository
        data.put("clientName", "Client " + clientId);
        data.put("clientAddress", "Address for Client " + clientId);
        data.put("clientEmail", "client" + clientId + "@example.com");
        return data;
    }

    private Map<String, String> fetchCaseData(Long caseId) {
        Map<String, String> data = new HashMap<>();
        // Placeholder for fetching actual case data from repository
        // In production, this would query the case repository
        data.put("caseNumber", "CASE-" + caseId);
        data.put("caseTitle", "Case Title " + caseId);
        data.put("filingDate", LocalDateTime.now().toString());
        return data;
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