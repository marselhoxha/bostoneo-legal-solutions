package com.bostoneo.bostoneosolutions.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentAnalysisService {

    private final AIService aiService;

    public CompletableFuture<String> analyzeDocument(String content, String documentType, String analysisType) {
        log.info("Analyzing document of type: {} with analysis: {}", documentType, analysisType);
        
        return switch (analysisType.toLowerCase()) {
            case "summary" -> aiService.summarizeDocument(content, documentType);
            case "contract_risk" -> aiService.analyzeContract(content);
            case "classification" -> aiService.classifyCase(content);
            default -> CompletableFuture.completedFuture("Unsupported analysis type: " + analysisType);
        };
    }

    public CompletableFuture<String> quickSummary(String content) {
        String prompt = String.format("""
            Provide a quick 3-sentence summary of this document:
            
            %s
            """, content);
        
        return aiService.generateCompletion(prompt, false);
    }

    public CompletableFuture<String> extractKeyTerms(String content) {
        String prompt = String.format("""
            Extract key legal terms and important information from this document:
            
            1. Names and parties involved
            2. Important dates
            3. Dollar amounts
            4. Key obligations
            5. Critical deadlines
            
            Document:
            %s
            """, content);
        
        return aiService.generateCompletion(prompt, false);
    }

    public CompletableFuture<String> riskAssessment(String content) {
        String prompt = String.format("""
            Perform a risk assessment of this legal document:
            
            1. High-risk items (immediate attention needed)
            2. Medium-risk items (should be reviewed)
            3. Low-risk items (for awareness)
            4. Overall risk score (1-10)
            5. Recommended next steps
            
            Document:
            %s
            """, content);
        
        return aiService.generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> draftLegalMemo(String topic, String jurisdiction, String keyFacts) {
        String prompt = String.format("""
            Write a brief legal memo about: %s
            Jurisdiction: %s
            Key facts: %s
            """, topic, jurisdiction, keyFacts);
        
        return aiService.generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> searchCaseLaw(String query, String jurisdiction) {
        String prompt = String.format("""
            Search for relevant case law on: %s
            Jurisdiction: %s
            
            Provide:
            1. Relevant cases with citations
            2. Key holdings
            3. Precedential value
            4. Application to current issue
            5. Strategic considerations
            """, query, jurisdiction);
        
        return aiService.generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> interpretStatute(String statuteText, String jurisdiction) {
        String prompt = String.format("""
            Interpret this statute from %s:
            
            %s
            
            Provide:
            1. Plain language summary
            2. Key elements
            3. Common interpretations
            4. Practical applications
            5. Potential arguments
            """, jurisdiction, statuteText);
        
        return aiService.generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> findPrecedents(String caseDescription, String practiceArea) {
        String prompt = String.format("""
            Find legal precedents for this case:
            Practice Area: %s
            
            Case: %s
            
            Identify:
            1. Similar cases
            2. Applicable precedents
            3. Distinguishing factors
            4. Strategic considerations
            5. Strength of precedents
            """, practiceArea, caseDescription);
        
        return aiService.generateCompletion(prompt, true);
    }
}