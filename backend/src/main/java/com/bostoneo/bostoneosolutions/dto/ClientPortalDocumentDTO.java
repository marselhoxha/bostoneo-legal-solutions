package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientPortalDocumentDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String caseName;
    private String title;
    private String fileName;
    private String fileType;
    private String category;
    private String description;
    private Long fileSize;
    private LocalDateTime uploadedAt;
    private String uploadedBy;
    private boolean canDownload;
}
