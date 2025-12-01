package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.CollectionSearchHistory;
import com.bostoneo.bostoneosolutions.repository.CollectionSearchHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for providing search autocomplete suggestions based on:
 * 1. User's search history for the collection
 * 2. Popular searches in the collection
 * 3. Common legal queries
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SearchSuggestionService {

    private final CollectionSearchHistoryRepository historyRepository;

    /**
     * Common legal queries that work well for document collections.
     */
    private static final List<String> COMMON_LEGAL_QUERIES = List.of(
            "What are the key deadlines?",
            "What are the termination clauses?",
            "What are the payment terms?",
            "What are the liability limitations?",
            "Who are the parties involved?",
            "What is the governing law?",
            "What are the indemnification provisions?",
            "What are the confidentiality obligations?",
            "What are the dispute resolution procedures?",
            "What warranties are provided?",
            "What are the notice requirements?",
            "What are the conditions precedent?",
            "What are the representations and warranties?",
            "What are the closing conditions?",
            "What are the survival provisions?"
    );

    /**
     * Get search suggestions for autocomplete.
     * Combines history-based, popular, and common legal queries.
     *
     * @param collectionId Collection to get suggestions for
     * @param userId User requesting suggestions
     * @param partialQuery Partial query typed by user
     * @return List of suggestion objects with text and source
     */
    public List<Map<String, Object>> getSuggestions(Long collectionId, Long userId, String partialQuery) {
        List<Map<String, Object>> suggestions = new ArrayList<>();
        String query = partialQuery != null ? partialQuery.trim() : "";

        // 1. Get user's recent searches (history-based)
        List<String> historyResults = getHistoryBasedSuggestions(collectionId, userId, query);
        for (String historyQuery : historyResults) {
            suggestions.add(Map.of(
                    "text", historyQuery,
                    "fromHistory", true,
                    "type", "history"
            ));
        }

        // 2. Get popular searches in the collection
        if (suggestions.size() < 8) {
            List<String> popularResults = getPopularSuggestions(collectionId, query);
            for (String popularQuery : popularResults) {
                // Avoid duplicates
                if (suggestions.stream().noneMatch(s -> s.get("text").equals(popularQuery))) {
                    suggestions.add(Map.of(
                            "text", popularQuery,
                            "fromHistory", false,
                            "type", "popular"
                    ));
                }
                if (suggestions.size() >= 8) break;
            }
        }

        // 3. Get common legal queries that match
        if (suggestions.size() < 8) {
            List<String> commonResults = getCommonQuerySuggestions(query);
            for (String commonQuery : commonResults) {
                // Avoid duplicates
                if (suggestions.stream().noneMatch(s -> s.get("text").equals(commonQuery))) {
                    suggestions.add(Map.of(
                            "text", commonQuery,
                            "fromHistory", false,
                            "type", "common"
                    ));
                }
                if (suggestions.size() >= 8) break;
            }
        }

        log.debug("Generated {} suggestions for query '{}' in collection {}",
                suggestions.size(), partialQuery, collectionId);

        return suggestions.stream().limit(8).collect(Collectors.toList());
    }

    /**
     * Record a search in history for future suggestions.
     *
     * @param collectionId Collection where search was performed
     * @param userId User who performed the search
     * @param query Search query
     * @param resultCount Number of results returned
     */
    @Transactional
    public void recordSearch(Long collectionId, Long userId, String query, int resultCount) {
        if (query == null || query.trim().isEmpty()) {
            return;
        }

        CollectionSearchHistory history = CollectionSearchHistory.builder()
                .collectionId(collectionId)
                .userId(userId)
                .query(query.trim())
                .resultCount(resultCount)
                .build();

        historyRepository.save(history);
        log.debug("Recorded search '{}' for user {} in collection {}", query, userId, collectionId);
    }

    /**
     * Get suggestions based on user's search history.
     */
    private List<String> getHistoryBasedSuggestions(Long collectionId, Long userId, String partialQuery) {
        try {
            List<String> results = historyRepository.findRecentSearchesByUser(
                    collectionId, userId, partialQuery);
            return results.stream().limit(4).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Error fetching history-based suggestions: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Get suggestions based on popular searches in the collection.
     */
    private List<String> getPopularSuggestions(Long collectionId, String partialQuery) {
        try {
            List<Object[]> results = historyRepository.findPopularSearches(collectionId, partialQuery);
            return results.stream()
                    .map(row -> (String) row[0])
                    .limit(4)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Error fetching popular suggestions: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Get common legal queries that match the partial query.
     */
    private List<String> getCommonQuerySuggestions(String partialQuery) {
        if (partialQuery == null || partialQuery.isEmpty()) {
            // Return first few common queries if no input
            return COMMON_LEGAL_QUERIES.stream().limit(5).collect(Collectors.toList());
        }

        String lowerQuery = partialQuery.toLowerCase();
        return COMMON_LEGAL_QUERIES.stream()
                .filter(q -> q.toLowerCase().contains(lowerQuery))
                .limit(5)
                .collect(Collectors.toList());
    }

    /**
     * Get all common legal queries (for quick search chips).
     */
    public List<String> getCommonLegalQueries() {
        return Collections.unmodifiableList(COMMON_LEGAL_QUERIES);
    }

    /**
     * Get top N common queries (for quick search chips).
     */
    public List<String> getTopCommonQueries(int limit) {
        return COMMON_LEGAL_QUERIES.stream().limit(limit).collect(Collectors.toList());
    }
}
