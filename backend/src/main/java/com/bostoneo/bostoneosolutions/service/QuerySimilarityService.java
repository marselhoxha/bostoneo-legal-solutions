package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIResearchCache;
import com.bostoneo.bostoneosolutions.repository.AIResearchCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for detecting similar queries to improve cache hit rates
 * Uses semantic similarity to find related cached responses
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QuerySimilarityService {

    private final AIResearchCacheRepository cacheRepository;

    // Similarity threshold (0.0 to 1.0)
    private static final double SIMILARITY_THRESHOLD = 0.75;

    /**
     * Find similar cached queries that might answer the current query
     * CRITICAL: Only returns cache entries from the same research mode AND same case
     * to prevent FAST mode results from being returned for THOROUGH queries (and vice versa)
     * and to prevent cross-case cache pollution
     */
    public Optional<AIResearchCache> findSimilarCachedQuery(String query, String searchType, String jurisdiction, String researchMode, String caseId) {
        List<AIResearchCache> validCaches = cacheRepository.findByQueryTypeAndIsValidTrue(
            com.bostoneo.bostoneosolutions.enumeration.QueryType.valueOf(searchType.toUpperCase())
        );

        if (validCaches.isEmpty()) {
            return Optional.empty();
        }

        // CRITICAL: Filter by research mode to prevent cross-mode cache pollution
        validCaches = validCaches.stream()
            .filter(cache -> researchMode.equals(cache.getResearchMode()))
            .collect(Collectors.toList());

        if (validCaches.isEmpty()) {
            log.debug("No valid caches found for mode: {}", researchMode);
            return Optional.empty();
        }

        // CRITICAL: Filter by caseId to prevent cross-case cache pollution
        // If caseId is null/empty, only match other null/empty caseIds (general queries)
        // If caseId is provided, only match that specific case
        validCaches = validCaches.stream()
            .filter(cache -> {
                String cacheCaseId = cache.getCaseId();
                if (caseId == null || caseId.isEmpty()) {
                    // General query - only match general cache entries
                    return cacheCaseId == null || cacheCaseId.isEmpty();
                } else {
                    // Case-specific query - only match same case
                    return caseId.equals(cacheCaseId);
                }
            })
            .collect(Collectors.toList());

        if (validCaches.isEmpty()) {
            log.debug("No valid caches found for mode: {} and caseId: {}", researchMode, caseId);
            return Optional.empty();
        }

        // Find most similar query
        SimilarityMatch bestMatch = validCaches.stream()
            .map(cache -> new SimilarityMatch(cache, calculateSimilarity(query, cache.getQueryText())))
            .filter(match -> match.similarity >= SIMILARITY_THRESHOLD)
            .max(Comparator.comparingDouble(match -> match.similarity))
            .orElse(null);

        if (bestMatch != null) {
            log.info("🎯 SIMILARITY MATCH: Found cached query with {:.1f}% similarity",
                bestMatch.similarity * 100);
            log.info("   Original: '{}'", truncate(query, 80));
            log.info("   Matched:  '{}'", truncate(bestMatch.cache.getQueryText(), 80));

            return Optional.of(bestMatch.cache);
        }

        return Optional.empty();
    }

    /**
     * Calculate similarity between two queries using multiple algorithms
     */
    private double calculateSimilarity(String query1, String query2) {
        // Normalize queries
        String q1 = normalize(query1);
        String q2 = normalize(query2);

        // Use weighted combination of similarity metrics
        double jaccardSim = jaccardSimilarity(q1, q2);
        double levenshteinSim = levenshteinSimilarity(q1, q2);
        double tokenOverlapSim = tokenOverlapSimilarity(q1, q2);
        double ngramSim = ngramSimilarity(q1, q2, 3);

        // Weighted average
        return (jaccardSim * 0.3) +
               (levenshteinSim * 0.2) +
               (tokenOverlapSim * 0.3) +
               (ngramSim * 0.2);
    }

    /**
     * Normalize query for comparison
     */
    private String normalize(String query) {
        return query.toLowerCase()
            .replaceAll("[^a-z0-9\\s]", " ") // Remove punctuation
            .replaceAll("\\s+", " ")          // Normalize whitespace
            .trim();
    }

    /**
     * Jaccard similarity (set-based)
     */
    private double jaccardSimilarity(String q1, String q2) {
        Set<String> set1 = new HashSet<>(Arrays.asList(q1.split("\\s+")));
        Set<String> set2 = new HashSet<>(Arrays.asList(q2.split("\\s+")));

        Set<String> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);

        Set<String> union = new HashSet<>(set1);
        union.addAll(set2);

        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    /**
     * Levenshtein distance similarity
     */
    private double levenshteinSimilarity(String q1, String q2) {
        int distance = levenshteinDistance(q1, q2);
        int maxLen = Math.max(q1.length(), q2.length());

        return maxLen == 0 ? 1.0 : 1.0 - ((double) distance / maxLen);
    }

    private int levenshteinDistance(String s1, String s2) {
        int[][] dp = new int[s1.length() + 1][s2.length() + 1];

        for (int i = 0; i <= s1.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= s2.length(); j++) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= s1.length(); i++) {
            for (int j = 1; j <= s2.length(); j++) {
                int cost = s1.charAt(i - 1) == s2.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                    Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                    dp[i - 1][j - 1] + cost
                );
            }
        }

        return dp[s1.length()][s2.length()];
    }

    /**
     * Token overlap similarity
     */
    private double tokenOverlapSimilarity(String q1, String q2) {
        String[] tokens1 = q1.split("\\s+");
        String[] tokens2 = q2.split("\\s+");

        Set<String> set1 = new HashSet<>(Arrays.asList(tokens1));
        Set<String> set2 = new HashSet<>(Arrays.asList(tokens2));

        long commonTokens = set1.stream().filter(set2::contains).count();
        int totalUniqueTokens = set1.size() + set2.size() - (int) commonTokens;

        return totalUniqueTokens == 0 ? 0.0 : (double) commonTokens / totalUniqueTokens;
    }

    /**
     * N-gram similarity
     */
    private double ngramSimilarity(String q1, String q2, int n) {
        Set<String> ngrams1 = generateNgrams(q1, n);
        Set<String> ngrams2 = generateNgrams(q2, n);

        Set<String> intersection = new HashSet<>(ngrams1);
        intersection.retainAll(ngrams2);

        Set<String> union = new HashSet<>(ngrams1);
        union.addAll(ngrams2);

        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private Set<String> generateNgrams(String text, int n) {
        Set<String> ngrams = new HashSet<>();
        String[] words = text.split("\\s+");

        for (int i = 0; i <= words.length - n; i++) {
            StringBuilder ngram = new StringBuilder();
            for (int j = 0; j < n; j++) {
                if (j > 0) ngram.append(" ");
                ngram.append(words[i + j]);
            }
            ngrams.add(ngram.toString());
        }

        return ngrams;
    }

    /**
     * Find queries that are likely duplicates or near-duplicates
     */
    public List<DuplicateGroup> findDuplicateQueries() {
        List<AIResearchCache> allCaches = cacheRepository.findAll().stream()
            .filter(cache -> cache.getIsValid() &&
                           cache.getExpiresAt().isAfter(LocalDateTime.now()))
            .collect(Collectors.toList());

        Map<String, List<AIResearchCache>> groups = new HashMap<>();

        for (int i = 0; i < allCaches.size(); i++) {
            AIResearchCache cache1 = allCaches.get(i);
            String key = String.valueOf(cache1.getId());

            for (int j = i + 1; j < allCaches.size(); j++) {
                AIResearchCache cache2 = allCaches.get(j);
                double similarity = calculateSimilarity(cache1.getQueryText(), cache2.getQueryText());

                if (similarity >= SIMILARITY_THRESHOLD) {
                    groups.computeIfAbsent(key, k -> new ArrayList<>()).add(cache2);
                }
            }
        }

        return groups.entrySet().stream()
            .filter(entry -> !entry.getValue().isEmpty())
            .map(entry -> {
                Long primaryId = Long.parseLong(entry.getKey());
                AIResearchCache primary = allCaches.stream()
                    .filter(c -> c.getId().equals(primaryId))
                    .findFirst()
                    .orElse(null);
                return new DuplicateGroup(primary, entry.getValue());
            })
            .filter(group -> group.primary != null)
            .collect(Collectors.toList());
    }

    // Helper classes
    private static class SimilarityMatch {
        final AIResearchCache cache;
        final double similarity;

        SimilarityMatch(AIResearchCache cache, double similarity) {
            this.cache = cache;
            this.similarity = similarity;
        }
    }

    public static class DuplicateGroup {
        public final AIResearchCache primary;
        public final List<AIResearchCache> duplicates;

        DuplicateGroup(AIResearchCache primary, List<AIResearchCache> duplicates) {
            this.primary = primary;
            this.duplicates = duplicates;
        }

        public int getPotentialSavings() {
            return duplicates.size(); // Each duplicate could have been a cache hit
        }
    }

    private String truncate(String text, int maxLength) {
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
