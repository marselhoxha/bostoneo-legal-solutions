package com.bostoneo.bostoneosolutions.service.ai;

import java.util.concurrent.CompletableFuture;

public interface AIService {
    
    /**
     * Generate text completion using AI model
     */
    CompletableFuture<String> generateCompletion(String prompt, boolean useDeepThinking);
    
    /**
     * Summarize document content
     */
    CompletableFuture<String> summarizeDocument(String content, String documentType);
    
    /**
     * Analyze contract for risks and compliance
     */
    CompletableFuture<String> analyzeContract(String contractText);
    
    /**
     * Classify case by type and complexity
     */
    CompletableFuture<String> classifyCase(String caseDescription);
    
    /**
     * Predict case outcome
     */
    CompletableFuture<String> predictCaseOutcome(String caseDetails, String jurisdiction);
}