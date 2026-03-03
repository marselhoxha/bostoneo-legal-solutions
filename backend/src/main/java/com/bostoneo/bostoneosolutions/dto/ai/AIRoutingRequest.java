package com.bostoneo.bostoneosolutions.dto.ai;

import com.bostoneo.bostoneosolutions.enumeration.AIOperationType;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Request object for the centralized AIRequestRouter.
 * Wraps everything the router needs to make model/mode/cache decisions.
 */
@Data
@Builder
public class AIRoutingRequest {

    /** The type of AI operation being performed */
    private AIOperationType operationType;

    /** The prompt or query text */
    private String query;

    /** Optional system message for high-priority instructions */
    private String systemMessage;

    /** Optional conversation history for context-aware responses */
    private List<Map<String, Object>> conversationHistory;

    /** Optional case ID for case-scoped operations */
    private String caseId;

    /** Optional session ID for cancellation support */
    private Long sessionId;

    /** Optional temperature override (0.0 = deterministic, null = default) */
    private Double temperature;

    /** Whether this operation benefits from deep thinking (extended reasoning) */
    private boolean useDeepThinking;

    /** Optional: transformation type for TRANSFORMATION operations (SIMPLIFY, CONDENSE, EXPAND, etc.) */
    private String transformationType;
}
