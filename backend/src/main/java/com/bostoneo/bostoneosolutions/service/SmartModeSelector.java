package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Intelligent mode selection service
 * Automatically determines optimal research mode (FAST vs THOROUGH)
 * based on query characteristics and user patterns
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SmartModeSelector {

    private final ResearchAnalyticsService analyticsService;

    // Complexity indicators
    private static final Pattern MULTI_PART_QUESTION = Pattern.compile("[,;].*[,;]");
    private static final Pattern COMPARISON_WORDS = Pattern.compile("\\b(compare|contrast|difference|versus|vs|analyze)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRATEGIC_WORDS = Pattern.compile("\\b(strategy|approach|options|alternatives|recommend|advise)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern COMPREHENSIVE_WORDS = Pattern.compile("\\b(comprehensive|detailed|thorough|complete|all|every)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SIMPLE_WORDS = Pattern.compile("\\b(what is|define|meaning of|explain briefly)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUICK_LOOKUP = Pattern.compile("^(what|when|where|who)\\s+(is|was|are)\\s+", Pattern.CASE_INSENSITIVE);

    /**
     * Select optimal mode for a query
     */
    public ModeRecommendation selectMode(String query, Long userId, String requestedMode) {
        // If user explicitly requested a mode and has enough budget, respect it
        if (requestedMode != null && !requestedMode.equalsIgnoreCase("AUTO")) {
            return new ModeRecommendation(
                requestedMode,
                1.0,
                "User explicitly requested " + requestedMode + " mode",
                false
            );
        }

        // Analyze query complexity
        QueryComplexity complexity = analyzeComplexity(query);

        // Get user's usage patterns
        Map<String, Object> userAnalytics = userId != null
            ? analyticsService.getUserAnalytics(userId)
            : new HashMap<>();

        // Determine recommended mode
        String recommendedMode;
        double confidence;
        String reason;

        if (complexity.score >= 0.7) {
            recommendedMode = "THOROUGH";
            confidence = complexity.score;
            reason = buildReason("Complex query", complexity);
        } else if (complexity.score <= 0.3) {
            recommendedMode = "FAST";
            confidence = 1.0 - complexity.score;
            reason = buildReason("Simple query", complexity);
        } else {
            // Moderate complexity - use user patterns to decide
            int thoroughCount = (int) userAnalytics.getOrDefault("thoroughQueries", 0);
            int fastCount = (int) userAnalytics.getOrDefault("fastQueries", 0);
            int totalQueries = thoroughCount + fastCount;

            if (totalQueries > 10) {
                double thoroughRatio = (double) thoroughCount / totalQueries;

                if (thoroughRatio < 0.2) {
                    // User rarely uses THOROUGH, suggest FAST to save costs
                    recommendedMode = "FAST";
                    confidence = 0.7;
                    reason = "Moderate complexity; you typically use FAST mode (cost-effective)";
                } else if (thoroughRatio > 0.8) {
                    // User heavily uses THOROUGH, suggest it
                    recommendedMode = "THOROUGH";
                    confidence = 0.7;
                    reason = "Moderate complexity; matches your typical THOROUGH usage pattern";
                } else {
                    // Balanced user - default to FAST for moderate queries
                    recommendedMode = "FAST";
                    confidence = 0.6;
                    reason = "Moderate complexity; FAST mode recommended for efficiency";
                }
            } else {
                // New user - default to FAST for moderate queries
                recommendedMode = "FAST";
                confidence = 0.6;
                reason = buildReason("Moderate complexity, defaulting to FAST", complexity);
            }
        }

        boolean isSuggestion = requestedMode != null && !requestedMode.equalsIgnoreCase(recommendedMode);

        log.info("🤖 SMART MODE: Query complexity {:.1f} → {} mode (confidence: {:.0f}%)",
            complexity.score, recommendedMode, confidence * 100);

        return new ModeRecommendation(recommendedMode, confidence, reason, isSuggestion);
    }

    /**
     * Analyze query complexity
     */
    private QueryComplexity analyzeComplexity(String query) {
        double score = 0.0;
        Map<String, Boolean> indicators = new HashMap<>();

        // Length factor (longer = more complex)
        if (query.length() > 200) {
            score += 0.2;
            indicators.put("long_query", true);
        } else if (query.length() < 50) {
            score -= 0.1;
            indicators.put("short_query", true);
        }

        // Multi-part questions
        if (MULTI_PART_QUESTION.matcher(query).find()) {
            score += 0.3;
            indicators.put("multi_part", true);
        }

        // Comparison/analysis words
        if (COMPARISON_WORDS.matcher(query).find()) {
            score += 0.25;
            indicators.put("comparison", true);
        }

        // Strategic/advice-seeking words
        if (STRATEGIC_WORDS.matcher(query).find()) {
            score += 0.25;
            indicators.put("strategic", true);
        }

        // Comprehensive/detailed requests
        if (COMPREHENSIVE_WORDS.matcher(query).find()) {
            score += 0.2;
            indicators.put("comprehensive", true);
        }

        // Simple definition/lookup questions
        if (SIMPLE_WORDS.matcher(query).find() || QUICK_LOOKUP.matcher(query).find()) {
            score -= 0.3;
            indicators.put("simple_lookup", true);
        }

        // Multiple question marks (might indicate multiple questions)
        long questionMarks = query.chars().filter(ch -> ch == '?').count();
        if (questionMarks > 1) {
            score += 0.15 * questionMarks;
            indicators.put("multiple_questions", true);
        }

        // Legal complexity indicators
        if (query.toLowerCase().contains("motion") ||
            query.toLowerCase().contains("brief") ||
            query.toLowerCase().contains("pleading")) {
            score += 0.2;
            indicators.put("legal_drafting", true);
        }

        // Normalize score to 0-1 range
        score = Math.max(0.0, Math.min(1.0, score));

        return new QueryComplexity(score, indicators);
    }

    private String buildReason(String baseReason, QueryComplexity complexity) {
        StringBuilder reason = new StringBuilder(baseReason);

        if (complexity.indicators.containsKey("multi_part")) {
            reason.append("; multi-part question");
        }
        if (complexity.indicators.containsKey("comparison")) {
            reason.append("; requires comparison/analysis");
        }
        if (complexity.indicators.containsKey("strategic")) {
            reason.append("; seeking strategic advice");
        }
        if (complexity.indicators.containsKey("comprehensive")) {
            reason.append("; comprehensive answer requested");
        }
        if (complexity.indicators.containsKey("simple_lookup")) {
            reason.append("; appears to be simple lookup");
        }

        return reason.toString();
    }

    // Result classes
    public static class ModeRecommendation {
        public final String mode;
        public final double confidence;
        public final String reason;
        public final boolean isSuggestion;

        public ModeRecommendation(String mode, double confidence, String reason, boolean isSuggestion) {
            this.mode = mode;
            this.confidence = confidence;
            this.reason = reason;
            this.isSuggestion = isSuggestion;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("recommendedMode", mode);
            map.put("confidence", Math.round(confidence * 100.0) / 100.0);
            map.put("reason", reason);
            if (isSuggestion) {
                map.put("suggestion", "Consider using " + mode + " mode for this query");
            }
            return map;
        }
    }

    private static class QueryComplexity {
        final double score;
        final Map<String, Boolean> indicators;

        QueryComplexity(double score, Map<String, Boolean> indicators) {
            this.score = score;
            this.indicators = indicators;
        }
    }
}
