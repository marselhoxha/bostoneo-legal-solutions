package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service for predicting research costs before execution
 * Helps users make informed decisions about mode selection
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CostPredictionService {

    private final QuerySimilarityService similarityService;
    private final ResearchAnalyticsService analyticsService;
    private final com.bostoneo.bostoneosolutions.service.ai.AIComplexityScorer aiComplexityScorer;

    // Per-token costs (per 1K tokens) based on Claude API pricing
    private static final double SONNET_INPUT_COST_PER_1K = 0.003;   // $3.00 / 1M tokens
    private static final double SONNET_OUTPUT_COST_PER_1K = 0.015;  // $15.00 / 1M tokens
    private static final double OPUS_INPUT_COST_PER_1K = 0.015;     // $15.00 / 1M tokens
    private static final double OPUS_OUTPUT_COST_PER_1K = 0.075;    // $75.00 / 1M tokens

    // Estimated average tokens per query type
    private static final int AVG_INPUT_TOKENS = 2000;  // ~2K input tokens average
    private static final int AVG_OUTPUT_TOKENS = 1500;  // ~1.5K output tokens average

    // Derived base costs per model
    private static final double SONNET_BASE_COST =
        (AVG_INPUT_TOKENS / 1000.0) * SONNET_INPUT_COST_PER_1K +
        (AVG_OUTPUT_TOKENS / 1000.0) * SONNET_OUTPUT_COST_PER_1K; // ~$0.0285
    private static final double OPUS_BASE_COST =
        (AVG_INPUT_TOKENS / 1000.0) * OPUS_INPUT_COST_PER_1K +
        (AVG_OUTPUT_TOKENS / 1000.0) * OPUS_OUTPUT_COST_PER_1K;   // ~$0.1425

    private static final double TOOL_CALL_COST = 0.03; // Average per tool call (Sonnet-priced since agentic uses Sonnet)

    /**
     * Predict cost for a query using multi-model pricing.
     * Uses AIComplexityScorer to determine which model (Sonnet/Opus) and mode (FAST/THOROUGH)
     * would be auto-selected, then calculates cost accordingly.
     */
    public CostPrediction predictCost(String query, String mode, Long userId) {
        double estimatedCost;
        double minCost;
        double maxCost;
        String explanation;
        Map<String, Object> breakdown = new HashMap<>();

        // Determine actual model routing using AIComplexityScorer
        var decision = aiComplexityScorer.decide(
            com.bostoneo.bostoneosolutions.enumeration.AIOperationType.CONVERSATION, query);
        String autoMode = mode != null ? mode : decision.mode();
        boolean usesOpus = decision.isOpus();
        double baseCost = usesOpus ? OPUS_BASE_COST : SONNET_BASE_COST;
        String modelName = usesOpus ? "Opus" : "Sonnet";

        if ("THOROUGH".equalsIgnoreCase(autoMode)) {
            // THOROUGH mode: agentic research with tool calls (always uses Sonnet for tools)
            int estimatedToolCalls = estimateToolCalls(query);

            // Base analysis cost + tool call costs (tool calls use Sonnet)
            minCost = baseCost;
            maxCost = baseCost + (estimatedToolCalls * TOOL_CALL_COST);
            estimatedCost = baseCost + ((estimatedToolCalls / 2.0) * TOOL_CALL_COST);

            breakdown.put("model", modelName);
            breakdown.put("baseAICost", Math.round(baseCost * 10000.0) / 10000.0);
            breakdown.put("estimatedToolCalls", estimatedToolCalls);
            breakdown.put("toolCallsCost", Math.round(estimatedToolCalls * TOOL_CALL_COST * 10000.0) / 10000.0);
            breakdown.put("complexityScore", Math.round(decision.complexityScore() * 100.0) / 100.0);

            explanation = String.format(
                "THOROUGH (%s): $%.4f base + ~%d tool calls ($%.3f each)",
                modelName, baseCost, estimatedToolCalls, TOOL_CALL_COST
            );

        } else {
            // FAST mode: single AI response, no tools
            int queryLength = query.length();
            double lengthMultiplier = Math.min(2.0, 1.0 + (queryLength / 1000.0));

            minCost = baseCost;
            maxCost = baseCost * lengthMultiplier;
            estimatedCost = baseCost * (1.0 + ((lengthMultiplier - 1.0) / 2.0));

            breakdown.put("model", modelName);
            breakdown.put("baseAICost", Math.round(baseCost * 10000.0) / 10000.0);
            breakdown.put("queryLength", queryLength);
            breakdown.put("lengthMultiplier", Math.round(lengthMultiplier * 100.0) / 100.0);
            breakdown.put("complexityScore", Math.round(decision.complexityScore() * 100.0) / 100.0);

            explanation = String.format("FAST (%s): Quick response, $%.4f base", modelName, baseCost);
        }

        // Check for potential cache hit (cost = $0)
        boolean potentialCacheHit = checkPotentialCacheHit(query, mode);
        if (potentialCacheHit) {
            estimatedCost = 0.0;
            minCost = 0.0;
            maxCost = 0.0;
            explanation += " (Cache hit likely - $0 cost!)";
            breakdown.put("cacheHit", true);
        }

        // Get user's monthly spending for context
        Map<String, Object> userAnalytics = userId != null
            ? analyticsService.getUserAnalytics(userId)
            : Map.of();

        double monthlySpend = userAnalytics.containsKey("totalCost")
            ? (double) userAnalytics.get("totalCost")
            : 0.0;

        String affordabilityNote = generateAffordabilityNote(estimatedCost, monthlySpend);

        log.debug("COST PREDICTION: {} mode ({}) = ${} (${}-${}) for query: '{}'",
            autoMode, modelName, String.format("%.4f", estimatedCost),
            String.format("%.4f", minCost), String.format("%.4f", maxCost),
            query.length() > 50 ? query.substring(0, 50) + "..." : query);

        return new CostPrediction(
            estimatedCost,
            minCost,
            maxCost,
            explanation,
            affordabilityNote,
            breakdown,
            potentialCacheHit
        );
    }

    /**
     * Estimate number of tool calls for a THOROUGH query
     */
    private int estimateToolCalls(String query) {
        int toolCalls = 0;
        String lower = query.toLowerCase();

        // Date/deadline related = 1-2 tool calls
        if (lower.contains("deadline") || lower.contains("date") ||
            lower.contains("timeline") || lower.contains("when")) {
            toolCalls += 2;
        }

        // Case law research = 1-2 tool calls
        if (lower.contains("case") || lower.contains("precedent") ||
            lower.contains("court") || lower.contains("ruling")) {
            toolCalls += 2;
        }

        // Statute/regulation lookup = 1 tool call
        if (lower.contains("statute") || lower.contains("regulation") ||
            lower.contains("code") || lower.contains("cfr")) {
            toolCalls += 1;
        }

        // Motion template = 1 tool call
        if (lower.contains("motion") || lower.contains("template") ||
            lower.contains("sample") || lower.contains("draft")) {
            toolCalls += 1;
        }

        // Timeline generation = 1 tool call
        if (lower.contains("timeline") || lower.contains("calendar")) {
            toolCalls += 1;
        }

        // Default if no specific indicators
        if (toolCalls == 0) {
            toolCalls = 2; // Average THOROUGH query uses 2-3 tools
        }

        return Math.min(toolCalls, 5); // Cap at 5 tools
    }

    /**
     * Check if query is likely to hit cache
     */
    private boolean checkPotentialCacheHit(String query, String mode) {
        // Common questions that are likely cached
        String[] commonPatterns = {
            "what is",
            "what are",
            "how to",
            "when can i",
            "requirements for",
            "statute of limitations"
        };

        String lower = query.toLowerCase();
        for (String pattern : commonPatterns) {
            if (lower.startsWith(pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate affordability note based on user's spending
     */
    private String generateAffordabilityNote(double queryCost, double monthlySpend) {
        if (monthlySpend == 0.0) {
            return "First query - costs are tracked monthly";
        }

        double percentOfMonthly = (queryCost / Math.max(monthlySpend, 1.0)) * 100;

        if (percentOfMonthly < 5) {
            return String.format("Minimal cost (~%.1f%% of monthly spend)", percentOfMonthly);
        } else if (percentOfMonthly < 20) {
            return String.format("Moderate cost (~%.1f%% of monthly spend)", percentOfMonthly);
        } else {
            return String.format("Significant cost (~%.1f%% of monthly spend)", percentOfMonthly);
        }
    }

    /**
     * Compare costs between FAST and THOROUGH modes.
     * Now also shows which model would be used for each.
     */
    public Map<String, Object> compareModes(String query, Long userId) {
        CostPrediction fastCost = predictCost(query, "FAST", userId);
        CostPrediction thoroughCost = predictCost(query, "THOROUGH", userId);

        // Auto-selected prediction (what the system would actually pick)
        CostPrediction autoCost = predictCost(query, null, userId);

        double savings = thoroughCost.estimatedCost - fastCost.estimatedCost;
        double savingsPercent = thoroughCost.estimatedCost > 0
            ? (savings / thoroughCost.estimatedCost) * 100
            : 0.0;

        Map<String, Object> comparison = new HashMap<>();
        comparison.put("fastMode", fastCost.toMap());
        comparison.put("thoroughMode", thoroughCost.toMap());
        comparison.put("autoSelected", autoCost.toMap());
        comparison.put("savings", Math.round(savings * 10000.0) / 10000.0);
        comparison.put("savingsPercent", Math.round(savingsPercent));
        comparison.put("recommendation", "Mode auto-selected by AI complexity scoring");

        return comparison;
    }

    // Result class
    public static class CostPrediction {
        public final double estimatedCost;
        public final double minCost;
        public final double maxCost;
        public final String explanation;
        public final String affordabilityNote;
        public final Map<String, Object> breakdown;
        public final boolean likelyCacheHit;

        public CostPrediction(double estimatedCost, double minCost, double maxCost,
                            String explanation, String affordabilityNote,
                            Map<String, Object> breakdown, boolean likelyCacheHit) {
            this.estimatedCost = estimatedCost;
            this.minCost = minCost;
            this.maxCost = maxCost;
            this.explanation = explanation;
            this.affordabilityNote = affordabilityNote;
            this.breakdown = breakdown;
            this.likelyCacheHit = likelyCacheHit;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("estimatedCost", Math.round(estimatedCost * 100.0) / 100.0);
            map.put("minCost", Math.round(minCost * 100.0) / 100.0);
            map.put("maxCost", Math.round(maxCost * 100.0) / 100.0);
            map.put("explanation", explanation);
            map.put("affordabilityNote", affordabilityNote);
            map.put("breakdown", breakdown);
            map.put("likelyCacheHit", likelyCacheHit);
            return map;
        }
    }
}
