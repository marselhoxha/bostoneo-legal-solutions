package com.bostoneo.bostoneosolutions.model;

import lombok.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiWorkspaceDocumentExhibit {

    private Long id;
    private Long documentId;
    private Long organizationId;
    private Long caseDocumentId;
    private String label;
    @Builder.Default
    private Integer displayOrder = 0;
    private String fileName;
    private String filePath;
    private String mimeType;
    private Long fileSize;
    private String extractedText;
    @Builder.Default
    private String textExtractionStatus = "PENDING";
    private Integer pageCount;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
