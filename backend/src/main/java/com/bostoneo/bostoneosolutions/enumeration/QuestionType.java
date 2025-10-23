package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Question type classification for adaptive AI legal research responses.
 * Used to determine appropriate response format and level of detail.
 */
public enum QuestionType {
    /**
     * Initial comprehensive strategy question - requires full analysis with multiple arguments,
     * case law citations, procedural guidance, and risk assessment.
     * Examples: "What are the strongest arguments?", "How should we approach this case?"
     */
    INITIAL_STRATEGY,

    /**
     * Follow-up clarification question - user asking for more detail on a previously discussed topic.
     * Should reference prior conversation and provide focused clarification without repeating.
     * Examples: "Can you elaborate on that?", "What did you mean by...?"
     */
    FOLLOW_UP_CLARIFICATION,

    /**
     * Narrow technical question - specific question about a single legal concept, citation, or procedure.
     * Requires direct, focused answer (200-400 words) without full case analysis.
     * Examples: "What does IRC § 170(f) say?", "What is the deadline for X?"
     */
    NARROW_TECHNICAL,

    /**
     * Procedural guidance question - asks about court procedures, filing requirements, or deadlines.
     * Should provide step-by-step guidance with specific dates and forms.
     * Examples: "How do I file a motion?", "What are the steps for...?"
     */
    PROCEDURAL_GUIDANCE
}
