package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.enumeration.AIOperationType;
import com.bostoneo.bostoneosolutions.enumeration.AIOperationType.ModelTier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Scores query complexity and determines:
 * 1. Which model to use (Sonnet vs Opus)
 * 2. Which research mode to use (FAST vs THOROUGH)
 *
 * Replaces user-facing FAST/THOROUGH toggle with fully automatic selection.
 * Builds on SmartModeSelector's complexity analysis patterns.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIComplexityScorer {

    // Complexity indicator patterns (from SmartModeSelector)
    private static final Pattern MULTI_PART_QUESTION = Pattern.compile("[,;].*[,;]");
    private static final Pattern COMPARISON_WORDS = Pattern.compile(
            "\\b(compare|contrast|difference|versus|vs|analyze)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRATEGIC_WORDS = Pattern.compile(
            "\\b(strategy|approach|options|alternatives|recommend|advise)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern COMPREHENSIVE_WORDS = Pattern.compile(
            "\\b(comprehensive|detailed|thorough|complete|all|every)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SIMPLE_WORDS = Pattern.compile(
            "\\b(what is|define|meaning of|explain briefly)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUICK_LOOKUP = Pattern.compile(
            "^(what|when|where|who)\\s+(is|was|are)\\s+", Pattern.CASE_INSENSITIVE);
    private static final Pattern LEGAL_DRAFTING = Pattern.compile(
            "\\b(motion|brief|pleading|memorandum|complaint|interrogatories|discovery|demand letter)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern COMPLEX_ANALYSIS = Pattern.compile(
            "\\b(jurisdictional|constitutional|due process|equal protection|precedent analysis|statutory interpretation)\\b",
            Pattern.CASE_INSENSITIVE);

    /**
     * Score query complexity on a 0.0 to 1.0 scale.
     * Used for both mode selection and dynamic model downgrade decisions.
     */
    public double scoreComplexity(String query) {
        if (query == null || query.isBlank()) {
            return 0.0;
        }

        double score = 0.0;

        // Length factor
        if (query.length() > 200) {
            score += 0.2;
        } else if (query.length() < 50) {
            score -= 0.1;
        }

        // Multi-part questions
        if (MULTI_PART_QUESTION.matcher(query).find()) {
            score += 0.3;
        }

        // Comparison/analysis words
        if (COMPARISON_WORDS.matcher(query).find()) {
            score += 0.25;
        }

        // Strategic/advice-seeking words
        if (STRATEGIC_WORDS.matcher(query).find()) {
            score += 0.25;
        }

        // Comprehensive/detailed requests
        if (COMPREHENSIVE_WORDS.matcher(query).find()) {
            score += 0.2;
        }

        // Simple definition/lookup questions
        if (SIMPLE_WORDS.matcher(query).find() || QUICK_LOOKUP.matcher(query).find()) {
            score -= 0.3;
        }

        // Multiple question marks
        long questionMarks = query.chars().filter(ch -> ch == '?').count();
        if (questionMarks > 1) {
            score += 0.15 * questionMarks;
        }

        // Legal drafting keywords
        if (LEGAL_DRAFTING.matcher(query).find()) {
            score += 0.2;
        }

        // Complex legal analysis keywords
        if (COMPLEX_ANALYSIS.matcher(query).find()) {
            score += 0.25;
        }

        return Math.max(0.0, Math.min(1.0, score));
    }

    /**
     * Determine the research mode (FAST vs THOROUGH) based on query complexity.
     * Fully automatic — user never selects this.
     */
    public String selectMode(String query) {
        double score = scoreComplexity(query);

        if (score >= 0.7) {
            log.debug("Auto-mode: THOROUGH (complexity score: {})", score);
            return "THOROUGH";
        } else if (score <= 0.3) {
            log.debug("Auto-mode: FAST (complexity score: {})", score);
            return "FAST";
        } else {
            // Middle ground — default to FAST for cost efficiency
            log.debug("Auto-mode: FAST (moderate complexity: {}, defaulting to cost-efficient)", score);
            return "FAST";
        }
    }

    /**
     * Determine which model to use for a given operation type and query.
     *
     * Most operations have a fixed model tier (defined in the enum).
     * DRAFT_GENERATION can be dynamically downgraded to Sonnet if the query is simple enough.
     */
    public String selectModel(AIOperationType operationType, String query) {
        // Fixed Sonnet operations — always Sonnet
        if (operationType.isSonnetTier()) {
            log.debug("Model selection: Sonnet (fixed tier for {})", operationType);
            return ModelTier.SONNET.getModelId();
        }

        // DRAFT_GENERATION can be downgraded for simple templates
        if (operationType == AIOperationType.DRAFT_GENERATION ||
            operationType == AIOperationType.DRAFT_GENERATION_STREAMING) {
            double score = scoreComplexity(query);
            if (score < 0.4) {
                log.info("Model downgrade: {} → Sonnet (complexity score {} < 0.4)", operationType, score);
                return ModelTier.SONNET.getModelId();
            }
        }

        // All other Opus operations — always Opus
        log.debug("Model selection: Opus (fixed tier for {})", operationType);
        return ModelTier.OPUS.getModelId();
    }

    /**
     * Full routing decision: model + mode for a given operation and query.
     * Computes complexity score once and reuses it for both model and mode selection.
     */
    public RoutingDecision decide(AIOperationType operationType, String query) {
        double complexity = scoreComplexity(query);
        String model = selectModelWithScore(operationType, complexity);
        String mode = selectModeWithScore(complexity);

        log.info("Routing decision: {} → model={}, mode={}, complexity={}",
                operationType, model.contains("sonnet") ? "Sonnet" : "Opus", mode,
                String.format("%.2f", complexity));

        return new RoutingDecision(model, mode, complexity);
    }

    /** Select model using pre-computed complexity score. */
    private String selectModelWithScore(AIOperationType operationType, double score) {
        if (operationType.isSonnetTier()) {
            return ModelTier.SONNET.getModelId();
        }
        if ((operationType == AIOperationType.DRAFT_GENERATION ||
             operationType == AIOperationType.DRAFT_GENERATION_STREAMING) && score < 0.4) {
            log.info("Model downgrade: {} → Sonnet (complexity {} < 0.4)", operationType, String.format("%.2f", score));
            return ModelTier.SONNET.getModelId();
        }
        return ModelTier.OPUS.getModelId();
    }

    /** Select mode using pre-computed complexity score. */
    private String selectModeWithScore(double score) {
        return score >= 0.7 ? "THOROUGH" : "FAST";
    }

    /**
     * Immutable routing decision result.
     */
    public record RoutingDecision(String modelId, String mode, double complexityScore) {
        public boolean isSonnet() {
            return modelId.contains("sonnet");
        }
        public boolean isOpus() {
            return modelId.contains("opus");
        }
    }
}
