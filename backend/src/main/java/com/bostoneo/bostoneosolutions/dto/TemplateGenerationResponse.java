package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateGenerationResponse {
    private Long templateId;
    private String templateName;
    private String generatedContent;
    private Map<String, String> appliedVariables;
    private List<AiSuggestion> aiSuggestions;
    private String contextType;
    private LocalDateTime generatedAt;
    private String outputFormat;
    private boolean aiEnhanced;
    private List<String> warnings;
    private List<String> complianceChecks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiSuggestion {
        private String variableName;
        private String suggestedValue;
        private String reasoning;
        private double confidenceScore;
        private String source; // e.g., "Previous document", "Client profile", "Common pattern"
    }
}