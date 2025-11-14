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
}
