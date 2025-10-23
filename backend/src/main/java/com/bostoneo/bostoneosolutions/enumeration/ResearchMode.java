package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Research mode for AI legal research queries
 * FAST: Pre-fetch external APIs, quick response (10-20s, ~$0.50)
 * THOROUGH: Agentic tool-calling, citation verification (60-180s, ~$2-4)
 * AUTO: Automatically select FAST or THOROUGH based on query complexity
 */
public enum ResearchMode {
    FAST,      // Current system - pre-fetch APIs
    THOROUGH,  // Agentic with tools - iterative research
    AUTO       // Smart mode selection
}
