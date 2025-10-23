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

    // Cost constants (based on actual Claude API pricing)
    private static final double FAST_BASE_COST = 0.15;
    private static final double THOROUGH_BASE_COST = 1.50;
    private static final double TOOL_CALL_COST = 0.10; // Average per tool call

    /**
     * Predict cost for a query
     */
    public CostPrediction predictCost(String query, String mode, Long userId) {
        double estimatedCost;
        double minCost;
        double maxCost;
        String explanation;
        Map<String, Object> breakdown = new HashMap<>();

        if ("THOROUGH".equalsIgnoreCase(mode)) {
            // THOROUGH mode cost prediction
            int estimatedToolCalls = estimateToolCalls(query);

            minCost = THOROUGH_BASE_COST;
            maxCost = THOROUGH_BASE_COST + (estimatedToolCalls * TOOL_CALL_COST);
            estimatedCost = THOROUGH_BASE_COST + ((estimatedToolCalls / 2.0) * TOOL_CALL_COST);

            breakdown.put("baseAICost", THOROUGH_BASE_COST);
            breakdown.put("estimatedToolCalls", estimatedToolCalls);
            breakdown.put("toolCallsCost", estimatedToolCalls * TOOL_CALL_COST);

            explanation = String.format(
                "THOROUGH mode: Base $%.2f + ~%d tool calls ($%.2f each)",
                THOROUGH_BASE_COST, estimatedToolCalls, TOOL_CALL_COST
            );

        } else {
            // FAST mode cost prediction
            int queryLength = query.length();
            double lengthMultiplier = Math.min(2.0, 1.0 + (queryLength / 1000.0));

            minCost = FAST_BASE_COST;
            maxCost = FAST_BASE_COST * lengthMultiplier;
            estimatedCost = FAST_BASE_COST * (1.0 + ((lengthMultiplier - 1.0) / 2.0));

            breakdown.put("baseAICost", FAST_BASE_COST);
            breakdown.put("queryLength", queryLength);
            breakdown.put("lengthMultiplier", lengthMultiplier);

            explanation = "FAST mode: Quick AI response with existing knowledge";
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

        log.debug("💵 COST PREDICTION: {} mode = ${:.2f} (${:.2f}-${:.2f}) for query: '{}'",
            mode, estimatedCost, minCost, maxCost,
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
     * Compare costs between FAST and THOROUGH modes
     */
    public Map<String, Object> compareModes(String query, Long userId) {
        CostPrediction fastCost = predictCost(query, "FAST", userId);
        CostPrediction thoroughCost = predictCost(query, "THOROUGH", userId);

        double savings = thoroughCost.estimatedCost - fastCost.estimatedCost;
        double savingsPercent = thoroughCost.estimatedCost > 0
            ? (savings / thoroughCost.estimatedCost) * 100
            : 0.0;

        Map<String, Object> comparison = new HashMap<>();
        comparison.put("fastMode", fastCost.toMap());
        comparison.put("thoroughMode", thoroughCost.toMap());
        comparison.put("savings", Math.round(savings * 100.0) / 100.0);
        comparison.put("savingsPercent", Math.round(savingsPercent));
        comparison.put("recommendation",
            fastCost.estimatedCost == 0.0 ? "Both modes free (cache hit)" :
            thoroughCost.estimatedCost < 1.0 ? "THOROUGH mode good value for this query" :
            "FAST mode recommended for cost efficiency"
        );

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
