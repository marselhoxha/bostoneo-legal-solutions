package com.bostoneo.bostoneosolutions.service.ai.implementation;

import com.bostoneo.bostoneosolutions.dto.ai.ContractRiskAssessment;
import com.bostoneo.bostoneosolutions.service.ai.ContractAnalysisService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractAnalysisServiceImpl implements ContractAnalysisService {
    
    private final ClaudeSonnet4Service claudeService;

    @Override
    public CompletableFuture<ContractRiskAssessment> analyzeContract(String contractText) {
        String prompt = createContractAnalysisPrompt(contractText);
        
        return claudeService.generateCompletion(prompt, true)
            .thenApply(this::parseRiskAssessment)
            .exceptionally(throwable -> {
                log.error("Contract analysis failed", throwable);
                return createErrorResponse("Analysis failed: " + throwable.getMessage());
            });
    }

    @Override
    public CompletableFuture<ContractRiskAssessment> quickRiskScan(String contractText) {
        String prompt = createQuickScanPrompt(contractText);
        
        return claudeService.generateCompletion(prompt, false)
            .thenApply(this::parseRiskAssessment)
            .exceptionally(throwable -> {
                log.error("Quick risk scan failed", throwable);
                return createErrorResponse("Quick scan failed: " + throwable.getMessage());
            });
    }

    @Override
    public CompletableFuture<String> extractKeyTerms(String contractText) {
        String prompt = String.format("""
            Extract and list the key terms from this contract. Focus on:
            - Financial terms (amounts, payment schedules)
            - Duration and deadlines
            - Obligations and responsibilities
            - Termination conditions
            - Liability clauses
            
            Format as a clean bullet list.
            
            Contract: %s
            """, contractText);
            
        return claudeService.generateCompletion(prompt, false);
    }

    @Override
    public CompletableFuture<String> checkCompliance(String contractText, String jurisdiction) {
        String prompt = String.format("""
            Review this contract for compliance issues in %s jurisdiction:
            
            Check for:
            - Regulatory compliance
            - Statutory requirements
            - Industry standards
            - Required disclosures
            
            Provide specific compliance recommendations.
            
            Contract: %s
            """, jurisdiction, contractText);
            
        return claudeService.generateCompletion(prompt, true);
    }

    private String createContractAnalysisPrompt(String contractText) {
        return String.format("""
            Perform a comprehensive risk analysis of this contract. Provide a structured response with:
            
            RISK SCORE: (0-100)
            RISK LEVEL: (LOW/MEDIUM/HIGH/CRITICAL)
            
            SUMMARY: Brief overview of the contract and main concerns
            
            RISKS:
            - Category | Description | Severity (1-10) | Impact | Mitigation
            
            MISSING CLAUSES:
            - List any standard clauses that should be included
            
            KEY TERMS:
            - Important financial, timeline, and obligation terms
            
            COMPLIANCE ISSUES:
            - Regulation | Description | Severity | Remedy
            
            RECOMMENDATIONS:
            - Specific actions to reduce risks
            
            Contract Text:
            %s
            """, contractText);
    }

    private String createQuickScanPrompt(String contractText) {
        return String.format("""
            Quick risk assessment of this contract. Provide:
            
            RISK SCORE: (0-100)
            RISK LEVEL: (LOW/MEDIUM/HIGH/CRITICAL)
            
            TOP 3 RISKS:
            1. Risk description and impact
            2. Risk description and impact  
            3. Risk description and impact
            
            IMMEDIATE CONCERNS:
            - Most urgent issues requiring attention
            
            Contract: %s
            """, contractText);
    }

    private ContractRiskAssessment parseRiskAssessment(String aiResponse) {
        ContractRiskAssessment assessment = new ContractRiskAssessment();
        
        try {
            // Parse AI response and extract structured data
            String[] lines = aiResponse.split("\n");
            
            for (String line : lines) {
                if (line.startsWith("RISK SCORE:")) {
                    assessment.setOverallRiskScore(extractNumber(line, 50));
                } else if (line.startsWith("RISK LEVEL:")) {
                    assessment.setRiskLevel(extractRiskLevel(line));
                } else if (line.startsWith("SUMMARY:")) {
                    assessment.setSummary(line.substring(8).trim());
                }
            }
            
            // Set defaults if parsing fails
            if (assessment.getOverallRiskScore() == 0) {
                assessment.setOverallRiskScore(50);
            }
            if (assessment.getRiskLevel() == null) {
                assessment.setRiskLevel("MEDIUM");
            }
            if (assessment.getSummary() == null) {
                assessment.setSummary(aiResponse.length() > 500 ? 
                    aiResponse.substring(0, 500) + "..." : aiResponse);
            }
            
            assessment.setRecommendations("Review the analysis above for detailed recommendations.");
            
        } catch (Exception e) {
            log.error("Failed to parse AI response", e);
            return createErrorResponse("Failed to parse analysis results");
        }
        
        return assessment;
    }

    private int extractNumber(String line, int defaultValue) {
        try {
            String numberStr = line.replaceAll("[^0-9]", "");
            return numberStr.isEmpty() ? defaultValue : Math.min(100, Integer.parseInt(numberStr));
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private String extractRiskLevel(String line) {
        String upper = line.toUpperCase();
        if (upper.contains("LOW")) return "LOW";
        if (upper.contains("HIGH")) return "HIGH";
        if (upper.contains("CRITICAL")) return "CRITICAL";
        return "MEDIUM";
    }

    private ContractRiskAssessment createErrorResponse(String error) {
        ContractRiskAssessment assessment = new ContractRiskAssessment();
        assessment.setOverallRiskScore(0);
        assessment.setRiskLevel("UNKNOWN");
        assessment.setSummary("Analysis failed: " + error);
        assessment.setRecommendations("Please try again or contact support.");
        return assessment;
    }
}