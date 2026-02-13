package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseDocumentSummary {
    private Long id;
    private String name;
    private String category;
    private String extension;
    private Long sizeBytes;
    private String fileType;
}
