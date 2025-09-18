package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.config.AIConfig;
import com.bostoneo.bostoneosolutions.dto.ai.AIRequest;
import com.bostoneo.bostoneosolutions.dto.ai.AIResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClaudeSonnet4Service implements AIService {

    private final WebClient anthropicWebClient;
    private final AIConfig aiConfig;
    
    @Override
    public CompletableFuture<String> generateCompletion(String prompt, boolean useDeepThinking) {
        AIRequest request = createRequest(prompt, useDeepThinking);
        
        log.info("=== SENDING REQUEST TO ANTHROPIC ===");
        log.info("Model: {}", request.getModel());
        log.info("Max tokens: {}", request.getMax_tokens());
        log.info("Prompt length: {}", prompt.length());
        
        String apiKey = aiConfig.getApiKey();
        log.info("API Key being used: {}", apiKey.isEmpty() ? "EMPTY!" : apiKey.substring(0, Math.min(20, apiKey.length())) + "...");
        
        return anthropicWebClient
                .post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)  // Inject API key per request
                .bodyValue(request)
                .exchangeToMono(response -> {
                    log.info("Response status: {}", response.statusCode());
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(AIResponse.class);
                    } else {
                        return response.bodyToMono(String.class)
                                .flatMap(body -> {
                                    log.error("Error response from Anthropic: {}", body);
                                    return Mono.error(new RuntimeException("API Error: " + body));
                                });
                    }
                })
                .map(this::extractTextFromResponse)
                .onErrorMap(e -> {
                    log.error("Error calling Claude API: {}", e.getMessage(), e);
                    return new RuntimeException("AI service unavailable: " + e.getMessage(), e);
                })
                .toFuture();
    }

    @Override
    public CompletableFuture<String> summarizeDocument(String content, String documentType) {
        String prompt = String.format("""
            You are a legal AI assistant. Summarize this %s document in a structured format.
            
            Provide:
            1. Overview (2-3 sentences)
            2. Key Terms (bullet points)
            3. Important Dates
            4. Obligations & Rights
            5. Potential Risks
            
            Document:
            %s
            """, documentType, content);
        
        return generateCompletion(prompt, false);
    }

    @Override
    public CompletableFuture<String> analyzeContract(String contractText) {
        String prompt = String.format("""
            Analyze this contract for legal risks and compliance. Provide:
            
            1. Risk Assessment (High/Medium/Low with explanations)
            2. Missing Standard Clauses
            3. Compliance Issues
            4. Key Terms Analysis
            5. Recommended Actions
            
            Contract:
            %s
            """, contractText);
        
        return generateCompletion(prompt, true); // Use deep thinking for complex analysis
    }

    @Override
    public CompletableFuture<String> classifyCase(String caseDescription) {
        String prompt = String.format("""
            Classify this legal case. Provide:
            
            1. Practice Area (e.g., Personal Injury, Corporate, Criminal)
            2. Complexity Level (Low/Medium/High)
            3. Urgency Level (Low/Medium/High)
            4. Estimated Duration
            5. Recommended Attorney Type
            
            Case Description:
            %s
            """, caseDescription);
        
        return generateCompletion(prompt, false);
    }

    @Override
    public CompletableFuture<String> predictCaseOutcome(String caseDetails, String jurisdiction) {
        String prompt = String.format("""
            Analyze this case and provide outcome predictions:
            
            1. Settlement Probability (percentage)
            2. Trial Probability (percentage)
            3. Success Rate Estimate
            4. Timeline Prediction
            5. Key Factors Affecting Outcome
            
            Jurisdiction: %s
            Case Details:
            %s
            """, jurisdiction, caseDetails);
        
        return generateCompletion(prompt, true); // Use deep thinking for predictions
    }
    
    public CompletableFuture<String> draftLegalMemo(String topic, String jurisdiction, String keyFacts) {
        String prompt = String.format("""
            Draft a comprehensive legal memorandum on the following topic:
            
            TOPIC: %s
            JURISDICTION: %s
            KEY FACTS: %s
            
            Structure the memorandum as follows:
            
            MEMORANDUM
            
            TO: [Client/Attorney]
            FROM: Legal Research Assistant (AI)
            DATE: [Current Date]
            RE: %s
            
            I. EXECUTIVE SUMMARY
            [Brief overview of legal conclusions and recommendations]
            
            II. STATEMENT OF FACTS
            [Relevant facts based on provided information]
            
            III. ISSUES PRESENTED
            [Key legal questions to be addressed]
            
            IV. BRIEF ANSWERS
            [Short answers to each issue]
            
            V. DISCUSSION
            A. Legal Standard/Framework
            B. Application of Law to Facts
            C. Analysis of Strengths and Weaknesses
            D. Potential Counterarguments
            E. Recent Developments
            
            VI. CONCLUSION AND RECOMMENDATIONS
            [Summary of legal position and strategic advice]
            
            VII. RESEARCH RECOMMENDATIONS
            [Additional research that may be needed]
            
            Note: This memorandum is generated by AI for research purposes.
            """, topic, jurisdiction, keyFacts, topic);
        
        return generateCompletion(prompt, true);
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
            """, query, jurisdiction);
        
        return generateCompletion(prompt, true);
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
            """, jurisdiction, statuteText);
        
        return generateCompletion(prompt, true);
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
            """, practiceArea, caseDescription);
        
        return generateCompletion(prompt, true);
    }

    private AIRequest createRequest(String prompt, boolean useDeepThinking) {
        AIRequest request = new AIRequest();
        request.setModel("claude-sonnet-4-20250514");
        request.setMax_tokens(useDeepThinking ? 8000 : 4000);
        
        AIRequest.Message message = new AIRequest.Message();
        message.setRole("user");
        message.setContent(prompt);
        
        request.setMessages(new AIRequest.Message[]{message});
        return request;
    }

    private String extractTextFromResponse(AIResponse response) {
        if (response.getContent() != null && response.getContent().length > 0) {
            return response.getContent()[0].getText();
        }
        return "No response generated";
    }
}