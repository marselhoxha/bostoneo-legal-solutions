package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Defines all AI operation types for the centralized routing system.
 * Each operation maps to a default model (Sonnet or Opus) and caching strategy.
 */
public enum AIOperationType {

    // === Sonnet-tier: Fast, cost-effective operations ===
    QUICK_QUERY(ModelTier.SONNET, true, 3),
    CLASSIFICATION(ModelTier.SONNET, true, 30),
    SUMMARIZATION(ModelTier.SONNET, true, 7),
    TEMPLATE_FILLING(ModelTier.SONNET, true, 7),
    TEMPLATE_SUGGESTION(ModelTier.SONNET, true, 7),
    STYLE_APPLICATION(ModelTier.SONNET, false, 0),
    JURISDICTION_FORMATTING(ModelTier.SONNET, false, 0),
    SUGGESTION_GENERATION(ModelTier.SONNET, true, 3),
    QUESTION_ANSWERING(ModelTier.SONNET, true, 3),
    COLLECTION_QA(ModelTier.SONNET, true, 7),
    COLLECTION_COMPARISON(ModelTier.SONNET, true, 7),
    TRANSFORMATION_SIMPLE(ModelTier.SONNET, false, 0),

    // === Opus-tier: Quality-critical operations ===
    TRANSFORMATION_COMPLEX(ModelTier.OPUS, false, 0),
    DRAFT_GENERATION(ModelTier.OPUS, false, 0),
    DRAFT_GENERATION_STREAMING(ModelTier.OPUS, false, 0),
    STRATEGIC_ANALYSIS(ModelTier.OPUS, false, 0),
    DOCUMENT_ANALYSIS(ModelTier.OPUS, false, 0),
    CONTRACT_ANALYSIS(ModelTier.OPUS, false, 0),
    CASE_OUTCOME_PREDICTION(ModelTier.OPUS, false, 0),
    DOCUMENT_ENHANCEMENT(ModelTier.OPUS, false, 0),
    TEMPLATE_ENHANCEMENT(ModelTier.OPUS, false, 0),
    TEMPLATE_MERGE(ModelTier.OPUS, false, 0),
    DOCUMENT_GENERATION(ModelTier.OPUS, false, 0),
    SYNTHESIS(ModelTier.OPUS, false, 0),

    // === Sonnet-tier: Research operations (already on Sonnet in agentic loop) ===
    LEGAL_RESEARCH_AGENTIC(ModelTier.SONNET, true, 7),
    LEGAL_RESEARCH(ModelTier.SONNET, true, 7),
    RESEARCH_ANALYSIS(ModelTier.SONNET, true, 7),
    CONVERSATION(ModelTier.SONNET, false, 0);

    private final ModelTier defaultModelTier;
    private final boolean cacheable;
    private final int cacheTtlDays;

    AIOperationType(ModelTier defaultModelTier, boolean cacheable, int cacheTtlDays) {
        this.defaultModelTier = defaultModelTier;
        this.cacheable = cacheable;
        this.cacheTtlDays = cacheTtlDays;
    }

    public ModelTier getDefaultModelTier() {
        return defaultModelTier;
    }

    public boolean isCacheable() {
        return cacheable;
    }

    public int getCacheTtlDays() {
        return cacheTtlDays;
    }

    public boolean isOpusTier() {
        return defaultModelTier == ModelTier.OPUS;
    }

    public boolean isSonnetTier() {
        return defaultModelTier == ModelTier.SONNET;
    }

    public enum ModelTier {
        SONNET("claude-sonnet-4-6"),
        OPUS("claude-opus-4-6");

        private final String modelId;

        ModelTier(String modelId) {
            this.modelId = modelId;
        }

        public String getModelId() {
            return modelId;
        }
    }
}
