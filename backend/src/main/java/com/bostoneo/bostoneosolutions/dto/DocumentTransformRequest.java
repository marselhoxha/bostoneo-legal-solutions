package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentTransformRequest {
    private Long documentId;
    private String transformationType; // SIMPLIFY, CONDENSE, EXPAND, FORMAL, PERSUASIVE, REDRAFT
    private String transformationScope; // FULL_DOCUMENT or SELECTION

    // For full document transformation
    private String fullDocumentContent;

    // For selection-based transformation
    private String selectedText;
    private Integer selectionStartIndex;
    private Integer selectionEndIndex;

    // Context information
    private String jurisdiction;
    private String documentType;
    private Long caseId;
}
