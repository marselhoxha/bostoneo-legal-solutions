package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.Builder;
import lombok.Data;

/**
 * Result object from the centralized AIRequestRouter.
 * Wraps the AI response with routing metadata for logging/metrics.
 */
@Data
@Builder
public class AIRoutingResult {

    /** The AI-generated text response */
    private String response;

    /** Which model was actually used (e.g., "claude-sonnet-4-6") */
    private String modelUsed;

    /** Which mode was selected (FAST or THOROUGH) */
    private String modeUsed;

    /** Estimated tokens used (input + output) */
    private int tokensUsed;

    /** Estimated cost in USD */
    private double estimatedCost;

    /** Whether this result came from cache */
    private boolean cacheHit;

    /** The operation type that was routed */
    private String operationType;
}
