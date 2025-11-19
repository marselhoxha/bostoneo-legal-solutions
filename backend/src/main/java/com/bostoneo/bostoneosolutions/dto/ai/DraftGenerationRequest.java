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
}
