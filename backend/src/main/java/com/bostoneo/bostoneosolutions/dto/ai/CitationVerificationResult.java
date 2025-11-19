package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result of citation verification via CourtListener API
 * Used to validate legal citations and prevent hallucinations
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CitationVerificationResult {

    /**
     * Whether the citation was found in CourtListener database
     */
    private boolean found;

    /**
     * Full case name (e.g., "Bell Atlantic Corp. v. Twombly")
     */
    private String caseName;

    /**
     * Original citation provided (e.g., "550 U.S. 544")
     */
    private String citation;

    /**
     * CourtListener URL to the case
     */
    private String url;

    /**
     * Court identifier (e.g., "scotus", "ca1", "mad")
     */
    private String courtId;

    /**
     * Date the case was filed
     */
    private String dateFiled;

    /**
     * CourtListener opinion ID
     */
    private String opinionId;

    /**
     * CourtListener cluster ID
     */
    private String clusterId;

    /**
     * Error message if verification failed
     */
    private String errorMessage;

    /**
     * Whether this is a partial match (case name found but citation might differ)
     */
    private boolean partialMatch;

    /**
     * Confidence score for the match (0.0 to 1.0)
     */
    private Double confidenceScore;
}
