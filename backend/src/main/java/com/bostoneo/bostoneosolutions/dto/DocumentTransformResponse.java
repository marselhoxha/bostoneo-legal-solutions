package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentTransformResponse {
    private Long documentId;
    private Integer newVersion;
    private String transformedContent; // Full document content after transformation
    private String transformedSelection; // For selection scope: only the transformed snippet (not full doc)
    private String explanation; // AI explanation of what was changed
    private Integer tokensUsed;
    private BigDecimal costEstimate;
    private Integer wordCount;
    private String transformationType;
    private String transformationScope;
}
