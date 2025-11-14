package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftGenerationResponse {
    private Long conversationId;
    private Long documentId;
    private DocumentDTO document;
    private ConversationDTO conversation;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DocumentDTO {
        private Long id;
        private Long caseId;
        private String title;
        private String content;
        private Integer wordCount;
        private Integer version;
        private Integer tokensUsed;
        private BigDecimal costEstimate;
        private LocalDateTime generatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConversationDTO {
        private Long id;
        private Long caseId;
        private String sessionName;
        private String taskType;
        private String relatedDraftId;
        private LocalDateTime createdAt;
    }
}
