package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.ContractRiskAssessment;
import java.util.concurrent.CompletableFuture;

public interface ContractAnalysisService {
    
    CompletableFuture<ContractRiskAssessment> analyzeContract(String contractText);
    CompletableFuture<ContractRiskAssessment> quickRiskScan(String contractText);
    CompletableFuture<String> extractKeyTerms(String contractText);
    CompletableFuture<String> checkCompliance(String contractText, String jurisdiction);
}