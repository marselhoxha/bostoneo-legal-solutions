package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

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

    /**
     * For diff-based transformations (CONDENSE, SIMPLIFY):
     * Contains find/replace pairs instead of full document content.
     * Frontend applies these diffs programmatically for 80-90% token savings.
     * If null/empty, use transformedContent for full document replacement.
     */
    private List<DocumentChange> changes;

    /**
     * Indicates whether diff-based transformation was used.
     * If true, frontend should apply changes[] instead of transformedContent.
     */
    private Boolean useDiffMode;
}
