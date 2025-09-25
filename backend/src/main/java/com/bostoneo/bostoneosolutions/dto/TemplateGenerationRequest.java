package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.DocumentContextType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateGenerationRequest {
    private Long templateId;
    private DocumentContextType contextType;
    private Long caseId; // Optional - for CASE context
    private Long clientId; // Optional - for CLIENT context
    private List<Long> caseIds; // Optional - for MULTI_CASE context
    private Map<String, String> userInputs; // Manual inputs or overrides
    private Map<String, Object> externalData; // For EXTERNAL context
    private boolean useAiSuggestions;
    private boolean useAiEnhancement;
    private String outputFormat; // PDF, DOCX, HTML, etc.
}