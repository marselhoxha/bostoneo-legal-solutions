package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Snapshot of a template-import session returned to the frontend for polling.
 * The frontend polls every 2s while files transition from QUEUED → EXTRACTING → ANALYZING → READY/ERROR.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportSessionResponse {

    private UUID sessionId;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private List<FileStatus> files;

    /** Convenience: true when every file has left the processing states (READY or ERROR). */
    private boolean allFinalized;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FileStatus {
        public enum Status { QUEUED, EXTRACTING, ANALYZING, READY, ERROR, DUPLICATE }

        private String fileId;               // stable per-session id for frontend cross-referencing
        private String filename;
        private Status status;
        private String errorCode;            // null unless status=ERROR; from TemplateImportException.Code
        private String errorMessage;
        private String contentHash;          // null until extraction succeeds
        private Long duplicateOfTemplateId;  // populated when status=DUPLICATE, points to existing template
        private String duplicateOfTemplateName;
        private TemplateAnalysisResult analysis; // populated when status=READY

        // Sprint 1.6 — binary preview availability signal for the wizard.
        // Lets the UI branch between "fetch transformed bytes and render 1:1" vs. "fall back to text preview"
        // without guessing. True only when the import pipeline successfully produced a token-bearing binary.
        private Boolean hasBinaryTemplate;
        private String binaryFormat;         // "DOCX" | "PDF" — null when hasBinaryTemplate=false
    }
}
