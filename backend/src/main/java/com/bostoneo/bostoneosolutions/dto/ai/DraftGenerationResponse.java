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

        // §6.1 gating metadata — surfaced to the UI so it can render
        // badges/chips, route to "needs review" queues, or suppress
        // production-only actions (e.g. e-file button) for draft templates.
        private String approvalStatus;            // "draft" | "in_review" | "attorney_reviewed" | "production_ready" | null
        private Boolean isVerificationOverdue;    // true when today > nextReviewDue
        private String templateVersion;           // e.g. "2026.04.23-draft"
        private String lastVerified;              // ISO date string (source of truth: JSON file)
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
