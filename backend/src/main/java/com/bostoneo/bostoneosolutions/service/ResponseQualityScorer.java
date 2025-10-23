package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for scoring AI response quality
 * Provides metrics to track and improve response effectiveness
 */
@Service
@Slf4j
public class ResponseQualityScorer {

    // Quality indicators
    private static final Pattern CITATION_PATTERN = Pattern.compile("\\b\\d+\\s+(U\\.S\\.|F\\.|F\\.2d|F\\.3d|F\\.Supp|S\\.Ct\\.)");
    private static final Pattern CASE_NAME_PATTERN = Pattern.compile("\\b[A-Z][a-z]+\\s+v\\.\\s+[A-Z][a-z]+");
    private static final Pattern STATUTE_PATTERN = Pattern.compile("\\b\\d+\\s+(U\\.S\\.C\\.|CFR|Mass\\. Gen\\. Laws)");
    private static final Pattern SECTION_HEADERS = Pattern.compile("^#{1,3}\\s+.+$", Pattern.MULTILINE);
    private static final Pattern BULLET_POINTS = Pattern.compile("^[\\s]*[-*•]\\s+", Pattern.MULTILINE);

    /**
     * Score response quality on multiple dimensions
     */
    public QualityScore scoreResponse(String response, String query, String mode) {
        Map<String, Double> dimensions = new HashMap<>();
        Map<String, Object> details = new HashMap<>();

        // 1. Completeness (0-1): Does it address the query?
        double completeness = scoreCompleteness(response, query);
        dimensions.put("completeness", completeness);

        // 2. Legal Authority (0-1): Citations and references
        double authority = scoreLegalAuthority(response);
        dimensions.put("authority", authority);
        details.put("citationCount", countCitations(response));
        details.put("caseCount", countCaseNames(response));
        details.put("statuteCount", countStatutes(response));

        // 3. Structure (0-1): Organization and formatting
        double structure = scoreStructure(response);
        dimensions.put("structure", structure);
        details.put("sectionCount", countSections(response));
        details.put("bulletPoints", countBulletPoints(response));

        // 4. Depth (0-1): Level of detail
        double depth = scoreDepth(response, mode);
        dimensions.put("depth", depth);
        details.put("wordCount", response.split("\\s+").length);

        // 5. Actionability (0-1): Practical guidance
        double actionability = scoreActionability(response);
        dimensions.put("actionability", actionability);

        // Calculate weighted overall score
        double overallScore = calculateOverallScore(dimensions, mode);

        // Generate feedback
        String feedback = generateFeedback(dimensions, mode);
        String grade = getGrade(overallScore);

        log.debug("📊 QUALITY SCORE: {} - {}/10 ({} mode)",
            grade, Math.round(overallScore * 10), mode);

        return new QualityScore(overallScore, grade, dimensions, details, feedback);
    }

    /**
     * Score completeness - how well the response addresses the query
     */
    private double scoreCompleteness(String response, String query) {
        String[] queryKeywords = extractKeywords(query);
        String responseLower = response.toLowerCase();

        int matchedKeywords = 0;
        for (String keyword : queryKeywords) {
            if (responseLower.contains(keyword.toLowerCase())) {
                matchedKeywords++;
            }
        }

        double keywordCoverage = queryKeywords.length > 0
            ? (double) matchedKeywords / queryKeywords.length
            : 0.5;

        // Check for conclusion/answer
        boolean hasConclusion = responseLower.contains("conclusion") ||
                               responseLower.contains("in summary") ||
                               responseLower.contains("therefore") ||
                               responseLower.contains("recommend");

        return Math.min(1.0, (keywordCoverage * 0.7) + (hasConclusion ? 0.3 : 0.0));
    }

    /**
     * Score legal authority - citations and references
     */
    private double scoreLegalAuthority(String response) {
        int citations = countCitations(response);
        int cases = countCaseNames(response);
        int statutes = countStatutes(response);

        int totalAuthority = citations + cases + statutes;

        // More authority = better, but with diminishing returns
        if (totalAuthority == 0) return 0.0;
        if (totalAuthority <= 2) return 0.3;
        if (totalAuthority <= 5) return 0.6;
        if (totalAuthority <= 10) return 0.8;
        return 1.0;
    }

    /**
     * Score structure - organization and formatting
     */
    private double scoreStructure(String response) {
        int sections = countSections(response);
        int bulletPoints = countBulletPoints(response);
        int paragraphs = response.split("\n\n").length;

        double score = 0.0;

        // Has sections/headers
        if (sections >= 2) score += 0.4;
        else if (sections == 1) score += 0.2;

        // Has bullet points or lists
        if (bulletPoints >= 3) score += 0.3;
        else if (bulletPoints >= 1) score += 0.15;

        // Has multiple paragraphs
        if (paragraphs >= 3) score += 0.3;
        else if (paragraphs >= 2) score += 0.15;

        return Math.min(1.0, score);
    }

    /**
     * Score depth - level of detail appropriate for mode
     */
    private double scoreDepth(String response, String mode) {
        int wordCount = response.split("\\s+").length;

        if ("THOROUGH".equalsIgnoreCase(mode)) {
            // THOROUGH should be detailed
            if (wordCount < 200) return 0.3; // Too brief
            if (wordCount < 400) return 0.6;
            if (wordCount < 800) return 0.85;
            return 1.0; // Appropriately detailed
        } else {
            // FAST should be concise
            if (wordCount < 100) return 0.5; // Too brief
            if (wordCount < 300) return 1.0; // Perfect
            if (wordCount < 500) return 0.8; // Getting verbose
            return 0.6; // Too verbose for FAST
        }
    }

    /**
     * Score actionability - practical guidance
     */
    private double scoreActionability(String response) {
        String lower = response.toLowerCase();
        int actionableIndicators = 0;

        // Recommendations
        if (lower.contains("recommend") || lower.contains("should")) actionableIndicators++;

        // Next steps
        if (lower.contains("next step") || lower.contains("follow")) actionableIndicators++;

        // Warnings/notes
        if (lower.contains("note") || lower.contains("important") || lower.contains("warning")) actionableIndicators++;

        // Deadlines/timing
        if (lower.contains("deadline") || lower.contains("days") || lower.contains("must")) actionableIndicators++;

        // Options/alternatives
        if (lower.contains("option") || lower.contains("alternative") || lower.contains("consider")) actionableIndicators++;

        return Math.min(1.0, actionableIndicators * 0.25);
    }

    /**
     * Calculate weighted overall score
     */
    private double calculateOverallScore(Map<String, Double> dimensions, String mode) {
        if ("THOROUGH".equalsIgnoreCase(mode)) {
            // THOROUGH mode: prioritize authority and depth
            return (dimensions.get("completeness") * 0.25) +
                   (dimensions.get("authority") * 0.30) +
                   (dimensions.get("structure") * 0.15) +
                   (dimensions.get("depth") * 0.20) +
                   (dimensions.get("actionability") * 0.10);
        } else {
            // FAST mode: prioritize completeness and actionability
            return (dimensions.get("completeness") * 0.35) +
                   (dimensions.get("authority") * 0.15) +
                   (dimensions.get("structure") * 0.15) +
                   (dimensions.get("depth") * 0.15) +
                   (dimensions.get("actionability") * 0.20);
        }
    }

    /**
     * Generate improvement feedback
     */
    private String generateFeedback(Map<String, Double> dimensions, String mode) {
        StringBuilder feedback = new StringBuilder();

        if (dimensions.get("authority") < 0.5) {
            feedback.append("Consider adding more legal citations and references. ");
        }

        if (dimensions.get("structure") < 0.5) {
            feedback.append("Better organization with headers and bullet points would improve clarity. ");
        }

        if ("THOROUGH".equalsIgnoreCase(mode) && dimensions.get("depth") < 0.6) {
            feedback.append("THOROUGH mode responses should provide more detailed analysis. ");
        }

        if ("FAST".equalsIgnoreCase(mode) && dimensions.get("depth") > 0.8) {
            feedback.append("Response could be more concise for FAST mode. ");
        }

        if (dimensions.get("actionability") < 0.5) {
            feedback.append("Include more practical next steps and recommendations. ");
        }

        if (feedback.length() == 0) {
            return "Excellent response quality!";
        }

        return feedback.toString().trim();
    }

    private String getGrade(double score) {
        if (score >= 0.9) return "A";
        if (score >= 0.8) return "B";
        if (score >= 0.7) return "C";
        if (score >= 0.6) return "D";
        return "F";
    }

    /**
     * Check if response meets counsel-ready standards
     * Returns issues that prevent counsel-ready rating
     */
    public CounselReadyCheck checkCounselReady(String response, String mode) {
        List<String> issues = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Only apply strict standards to THOROUGH mode
        if (!"THOROUGH".equalsIgnoreCase(mode)) {
            return new CounselReadyCheck(true, 0, issues, warnings,
                "Counsel-ready checks only apply to THOROUGH mode");
        }

        int score = 0;
        int maxScore = 5;

        // 1. Case law citations (2 points)
        int caseCount = countCaseNames(response);
        if (caseCount >= 5) {
            score += 2;
        } else if (caseCount >= 3) {
            score += 1;
            warnings.add(String.format("Only %d case citations found. Counsel-ready requires 5-10 controlling precedents.", caseCount));
        } else {
            issues.add(String.format("❌ Insufficient case law: Only %d cases cited. Need minimum 5 controlling precedents with holdings.", caseCount));
        }

        // 2. Required sections (1 point)
        boolean hasControllingAuthority = response.contains("Controlling Legal Authority") ||
                                         response.contains("Case Law") ||
                                         response.contains("Precedents");
        boolean hasStrategicAnalysis = response.contains("Strategic") ||
                                      response.contains("Assessment") ||
                                      (response.contains("strongest") && response.contains("weakest"));

        if (hasControllingAuthority && hasStrategicAnalysis) {
            score += 1;
        } else {
            if (!hasControllingAuthority) {
                issues.add("❌ Missing 'Controlling Legal Authority' section with case analysis");
            }
            if (!hasStrategicAnalysis) {
                warnings.add("⚠️ No strategic assessment ranking arguments by strength");
            }
        }

        // 3. Holdings/application (1 point)
        boolean hasHoldings = response.toLowerCase().contains("holding") ||
                            response.toLowerCase().contains("held that") ||
                            response.toLowerCase().contains("court decided");
        boolean hasApplication = response.toLowerCase().contains("applies to") ||
                                response.toLowerCase().contains("in this case") ||
                                response.toLowerCase().contains("case-specific");

        if (hasHoldings && hasApplication) {
            score += 1;
        } else {
            if (!hasHoldings) {
                issues.add("❌ Case citations lack specific holdings (what court decided and why)");
            }
            if (!hasApplication) {
                warnings.add("⚠️ Missing case-specific analysis showing how precedents apply to THIS case");
            }
        }

        // 4. Risk/strategic assessment (1 point - optional but recommended)
        boolean hasRiskAnalysis = response.toLowerCase().contains("probability") ||
                                 response.toLowerCase().contains("likelihood") ||
                                 response.toLowerCase().contains("settlement") ||
                                 response.toLowerCase().contains("risk");

        if (hasRiskAnalysis) {
            score += 1;
        } else {
            warnings.add("⚠️ No risk analysis (probability of success, settlement range)");
        }

        boolean isCounselReady = score >= 4 && issues.isEmpty();

        if (!isCounselReady && issues.isEmpty()) {
            issues.add("Response needs improvement in multiple areas to meet counsel-ready standards");
        }

        return new CounselReadyCheck(isCounselReady, score, issues, warnings,
            String.format("Counsel-ready score: %d/%d", score, maxScore));
    }

    /**
     * Result class for counsel-ready check
     */
    public static class CounselReadyCheck {
        public final boolean isCounselReady;
        public final int score;
        public final List<String> issues;
        public final List<String> warnings;
        public final String summary;

        public CounselReadyCheck(boolean isCounselReady, int score, List<String> issues,
                                List<String> warnings, String summary) {
            this.isCounselReady = isCounselReady;
            this.score = score;
            this.issues = issues;
            this.warnings = warnings;
            this.summary = summary;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("counselReady", isCounselReady);
            map.put("score", score);
            map.put("issues", issues);
            map.put("warnings", warnings);
            map.put("summary", summary);
            return map;
        }
    }

    // Helper methods for counting
    private int countCitations(String text) {
        Matcher m = CITATION_PATTERN.matcher(text);
        int count = 0;
        while (m.find()) count++;
        return count;
    }

    private int countCaseNames(String text) {
        Matcher m = CASE_NAME_PATTERN.matcher(text);
        int count = 0;
        while (m.find()) count++;
        return count;
    }

    private int countStatutes(String text) {
        Matcher m = STATUTE_PATTERN.matcher(text);
        int count = 0;
        while (m.find()) count++;
        return count;
    }

    private int countSections(String text) {
        Matcher m = SECTION_HEADERS.matcher(text);
        int count = 0;
        while (m.find()) count++;
        return count;
    }

    private int countBulletPoints(String text) {
        Matcher m = BULLET_POINTS.matcher(text);
        int count = 0;
        while (m.find()) count++;
        return count;
    }

    private String[] extractKeywords(String query) {
        // Remove common words and extract meaningful keywords
        String[] words = query.toLowerCase()
            .replaceAll("[^a-z0-9\\s]", "")
            .split("\\s+");

        return java.util.Arrays.stream(words)
            .filter(w -> w.length() > 3) // Only words longer than 3 chars
            .filter(w -> !isStopWord(w))
            .toArray(String[]::new);
    }

    private boolean isStopWord(String word) {
        String[] stopWords = {"what", "when", "where", "which", "should", "would", "could",
                             "the", "is", "are", "was", "were", "been", "being", "have", "has", "had",
                             "do", "does", "did", "will", "would", "shall", "should", "may", "might",
                             "can", "could", "must", "ought", "this", "that", "these", "those"};

        for (String stop : stopWords) {
            if (word.equals(stop)) return true;
        }
        return false;
    }

    // Result class
    public static class QualityScore {
        public final double overallScore;
        public final String grade;
        public final Map<String, Double> dimensions;
        public final Map<String, Object> details;
        public final String feedback;

        public QualityScore(double overallScore, String grade, Map<String, Double> dimensions,
                          Map<String, Object> details, String feedback) {
            this.overallScore = overallScore;
            this.grade = grade;
            this.dimensions = dimensions;
            this.details = details;
            this.feedback = feedback;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("overallScore", Math.round(overallScore * 100.0) / 100.0);
            map.put("scoreOutOf10", Math.round(overallScore * 10));
            map.put("grade", grade);
            map.put("dimensions", dimensions);
            map.put("details", details);
            map.put("feedback", feedback);
            return map;
        }
    }
}
