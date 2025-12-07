package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoldSignDashboardDTO {
    private int waitingForMe;
    private int waitingForOthers;
    private int needsAttention;
    private int completed;
    private int revoked;
    private int totalDocuments;
    private int sentThisMonth;
    private int receivedThisMonth;

    private List<DocumentSummaryDTO> waitingForOthersList;
    private List<DocumentSummaryDTO> needsAttentionList;
    private List<DocumentSummaryDTO> recentActivityList;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DocumentSummaryDTO {
        private String documentId;
        private String title;
        private String signerName;
        private String signerEmail;
        private String status;
        private String statusMessage;
        private String createdDate;
    }
}
