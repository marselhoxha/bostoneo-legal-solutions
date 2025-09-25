package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.service.AIDocumentGenerationService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.enumeration.GenerationType;
import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import com.bostoneo.bostoneosolutions.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AIDocumentGenerationServiceImpl implements AIDocumentGenerationService {

    private final AILegalTemplateRepository templateRepository;
    private final AITemplateVariableRepository variableRepository;
    private final AIDocumentGenerationLogRepository generationLogRepository;
    private final AIStyleGuideRepository styleGuideRepository;
    private final LegalCaseRepository caseRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    @Override
    public AILegalTemplate createTemplate(AILegalTemplate template) {
        log.info("Creating new legal template: {}", template.getName());
        template.setCreatedAt(LocalDateTime.now());
        template.setUpdatedAt(LocalDateTime.now());
        return templateRepository.save(template);
    }

    @Override
    public AILegalTemplate updateTemplate(Long id, AILegalTemplate template) {
        log.info("Updating template with ID: {}", id);
        AILegalTemplate existing = getTemplateById(id);
        
        existing.setName(template.getName());
        existing.setDescription(template.getDescription());
        existing.setCategory(template.getCategory());
        existing.setPracticeArea(template.getPracticeArea());
        existing.setTemplateContent(template.getTemplateContent());
        existing.setAiPromptStructure(template.getAiPromptStructure());
        existing.setVariableMappings(template.getVariableMappings());
        existing.setFormattingRules(template.getFormattingRules());
        existing.setUpdatedAt(LocalDateTime.now());
        
        return templateRepository.save(existing);
    }

    @Override
    public AILegalTemplate getTemplateById(Long id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found with ID: " + id));
    }

    @Override
    public Page<AILegalTemplate> getTemplatesByCategory(String category, Pageable pageable) {
        try {
            TemplateCategory templateCategory = TemplateCategory.valueOf(category.toUpperCase());
            return templateRepository.findByCategoryAndIsApprovedTrue(templateCategory, pageable);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid category: {}", category);
            return Page.empty(pageable);
        }
    }

    @Override
    public Page<AILegalTemplate> getTemplatesByPracticeArea(String practiceArea, Pageable pageable) {
        return templateRepository.findByPracticeAreaAndIsApprovedTrue(practiceArea, pageable);
    }

    @Override
    public Page<AILegalTemplate> getMassachusettsTemplates(Pageable pageable) {
        return templateRepository.findByMaJurisdictionSpecificTrueAndIsApprovedTrue(pageable);
    }

    @Override
    public List<AILegalTemplate> getPopularTemplates(int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "usageCount"));
        return templateRepository.findByIsApprovedTrueAndIsPublicTrue(pageable).getContent();
    }

    @Override
    public void deleteTemplate(Long id) {
        log.info("Deleting template with ID: {}", id);
        templateRepository.deleteById(id);
    }

    @Override
    public CompletableFuture<String> generateDocument(Long templateId, Map<String, Object> variables, Long userId, Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Generating document from template ID: {} for user: {}", templateId, userId);
                
                AILegalTemplate template = getTemplateById(templateId);
                String templateContent = template.getTemplateContent();
                
                // Replace variables in template
                String populatedContent = replaceVariables(templateContent, variables);
                
                // Apply AI enhancement if prompt structure exists
                if (template.getAiPromptStructure() != null && !template.getAiPromptStructure().isEmpty()) {
                    String aiPrompt = buildAIPrompt(template, populatedContent, variables);
                    populatedContent = claudeService.generateCompletion(aiPrompt, true).join();
                }
                
                // Apply style guide if configured
                if (template.getStyleGuideId() != null) {
                    populatedContent = applyStyleGuide(populatedContent, template.getStyleGuideId()).join();
                }
                
                // Log generation
                saveGenerationLog(templateId, userId, caseId, GenerationType.NEW_DOCUMENT, 
                                variables, populatedContent, true);
                
                // Update template usage count
                template.setUsageCount(template.getUsageCount() + 1);
                templateRepository.save(template);
                
                log.info("Document generation completed successfully for template: {}", templateId);
                return populatedContent;
                
            } catch (Exception e) {
                log.error("Error generating document from template {}: {}", templateId, e.getMessage(), e);
                saveGenerationLog(templateId, userId, caseId, GenerationType.NEW_DOCUMENT, 
                                variables, null, false);
                throw new RuntimeException("Document generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> autoFillTemplate(Long templateId, Long caseId, Long userId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Auto-filling template {} with case data {}", templateId, caseId);
                
                AILegalTemplate template = getTemplateById(templateId);
                LegalCase legalCase = caseRepository.findById(caseId)
                        .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));
                
                // Extract variables from case data
                Map<String, Object> caseVariables = extractCaseVariables(legalCase);
                
                // Get template variables to map case data
                List<AITemplateVariable> templateVars = variableRepository.findByTemplateIdOrderByDisplayOrder(templateId);
                Map<String, Object> mappedVariables = mapCaseDataToVariables(caseVariables, templateVars);
                
                return generateDocument(templateId, mappedVariables, userId, caseId).join();
                
            } catch (Exception e) {
                log.error("Error auto-filling template {}: {}", templateId, e.getMessage(), e);
                throw new RuntimeException("Auto-fill failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> batchGenerateDocuments(List<Long> templateIds, Map<String, Object> variables, Long userId, Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            log.info("Batch generating {} documents for user: {}", templateIds.size(), userId);
            
            return templateIds.parallelStream()
                    .map(templateId -> {
                        try {
                            return generateDocument(templateId, variables, userId, caseId).join();
                        } catch (Exception e) {
                            log.error("Failed to generate document for template {}: {}", templateId, e.getMessage());
                            return "ERROR: Failed to generate document from template " + templateId;
                        }
                    })
                    .collect(Collectors.toList());
        });
    }

    @Override
    public CompletableFuture<String> mergeTemplates(List<Long> templateIds, Map<String, Object> variables, Long userId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Merging {} templates for user: {}", templateIds.size(), userId);
                
                List<String> generatedDocs = batchGenerateDocuments(templateIds, variables, userId, null).join();
                
                // Use AI to intelligently merge documents
                String mergePrompt = buildMergePrompt(generatedDocs, variables);
                return claudeService.generateCompletion(mergePrompt, true).join();
                
            } catch (Exception e) {
                log.error("Error merging templates: {}", e.getMessage(), e);
                throw new RuntimeException("Template merge failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzeTemplateVariables(Long templateId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AILegalTemplate template = getTemplateById(templateId);
                List<AITemplateVariable> variables = variableRepository.findByTemplateIdOrderByDisplayOrder(templateId);
                
                Map<String, Object> analysis = new HashMap<>();
                analysis.put("templateId", templateId);
                analysis.put("templateName", template.getName());
                analysis.put("totalVariables", variables.size());
                analysis.put("requiredVariables", variables.stream().filter(AITemplateVariable::getIsRequired).count());
                analysis.put("computedVariables", variables.stream().filter(AITemplateVariable::getIsComputed).count());
                analysis.put("variables", variables);
                
                // Analyze template complexity
                String content = template.getTemplateContent();
                int variableCount = countVariablesInTemplate(content);
                analysis.put("templateComplexity", determineComplexity(variableCount, content.length()));
                
                return analysis;
                
            } catch (Exception e) {
                log.error("Error analyzing template variables for {}: {}", templateId, e.getMessage());
                throw new RuntimeException("Template analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> suggestTemplates(String description, String practiceArea) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Suggesting templates for description: {}, practice area: {}", description, practiceArea);
                
                String aiPrompt = String.format("""
                    Based on this description: "%s" and practice area: "%s",
                    suggest the most appropriate legal document templates.
                    
                    Available categories: MOTION, BRIEF, PLEADING, CONTRACT, CORRESPONDENCE, 
                    DISCOVERY, SETTLEMENT, COURT_FILING, INTERNAL_MEMO, CLIENT_ADVICE, 
                    RESEARCH_MEMO, OPINION_LETTER, IMMIGRATION_FORM, FAMILY_LAW_FORM, 
                    CRIMINAL_MOTION, REAL_ESTATE_DOC, PATENT_APPLICATION
                    
                    Return only a comma-separated list of the 5 most relevant template names.
                    """, description, practiceArea);
                
                String aiResponse = claudeService.generateCompletion(aiPrompt, false).join();
                return Arrays.asList(aiResponse.split(",\\s*"));
                
            } catch (Exception e) {
                log.error("Error suggesting templates: {}", e.getMessage());
                return List.of("Massachusetts Civil Complaint", "Motion for Summary Judgment - MA", 
                              "Purchase and Sale Agreement - MA");
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> validateTemplateData(Long templateId, Map<String, Object> variables) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                List<AITemplateVariable> templateVars = variableRepository.findByTemplateIdOrderByDisplayOrder(templateId);
                Map<String, Object> validation = new HashMap<>();
                List<String> errors = new ArrayList<>();
                List<String> warnings = new ArrayList<>();
                
                for (AITemplateVariable var : templateVars) {
                    Object value = variables.get(var.getVariableName());
                    
                    // Check required fields
                    if (var.getIsRequired() && (value == null || value.toString().trim().isEmpty())) {
                        errors.add("Required field missing: " + var.getDisplayName());
                    }
                    
                    // Validate data types
                    if (value != null) {
                        String validationError = validateVariableType(var, value);
                        if (validationError != null) {
                            errors.add(validationError);
                        }
                    }
                }
                
                validation.put("isValid", errors.isEmpty());
                validation.put("errors", errors);
                validation.put("warnings", warnings);
                validation.put("variableCount", templateVars.size());
                validation.put("providedCount", variables.size());
                
                return validation;
                
            } catch (Exception e) {
                log.error("Error validating template data: {}", e.getMessage());
                throw new RuntimeException("Validation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public Page<AIDocumentGenerationLog> getGenerationHistory(Long userId, Pageable pageable) {
        return generationLogRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    @Override
    public Page<AIDocumentGenerationLog> getTemplateUsageStats(Long templateId, Pageable pageable) {
        return generationLogRepository.findByTemplateIdOrderByCreatedAtDesc(templateId, pageable);
    }

    @Override
    public AIDocumentGenerationLog saveGenerationLog(Long templateId, Long userId, Long caseId, 
                                                     GenerationType type, Map<String, Object> inputData, 
                                                     String result, boolean success) {
        try {
            AIDocumentGenerationLog log = AIDocumentGenerationLog.builder()
                    .templateId(templateId)
                    .userId(userId)
                    .caseId(caseId)
                    .generationType(type)
                    .inputData(objectMapper.writeValueAsString(inputData))
                    .aiModelUsed("claude-sonnet-4")
                    .success(success)
                    .createdAt(LocalDateTime.now())
                    .build();
            
            if (!success && result != null) {
                log.setErrorMessage(result);
            }
            
            return generationLogRepository.save(log);
            
        } catch (Exception e) {
            log.error("Error saving generation log: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public CompletableFuture<String> applyStyleGuide(String content, Long styleGuideId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIStyleGuide styleGuide = styleGuideRepository.findById(styleGuideId)
                        .orElseThrow(() -> new RuntimeException("Style guide not found: " + styleGuideId));
                
                String prompt = String.format("""
                    Apply the following style guide to this legal document:
                    
                    Style Guide: %s
                    Citation Style: %s
                    Formatting Rules: %s
                    
                    Document Content:
                    %s
                    
                    Return the document with proper formatting applied.
                    """, styleGuide.getName(), styleGuide.getCitationStyle(), 
                    styleGuide.getFormattingPreferences(), content);
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error applying style guide: {}", e.getMessage());
                return content; // Return original if styling fails
            }
        });
    }

    @Override
    public CompletableFuture<String> formatDocumentForMassachusetts(String content, String documentType) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Format this %s document according to Massachusetts court requirements:
                
                1. Proper header format for Massachusetts courts
                2. Correct citation format (Massachusetts style)
                3. Appropriate spacing and margins
                4. Required certificate formats
                5. Proper signature blocks
                
                Document:
                %s
                """, documentType, content);
            
            return claudeService.generateCompletion(prompt, false).join();
        });
    }

    @Override
    public CompletableFuture<String> enhanceDocumentWithAI(String content, String improvementType) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Enhance this legal document with focus on: %s
                
                Improvements to make:
                - Clarity and readability
                - Legal accuracy
                - Professional tone
                - Proper legal terminology
                - Logical structure
                
                Document:
                %s
                """, improvementType, content);
            
            return claudeService.generateCompletion(prompt, true).join();
        });
    }

    @Override
    public CompletableFuture<List<String>> getSuggestions(String content, String context) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Provide 5 specific suggestions to improve this legal document in the context of: %s
                    
                    Focus on:
                    - Legal accuracy
                    - Missing clauses
                    - Clarity improvements
                    - Compliance issues
                    - Best practices
                    
                    Document:
                    %s
                    
                    Return as a numbered list.
                    """, context, content);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> line.trim().matches("^\\d+\\..*"))
                        .collect(Collectors.toList());
                
            } catch (Exception e) {
                log.error("Error getting suggestions: {}", e.getMessage());
                return List.of("Review document for completeness", "Verify legal citations", "Check formatting");
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> calculateDocumentQuality(String content) {
        return CompletableFuture.supplyAsync(() -> {
            Map<String, Object> quality = new HashMap<>();
            
            // Basic metrics
            quality.put("wordCount", content.split("\\s+").length);
            quality.put("characterCount", content.length());
            quality.put("paragraphCount", content.split("\\n\\s*\\n").length);
            
            // Complexity analysis
            int sentences = content.split("[.!?]+").length;
            quality.put("sentenceCount", sentences);
            quality.put("averageWordsPerSentence", (double) (Integer) quality.get("wordCount") / sentences);
            
            // Legal document specific metrics
            int legalTerms = countLegalTerms(content);
            quality.put("legalTermCount", legalTerms);
            quality.put("formalityScore", calculateFormalityScore(content));
            quality.put("completenessScore", calculateCompletenessScore(content));
            
            // Overall quality score (0-100)
            double overallScore = calculateOverallQualityScore(quality);
            quality.put("overallQualityScore", overallScore);
            quality.put("qualityGrade", getQualityGrade(overallScore));
            
            return quality;
        });
    }

    // Helper methods
    private String replaceVariables(String template, Map<String, Object> variables) {
        String result = template;
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            String placeholder = "[" + entry.getKey().toUpperCase() + "]";
            String value = entry.getValue() != null ? entry.getValue().toString() : "";
            result = result.replace(placeholder, value);
        }
        return result;
    }

    private String buildAIPrompt(AILegalTemplate template, String content, Map<String, Object> variables) {
        return String.format("""
            %s
            
            Template: %s
            Practice Area: %s
            Jurisdiction: %s
            
            Variables provided: %s
            
            Content to enhance:
            %s
            """, template.getAiPromptStructure(), template.getName(), 
            template.getPracticeArea(), template.getJurisdiction(),
            variables.toString(), content);
    }

    private String buildMergePrompt(List<String> documents, Map<String, Object> context) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Intelligently merge these legal documents into a cohesive document:\n\n");
        
        for (int i = 0; i < documents.size(); i++) {
            prompt.append("Document ").append(i + 1).append(":\n");
            prompt.append(documents.get(i)).append("\n\n");
        }
        
        prompt.append("Context: ").append(context.toString());
        prompt.append("\n\nEnsure the merged document is professionally formatted and legally coherent.");
        
        return prompt.toString();
    }

    private Map<String, Object> extractCaseVariables(LegalCase legalCase) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("CLIENT_NAME", legalCase.getClientName());
        variables.put("CLIENT_EMAIL", legalCase.getClientEmail());
        variables.put("CLIENT_PHONE", legalCase.getClientPhone());
        variables.put("CLIENT_ADDRESS", legalCase.getClientAddress());
        variables.put("CASE_NUMBER", legalCase.getCaseNumber());
        variables.put("CASE_TITLE", legalCase.getTitle());
        variables.put("CASE_TYPE", legalCase.getType());
        variables.put("CASE_DESCRIPTION", legalCase.getDescription());
        variables.put("COURT_NAME", legalCase.getCourtName());
        variables.put("JUDGE_NAME", legalCase.getJudgeName());
        variables.put("FILING_DATE", legalCase.getFilingDate());
        variables.put("TRIAL_DATE", legalCase.getTrialDate());
        return variables;
    }

    private Map<String, Object> mapCaseDataToVariables(Map<String, Object> caseData, List<AITemplateVariable> templateVars) {
        Map<String, Object> mapped = new HashMap<>();
        
        for (AITemplateVariable var : templateVars) {
            if (var.getSourceField() != null && caseData.containsKey(var.getSourceField())) {
                mapped.put(var.getVariableName(), caseData.get(var.getSourceField()));
            } else if (var.getDefaultValue() != null) {
                mapped.put(var.getVariableName(), var.getDefaultValue());
            }
        }
        
        return mapped;
    }

    private int countVariablesInTemplate(String template) {
        Pattern pattern = Pattern.compile("\\[\\w+\\]");
        Matcher matcher = pattern.matcher(template);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private String determineComplexity(int variableCount, int contentLength) {
        if (variableCount > 20 || contentLength > 5000) return "HIGH";
        if (variableCount > 10 || contentLength > 2000) return "MEDIUM";
        return "LOW";
    }

    private String validateVariableType(AITemplateVariable var, Object value) {
        try {
            switch (var.getVariableType()) {
                case EMAIL:
                    if (!value.toString().matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
                        return var.getDisplayName() + " must be a valid email address";
                    }
                    break;
                case PHONE:
                    if (!value.toString().matches("^[\\+]?[1-9]?[0-9]{7,15}$")) {
                        return var.getDisplayName() + " must be a valid phone number";
                    }
                    break;
                case NUMBER:
                    try {
                        Double.parseDouble(value.toString());
                    } catch (NumberFormatException e) {
                        return var.getDisplayName() + " must be a valid number";
                    }
                    break;
                case DATE:
                    // Add date validation logic
                    break;
                default:
                    break;
            }
            return null;
        } catch (Exception e) {
            return "Invalid value for " + var.getDisplayName();
        }
    }

    private int countLegalTerms(String content) {
        String[] legalTerms = {"whereas", "heretofore", "plaintiff", "defendant", "jurisdiction", 
                              "statute", "precedent", "hereby", "therefore", "wherefore"};
        int count = 0;
        String lowerContent = content.toLowerCase();
        for (String term : legalTerms) {
            count += (lowerContent.split(term, -1).length - 1);
        }
        return count;
    }

    private double calculateFormalityScore(String content) {
        // Simple formality calculation based on sentence length and legal terms
        int legalTerms = countLegalTerms(content);
        int sentences = content.split("[.!?]+").length;
        return Math.min(100.0, (legalTerms * 10.0) + (content.length() / sentences * 2.0));
    }

    private double calculateCompletenessScore(String content) {
        // Check for essential legal document components
        int score = 0;
        if (content.contains("WHEREAS") || content.contains("THEREFORE")) score += 20;
        if (content.matches(".*\\d{4}.*")) score += 10; // Contains year
        if (content.matches(".*[A-Z]{2,}.*")) score += 20; // Contains legal formatting
        if (content.length() > 1000) score += 30;
        if (content.split("\\n").length > 10) score += 20; // Multiple paragraphs
        return Math.min(100.0, score);
    }

    private double calculateOverallQualityScore(Map<String, Object> metrics) {
        double formality = (Double) metrics.get("formalityScore");
        double completeness = (Double) metrics.get("completenessScore");
        int wordCount = (Integer) metrics.get("wordCount");
        
        double lengthScore = Math.min(100.0, wordCount / 10.0); // 1000 words = 100 points
        
        return (formality * 0.3 + completeness * 0.4 + lengthScore * 0.3);
    }

    private String getQualityGrade(double score) {
        if (score >= 90) return "A";
        if (score >= 80) return "B";
        if (score >= 70) return "C";
        if (score >= 60) return "D";
        return "F";
    }
}