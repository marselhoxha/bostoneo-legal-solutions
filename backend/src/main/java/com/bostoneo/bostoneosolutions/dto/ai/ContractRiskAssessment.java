package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.Data;
import java.util.List;

@Data
public class ContractRiskAssessment {
    private int overallRiskScore; // 0-100
    private String riskLevel; // LOW, MEDIUM, HIGH, CRITICAL
    private String summary;
    private List<RiskItem> risks;
    private List<String> missingClauses;
    private List<String> keyTerms;
    private List<ComplianceIssue> complianceIssues;
    private String recommendations;
    
    @Data
    public static class RiskItem {
        private String category;
        private String description;
        private int severity; // 1-10
        private String impact;
        private String mitigation;
    }
    
    @Data
    public static class ComplianceIssue {
        private String regulation;
        private String description;
        private String severity;
        private String remedy;
    }
}