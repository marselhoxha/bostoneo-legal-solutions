package com.bostoneo.bostoneosolutions.service.ai.importing;

import com.bostoneo.bostoneosolutions.dto.ai.ImportSessionResponse;
import com.bostoneo.bostoneosolutions.dto.ai.TemplateAnalysisResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

/**
 * In-memory state for a single template-import review session.
 *
 * <p>Scoped to one {organizationId, userId} pair. Expires after 5 minutes of inactivity —
 * templates are either committed within that window or the session is discarded.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportSession {

    private UUID sessionId;
    private Long organizationId;
    private Long userId;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    @Builder.Default
    private ConcurrentMap<String, SessionFile> files = new ConcurrentHashMap<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionFile {
        private String fileId;
        private String filename;
        private ImportSessionResponse.FileStatus.Status status;
        private String errorCode;
        private String errorMessage;
        private String contentHash;
        private Long duplicateOfTemplateId;
        private String duplicateOfTemplateName;
        private TemplateAnalysisResult analysis;
        private ExtractedDocument extracted; // keep raw text until commit so variable substitutions can re-run

        // Sprint 1.6 — visual-fidelity template cache. Populated after Claude analysis; committed to the binary columns.
        private byte[] originalBytes;       // pristine uploaded bytes (DOCX/PDF)
        private byte[] transformedBytes;    // same bytes with raw values swapped for {{tokens}} — null if transform was skipped
        private String binaryFormat;        // "DOCX" | "PDF" (null when no binary path was taken)
    }

    public boolean isExpired(LocalDateTime now) {
        return expiresAt != null && now.isAfter(expiresAt);
    }

    public ImportSessionResponse toResponse() {
        List<ImportSessionResponse.FileStatus> fileList = files.values().stream()
            .map(f -> ImportSessionResponse.FileStatus.builder()
                .fileId(f.getFileId())
                .filename(f.getFilename())
                .status(f.getStatus())
                .errorCode(f.getErrorCode())
                .errorMessage(f.getErrorMessage())
                .contentHash(f.getContentHash())
                .duplicateOfTemplateId(f.getDuplicateOfTemplateId())
                .duplicateOfTemplateName(f.getDuplicateOfTemplateName())
                .analysis(f.getAnalysis())
                // Sprint 1.6 — expose visual-fidelity binary availability to the wizard.
                // Transformed bytes are what the preview endpoint streams; originalBytes alone
                // would indicate a successful upload but not a successful tokenization pass.
                .hasBinaryTemplate(f.getTransformedBytes() != null && f.getBinaryFormat() != null)
                .binaryFormat(f.getBinaryFormat())
                .build())
            .collect(Collectors.toList());

        boolean allFinalized = files.values().stream().allMatch(f ->
            f.getStatus() == ImportSessionResponse.FileStatus.Status.READY ||
            f.getStatus() == ImportSessionResponse.FileStatus.Status.ERROR ||
            f.getStatus() == ImportSessionResponse.FileStatus.Status.DUPLICATE);

        return ImportSessionResponse.builder()
            .sessionId(sessionId)
            .createdAt(createdAt)
            .expiresAt(expiresAt)
            .files(fileList)
            .allFinalized(allFinalized)
            .build();
    }
}
