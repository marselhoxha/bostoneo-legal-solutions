package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a single diff change for token-efficient document transformations.
 * Used for simple transformations (CONDENSE, SIMPLIFY) where AI returns find/replace pairs
 * instead of regenerating the entire document.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentChange {
    /**
     * The exact text to find in the original document
     */
    private String find;

    /**
     * The replacement text
     */
    private String replace;

    /**
     * Optional: starting index in the document (for positional accuracy)
     */
    private Integer startIndex;

    /**
     * Optional: explanation of why this change was made
     */
    private String reason;
}
