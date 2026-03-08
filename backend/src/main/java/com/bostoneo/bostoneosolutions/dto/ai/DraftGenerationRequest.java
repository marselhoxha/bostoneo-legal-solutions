package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftGenerationRequest {
    private Long userId;
    private Long caseId;  // Nullable - null for general drafts
    private String prompt;
    private String documentType;
    private String jurisdiction;
    private String sessionName;
    private Long conversationId;  // Optional - if provided, use existing conversation instead of creating new one
    private String researchMode;  // Research mode: FAST or THOROUGH
    private Long documentId;  // Optional - workspace document ID for including exhibits in prompt
    private Long stationeryTemplateId;  // Optional — for first-gen stationery awareness
    private Long stationeryAttorneyId;  // Optional — for first-gen stationery awareness
}
