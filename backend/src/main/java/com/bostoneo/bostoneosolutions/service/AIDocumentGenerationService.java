package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.model.AIDocumentGenerationLog;
import com.bostoneo.bostoneosolutions.enumeration.GenerationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface AIDocumentGenerationService {
    
    // Template Management
    AILegalTemplate createTemplate(AILegalTemplate template);
    AILegalTemplate updateTemplate(Long id, AILegalTemplate template);
    AILegalTemplate getTemplateById(Long id);
    Page<AILegalTemplate> getTemplatesByCategory(String category, Pageable pageable);
    Page<AILegalTemplate> getTemplatesByPracticeArea(String practiceArea, Pageable pageable);
    Page<AILegalTemplate> getMassachusettsTemplates(Pageable pageable);
    List<AILegalTemplate> getPopularTemplates(int limit);
    void deleteTemplate(Long id);
    
    // Document Generation
    CompletableFuture<String> generateDocument(Long templateId, Map<String, Object> variables, Long userId, Long caseId);
    CompletableFuture<String> autoFillTemplate(Long templateId, Long caseId, Long userId);
    CompletableFuture<List<String>> batchGenerateDocuments(List<Long> templateIds, Map<String, Object> variables, Long userId, Long caseId);
    CompletableFuture<String> mergeTemplates(List<Long> templateIds, Map<String, Object> variables, Long userId);
    
    // Template Analysis
    CompletableFuture<Map<String, Object>> analyzeTemplateVariables(Long templateId);
    CompletableFuture<List<String>> suggestTemplates(String description, String practiceArea);
    CompletableFuture<Map<String, Object>> validateTemplateData(Long templateId, Map<String, Object> variables);
    
    // Generation History
    Page<AIDocumentGenerationLog> getGenerationHistory(Long userId, Pageable pageable);
    Page<AIDocumentGenerationLog> getTemplateUsageStats(Long templateId, Pageable pageable);
    AIDocumentGenerationLog saveGenerationLog(Long templateId, Long userId, Long caseId, GenerationType type, 
                                              Map<String, Object> inputData, String result, boolean success);
    
    // Style Guide Integration
    CompletableFuture<String> applyStyleGuide(String content, Long styleGuideId);
    CompletableFuture<String> formatDocumentForMassachusetts(String content, String documentType);
    
    // AI Enhancement
    CompletableFuture<String> enhanceDocumentWithAI(String content, String improvementType);
    CompletableFuture<List<String>> getSuggestions(String content, String context);
    CompletableFuture<Map<String, Object>> calculateDocumentQuality(String content);
}