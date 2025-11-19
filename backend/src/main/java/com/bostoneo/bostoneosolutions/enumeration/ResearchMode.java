package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Research mode for AI legal research queries
 *
 * FAST: Quick answers without citations (15-20s, ~$0.15)
 *   - Uses AI's built-in legal knowledge
 *   - No citation verification (prevents hallucinations by blocking all citations)
 *   - Best for: Strategy discussions, procedural questions, timeline calculations
 *
 * THOROUGH: Verified citations via CourtListener (60-180s, ~$2-4)
 *   - Agentic tool-calling with citation verification
 *   - All citations validated against primary sources
 *   - Best for: Court filings, demand letters, regulatory compliance
 */
public enum ResearchMode {
    FAST,      // Quick answers without citations
    THOROUGH   // Verified citations with CourtListener
}
