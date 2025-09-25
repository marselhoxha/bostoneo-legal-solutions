package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.service.external.CourtListenerService;
import com.bostoneo.bostoneosolutions.service.external.FederalRegisterService;
import com.bostoneo.bostoneosolutions.dto.FrDocument;
import com.bostoneo.bostoneosolutions.service.search.BooleanSearchParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AILegalResearchService {

    private final AIMAStatuteRepository statuteRepository;
    private final AIMACourtRuleRepository courtRuleRepository;
    private final AIMASentencingGuidelineRepository sentencingGuidelineRepository;
    private final AIResearchCacheRepository cacheRepository;
    private final SearchHistoryRepository searchHistoryRepository;
    private final ResearchSessionRepository sessionRepository;
    private final ResearchAnnotationRepository annotationRepository;
    private final ClaudeSonnet4Service claudeService;
    private final CourtListenerService courtListenerService;
    private final FederalRegisterService federalRegisterService;
    private final BooleanSearchParser booleanSearchParser;
    private final ObjectMapper objectMapper;

    public Map<String, Object> performSearch(Map<String, Object> searchRequest) {
        log.info("Performing legal research search: {}", searchRequest);

        String query = (String) searchRequest.get("query");
        String searchType = (String) searchRequest.getOrDefault("searchType", "all");
        String jurisdiction = (String) searchRequest.getOrDefault("jurisdiction", "massachusetts");
        Long userId = searchRequest.containsKey("userId") ? Long.valueOf(searchRequest.get("userId").toString()) : null;
        String sessionId = (String) searchRequest.get("sessionId");

        long startTime = System.currentTimeMillis();

        try {
            // Check if we have a cached result
            String queryHash = generateQueryHash(query, searchType, jurisdiction);
            Optional<AIResearchCache> cachedResult = cacheRepository.findByQueryHash(queryHash);

            if (cachedResult.isPresent() && cachedResult.get().getIsValid() &&
                cachedResult.get().getExpiresAt().isAfter(LocalDateTime.now())) {

                log.info("Returning cached result for query: {}", query);

                // Update cache usage
                AIResearchCache cache = cachedResult.get();
                cache.setUsageCount(cache.getUsageCount() + 1);
                cache.setLastUsed(LocalDateTime.now());
                cacheRepository.save(cache);

                // Still save search history
                saveSearchHistory(userId, sessionId, query, searchType, 0,
                                System.currentTimeMillis() - startTime);

                return parseAIResponse(cache.getAiResponse());
            }

            // Perform new search
            Map<String, Object> searchResults = executeSearch(query, searchType, jurisdiction);

            // Generate AI analysis
            CompletableFuture<String> aiAnalysis = generateAIAnalysis(query, searchResults,
                                                                    QueryType.valueOf(searchType.toUpperCase()));

            // Wait for AI analysis
            String analysis = aiAnalysis.join();

            // Cache the result
            cacheAIResult(queryHash, query, searchType, jurisdiction, analysis);

            // Combine results with AI analysis
            Map<String, Object> finalResults = combineResultsWithAI(searchResults, analysis);

            // Save search history
            saveSearchHistory(userId, sessionId, query, searchType,
                            (Integer) finalResults.getOrDefault("totalResults", 0),
                            System.currentTimeMillis() - startTime);

            return finalResults;

        } catch (Exception e) {
            log.error("Error performing search: ", e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "Search failed: " + e.getMessage());
            errorResult.put("results", Collections.emptyList());
            return errorResult;
        }
    }

    private Map<String, Object> executeSearch(String query, String searchType, String jurisdiction) {
        Map<String, Object> results = new HashMap<>();
        List<Map<String, Object>> allResults = new ArrayList<>();
        int totalCount = 0;

        try {
            // Search Massachusetts Statutes
            if ("all".equals(searchType) || "statutes".equals(searchType)) {
                List<AIMAStatute> statutes = searchStatutes(query);
                List<Map<String, Object>> statuteResults = statutes.stream()
                    .map(this::convertStatuteToResult)
                    .collect(Collectors.toList());
                allResults.addAll(statuteResults);
                totalCount += statutes.size();
            }

            // Search Court Rules
            if ("all".equals(searchType) || "regulations".equals(searchType) || "rules".equals(searchType)) {
                List<AIMACourtRule> courtRules = searchCourtRules(query);
                List<Map<String, Object>> ruleResults = courtRules.stream()
                    .map(this::convertCourtRuleToResult)
                    .collect(Collectors.toList());
                allResults.addAll(ruleResults);
                totalCount += courtRules.size();
            }

            // Search Sentencing Guidelines
            if ("all".equals(searchType) || "guidelines".equals(searchType)) {
                List<AIMASentencingGuideline> guidelines = searchSentencingGuidelines(query);
                List<Map<String, Object>> guidelineResults = guidelines.stream()
                    .map(this::convertSentencingGuidelineToResult)
                    .collect(Collectors.toList());
                allResults.addAll(guidelineResults);
                totalCount += guidelines.size();
            }

            // Search External APIs (parallel execution for better performance)
            List<CompletableFuture<List<Map<String, Object>>>> externalSearches = new ArrayList<>();

            // Court Listener API - search opinions and dockets
            if ("all".equals(searchType) || "cases".equals(searchType) || "opinions".equals(searchType)) {
                externalSearches.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        List<Map<String, Object>> opinions = courtListenerService.searchOpinions(query, jurisdiction, null, null);
                        List<Map<String, Object>> dockets = courtListenerService.searchDockets(query, jurisdiction);
                        List<Map<String, Object>> combined = new ArrayList<>(opinions);
                        combined.addAll(dockets);
                        return combined;
                    } catch (Exception e) {
                        log.warn("Error searching Court Listener: ", e);
                        return Collections.emptyList();
                    }
                }));
            }


            // Federal Register API - search regulations and rules
            if ("all".equals(searchType) || "regulations".equals(searchType) || "rules".equals(searchType)) {
                externalSearches.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        List<FrDocument> rules = federalRegisterService.searchRules(query, null, null);
                        List<FrDocument> proposedRules = federalRegisterService.searchProposedRules(query, null, null);
                        List<FrDocument> notices = federalRegisterService.searchNotices(query, null, null);

                        // Convert FrDocument to Map<String, Object> for compatibility
                        List<Map<String, Object>> combined = new ArrayList<>();
                        combined.addAll(convertFrDocumentsToMaps(rules));
                        combined.addAll(convertFrDocumentsToMaps(proposedRules));
                        combined.addAll(convertFrDocumentsToMaps(notices));
                        return combined;
                    } catch (Exception e) {
                        log.warn("Error searching Federal Register: ", e);
                        return Collections.emptyList();
                    }
                }));
            }

            // Wait for all external searches to complete and combine results
            if (!externalSearches.isEmpty()) {
                CompletableFuture<Void> allSearches = CompletableFuture.allOf(
                    externalSearches.toArray(new CompletableFuture[0])
                );

                try {
                    allSearches.get(); // Wait for completion
                    for (CompletableFuture<List<Map<String, Object>>> future : externalSearches) {
                        List<Map<String, Object>> externalResults = future.get();
                        allResults.addAll(externalResults);
                        totalCount += externalResults.size();
                    }
                } catch (Exception e) {
                    log.warn("Error waiting for external API results: ", e);
                }
            }

            // Sort results by relevance (this is simplified - could be more sophisticated)
            allResults.sort((a, b) -> {
                String titleA = (String) a.get("title");
                String titleB = (String) b.get("title");
                return calculateRelevance(titleA, query).compareTo(calculateRelevance(titleB, query));
            });

            results.put("success", true);
            results.put("results", allResults);
            results.put("totalResults", totalCount);
            results.put("searchQuery", query);
            results.put("searchType", searchType);
            results.put("jurisdiction", jurisdiction);

        } catch (Exception e) {
            log.error("Error executing search: ", e);
            results.put("success", false);
            results.put("error", e.getMessage());
            results.put("results", Collections.emptyList());
        }

        return results;
    }

    private List<AIMAStatute> searchStatutes(String query) {
        // Parse boolean query
        BooleanSearchParser.ParsedQuery parsedQuery = booleanSearchParser.parseQuery(query);

        Set<Long> seen = new HashSet<>();
        List<AIMAStatute> results = new ArrayList<>();

        if (parsedQuery.hasAdvancedOperators()) {
            // Handle boolean search with advanced operators
            log.info("Processing advanced boolean query: {}", query);

            // Process MUST terms (AND logic)
            if (!parsedQuery.getMustTerms().isEmpty()) {
                if (parsedQuery.getMustTerms().size() >= 2) {
                    String term1 = parsedQuery.getMustTerms().get(0);
                    String term2 = parsedQuery.getMustTerms().get(1);
                    List<AIMAStatute> andResults = statuteRepository.findByBothTerms(term1, term2);
                    andResults.forEach(statute -> {
                        if (seen.add(statute.getId())) {
                            results.add(statute);
                        }
                    });
                } else {
                    // Single must term
                    String term = parsedQuery.getMustTerms().get(0);
                    List<AIMAStatute> mustResults = statuteRepository.findByTitleContainingIgnoreCase(term);
                    mustResults.addAll(statuteRepository.findByStatuteTextContainingIgnoreCase(term));
                    mustResults.forEach(statute -> {
                        if (seen.add(statute.getId())) {
                            results.add(statute);
                        }
                    });
                }
            }

            // Process SHOULD terms (OR logic)
            if (!parsedQuery.getShouldTerms().isEmpty()) {
                if (parsedQuery.getShouldTerms().size() >= 2) {
                    String term1 = parsedQuery.getShouldTerms().get(0);
                    String term2 = parsedQuery.getShouldTerms().get(1);
                    List<AIMAStatute> orResults = statuteRepository.findByEitherTerm(term1, term2);
                    orResults.forEach(statute -> {
                        if (seen.add(statute.getId())) {
                            results.add(statute);
                        }
                    });
                } else {
                    // Single should term
                    String term = parsedQuery.getShouldTerms().get(0);
                    List<AIMAStatute> shouldResults = statuteRepository.findByTitleContainingIgnoreCase(term);
                    shouldResults.addAll(statuteRepository.findByStatuteTextContainingIgnoreCase(term));
                    shouldResults.forEach(statute -> {
                        if (seen.add(statute.getId())) {
                            results.add(statute);
                        }
                    });
                }
            }

            // Process MUST_NOT terms (NOT logic)
            if (!parsedQuery.getMustNotTerms().isEmpty() && !parsedQuery.getMustTerms().isEmpty()) {
                String includeTerm = parsedQuery.getMustTerms().get(0);
                String excludeTerm = parsedQuery.getMustNotTerms().get(0);
                List<AIMAStatute> notResults = statuteRepository.findWithTermButNotAnother(includeTerm, excludeTerm);
                notResults.forEach(statute -> {
                    if (seen.add(statute.getId())) {
                        results.add(statute);
                    }
                });
            }

        } else {
            // Simple search fallback
            List<AIMAStatute> titleMatches = statuteRepository.findByTitleContainingIgnoreCase(query);
            List<AIMAStatute> textMatches = statuteRepository.findByStatuteTextContainingIgnoreCase(query);

            titleMatches.forEach(statute -> {
                if (seen.add(statute.getId())) {
                    results.add(statute);
                }
            });

            textMatches.forEach(statute -> {
                if (seen.add(statute.getId())) {
                    results.add(statute);
                }
            });
        }

        return results.stream().limit(10).collect(Collectors.toList());
    }

    private List<AIMACourtRule> searchCourtRules(String query) {
        // Parse boolean query
        BooleanSearchParser.ParsedQuery parsedQuery = booleanSearchParser.parseQuery(query);

        Set<Long> seen = new HashSet<>();
        List<AIMACourtRule> results = new ArrayList<>();

        if (parsedQuery.hasAdvancedOperators()) {
            // Handle boolean search with advanced operators
            log.info("Processing advanced boolean query for court rules: {}", query);

            // Process MUST terms (AND logic)
            if (!parsedQuery.getMustTerms().isEmpty()) {
                if (parsedQuery.getMustTerms().size() >= 2) {
                    String term1 = parsedQuery.getMustTerms().get(0);
                    String term2 = parsedQuery.getMustTerms().get(1);
                    List<AIMACourtRule> andResults = courtRuleRepository.findByBothTerms(term1, term2);
                    andResults.forEach(rule -> {
                        if (seen.add(rule.getId())) {
                            results.add(rule);
                        }
                    });
                } else {
                    // Single must term
                    String term = parsedQuery.getMustTerms().get(0);
                    List<AIMACourtRule> mustResults = courtRuleRepository.findByRuleTitleContainingIgnoreCase(term);
                    mustResults.addAll(courtRuleRepository.findByRuleTextContainingIgnoreCase(term));
                    mustResults.forEach(rule -> {
                        if (seen.add(rule.getId())) {
                            results.add(rule);
                        }
                    });
                }
            }

            // Process SHOULD terms (OR logic)
            if (!parsedQuery.getShouldTerms().isEmpty()) {
                if (parsedQuery.getShouldTerms().size() >= 2) {
                    String term1 = parsedQuery.getShouldTerms().get(0);
                    String term2 = parsedQuery.getShouldTerms().get(1);
                    List<AIMACourtRule> orResults = courtRuleRepository.findByEitherTerm(term1, term2);
                    orResults.forEach(rule -> {
                        if (seen.add(rule.getId())) {
                            results.add(rule);
                        }
                    });
                } else {
                    // Single should term
                    String term = parsedQuery.getShouldTerms().get(0);
                    List<AIMACourtRule> shouldResults = courtRuleRepository.findByRuleTitleContainingIgnoreCase(term);
                    shouldResults.addAll(courtRuleRepository.findByRuleTextContainingIgnoreCase(term));
                    shouldResults.forEach(rule -> {
                        if (seen.add(rule.getId())) {
                            results.add(rule);
                        }
                    });
                }
            }

            // Process MUST_NOT terms (NOT logic)
            if (!parsedQuery.getMustNotTerms().isEmpty() && !parsedQuery.getMustTerms().isEmpty()) {
                String includeTerm = parsedQuery.getMustTerms().get(0);
                String excludeTerm = parsedQuery.getMustNotTerms().get(0);
                List<AIMACourtRule> notResults = courtRuleRepository.findWithTermButNotAnother(includeTerm, excludeTerm);
                notResults.forEach(rule -> {
                    if (seen.add(rule.getId())) {
                        results.add(rule);
                    }
                });
            }

        } else {
            // Simple search fallback
            List<AIMACourtRule> titleMatches = courtRuleRepository.findByRuleTitleContainingIgnoreCase(query);
            List<AIMACourtRule> textMatches = courtRuleRepository.findByRuleTextContainingIgnoreCase(query);

            titleMatches.forEach(rule -> {
                if (seen.add(rule.getId())) {
                    results.add(rule);
                }
            });

            textMatches.forEach(rule -> {
                if (seen.add(rule.getId())) {
                    results.add(rule);
                }
            });
        }

        return results.stream().limit(10).collect(Collectors.toList());
    }

    private List<AIMASentencingGuideline> searchSentencingGuidelines(String query) {
        // Simplified search for sentencing guidelines
        return sentencingGuidelineRepository.findAll().stream()
            .filter(guideline ->
                guideline.getOffenseDescription().toLowerCase().contains(query.toLowerCase()) ||
                (guideline.getCategory() != null && guideline.getCategory().toLowerCase().contains(query.toLowerCase())) ||
                (guideline.getStatutoryCitation() != null && guideline.getStatutoryCitation().toLowerCase().contains(query.toLowerCase())))
            .limit(10)
            .collect(Collectors.toList());
    }

    private CompletableFuture<String> generateAIAnalysis(String query, Map<String, Object> searchResults, QueryType queryType) {
        String prompt = buildAIPrompt(query, searchResults, queryType);

        return claudeService.generateCompletion(prompt, false)
            .exceptionally(throwable -> {
                log.error("AI analysis failed: ", throwable);
                return "AI analysis temporarily unavailable. Please review the search results manually.";
            });
    }

    private String buildAIPrompt(String query, Map<String, Object> searchResults, QueryType queryType) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("You are a legal research assistant specializing in Massachusetts law. ");
        prompt.append("Analyze the following legal search results and provide insights.\n\n");
        prompt.append("Search Query: ").append(query).append("\n");
        prompt.append("Query Type: ").append(queryType).append("\n\n");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) searchResults.get("results");

        prompt.append("Search Results Summary:\n");
        results.stream().limit(5).forEach(result -> {
            prompt.append("- ").append(result.get("title"))
                  .append(" (").append(result.get("type")).append(")\n");
            prompt.append("  Summary: ").append(result.get("summary")).append("\n\n");
        });

        prompt.append("Please provide:\n");
        prompt.append("1. Key legal principles identified\n");
        prompt.append("2. Relevant precedents or authorities\n");
        prompt.append("3. Practical implications\n");
        prompt.append("4. Suggested next steps for research\n");
        prompt.append("5. Any potential legal issues to consider\n\n");
        prompt.append("Format your response in clear, professional legal language.");

        return prompt.toString();
    }

    private Map<String, Object> combineResultsWithAI(Map<String, Object> searchResults, String aiAnalysis) {
        Map<String, Object> combined = new HashMap<>(searchResults);
        combined.put("aiAnalysis", aiAnalysis);
        combined.put("hasAIAnalysis", true);
        return combined;
    }

    private void cacheAIResult(String queryHash, String query, String searchType, String jurisdiction, String aiResponse) {
        try {
            QueryType queryTypeEnum = QueryType.valueOf(searchType.toUpperCase());

            AIResearchCache cache = AIResearchCache.builder()
                .queryHash(queryHash)
                .queryText(query)
                .queryType(queryTypeEnum)
                .jurisdiction(jurisdiction)
                .aiResponse(aiResponse)
                .aiModelUsed("claude-sonnet-4")
                .confidenceScore(new BigDecimal("0.85"))
                .usageCount(1)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .isValid(true)
                .build();

            cacheRepository.save(cache);
            log.info("Cached AI result for query hash: {}", queryHash);

        } catch (Exception e) {
            log.error("Failed to cache AI result: ", e);
        }
    }

    private void saveSearchHistory(Long userId, String sessionId, String query, String searchType,
                                   Integer resultsCount, Long executionTime) {
        try {
            if (userId != null) {
                QueryType queryTypeEnum = QueryType.valueOf(searchType.toUpperCase());

                SearchHistory history = SearchHistory.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .searchQuery(query)
                    .queryType(queryTypeEnum)
                    .resultsCount(resultsCount)
                    .executionTimeMs(executionTime)
                    .isSaved(false)
                    .build();

                searchHistoryRepository.save(history);
                log.info("Saved search history for user: {} query: {}", userId, query);
            }
        } catch (Exception e) {
            log.error("Failed to save search history: ", e);
        }
    }

    // Helper methods for converting models to results
    private Map<String, Object> convertStatuteToResult(AIMAStatute statute) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", statute.getId());
        result.put("type", "statute");
        result.put("title", statute.getTitle());
        result.put("citation", "M.G.L. Ch. " + statute.getChapter() + " § " + statute.getSection());
        result.put("summary", truncateText(statute.getStatuteText(), 300));
        result.put("fullText", statute.getStatuteText());
        result.put("effectiveDate", statute.getEffectiveDate());
        result.put("practiceArea", statute.getPracticeArea());
        return result;
    }

    private Map<String, Object> convertCourtRuleToResult(AIMACourtRule courtRule) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", courtRule.getId());
        result.put("type", "court_rule");
        result.put("title", courtRule.getRuleTitle());
        result.put("citation", courtRule.getCourtLevel() + " Rule " + courtRule.getRuleNumber());
        result.put("summary", truncateText(courtRule.getRuleText(), 300));
        result.put("fullText", courtRule.getRuleText());
        result.put("courtLevel", courtRule.getCourtLevel());
        result.put("effectiveDate", courtRule.getEffectiveDate());
        return result;
    }

    private Map<String, Object> convertSentencingGuidelineToResult(AIMASentencingGuideline guideline) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", guideline.getId());
        result.put("type", "guideline");
        result.put("title", guideline.getOffenseDescription());
        result.put("citation", "Mass. Sentencing Guidelines " + guideline.getOffenseCode());
        result.put("summary", truncateText(guideline.getOffenseDescription() + " - " +
                  (guideline.getMinSentence() != null ? "Min: " + guideline.getMinSentence() : "") +
                  (guideline.getMaxSentence() != null ? " Max: " + guideline.getMaxSentence() : ""), 300));
        result.put("fullText", buildFullGuidelineText(guideline));
        result.put("category", guideline.getCategory());
        result.put("effectiveDate", guideline.getEffectiveDate());
        result.put("offenseCode", guideline.getOffenseCode());
        result.put("statutoryCitation", guideline.getStatutoryCitation());
        return result;
    }

    // Utility methods
    private String generateQueryHash(String query, String searchType, String jurisdiction) {
        try {
            String combined = query + "|" + searchType + "|" + jurisdiction;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            log.error("Failed to generate query hash: ", e);
            return UUID.randomUUID().toString();
        }
    }

    private Map<String, Object> parseAIResponse(String aiResponse) {
        try {
            return objectMapper.readValue(aiResponse, Map.class);
        } catch (JsonProcessingException e) {
            // If it's not JSON, treat as simple text response
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("aiAnalysis", aiResponse);
            result.put("results", Collections.emptyList());
            return result;
        }
    }

    private Double calculateRelevance(String text, String query) {
        if (text == null || query == null) return 0.0;
        String lowerText = text.toLowerCase();
        String lowerQuery = query.toLowerCase();

        // Simple relevance calculation - count query term occurrences
        long count = Arrays.stream(lowerQuery.split("\\s+"))
            .mapToLong(term -> lowerText.split(term).length - 1)
            .sum();

        return (double) count;
    }

    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }

    private String buildFullGuidelineText(AIMASentencingGuideline guideline) {
        StringBuilder text = new StringBuilder();
        text.append("Offense: ").append(guideline.getOffenseDescription()).append("\n");

        if (guideline.getCategory() != null) {
            text.append("Category: ").append(guideline.getCategory()).append("\n");
        }
        if (guideline.getSubcategory() != null) {
            text.append("Subcategory: ").append(guideline.getSubcategory()).append("\n");
        }
        if (guideline.getStatutoryCitation() != null) {
            text.append("Statutory Citation: ").append(guideline.getStatutoryCitation()).append("\n");
        }
        if (guideline.getMinSentence() != null) {
            text.append("Minimum Sentence: ").append(guideline.getMinSentence()).append("\n");
        }
        if (guideline.getMaxSentence() != null) {
            text.append("Maximum Sentence: ").append(guideline.getMaxSentence()).append("\n");
        }
        if (guideline.getMandatoryMinimum() != null && guideline.getMandatoryMinimum()) {
            text.append("Mandatory Minimum: Yes\n");
        }
        if (guideline.getFineRange() != null) {
            text.append("Fine Range: ").append(guideline.getFineRange()).append("\n");
        }
        if (guideline.getPointsValue() != null) {
            text.append("Points Value: ").append(guideline.getPointsValue()).append("\n");
        }
        if (guideline.getEligibilityNotes() != null) {
            text.append("Eligibility Notes: ").append(guideline.getEligibilityNotes()).append("\n");
        }
        if (guideline.getRecentUpdates() != null) {
            text.append("Recent Updates: ").append(guideline.getRecentUpdates()).append("\n");
        }

        return text.toString();
    }

    // Public methods for frontend
    @Transactional(readOnly = true)
    public List<SearchHistory> getUserSearchHistory(Long userId, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        Page<SearchHistory> page = searchHistoryRepository.findByUserIdOrderBySearchedAtDesc(userId, pageable);
        return page.getContent();
    }

    @Transactional(readOnly = true)
    public List<SearchHistory> getSavedSearches(Long userId) {
        return searchHistoryRepository.findByUserIdAndIsSavedTrueOrderBySearchedAtDesc(userId);
    }

    public void saveSearch(Long searchHistoryId) {
        searchHistoryRepository.findById(searchHistoryId).ifPresent(search -> {
            search.setIsSaved(true);
            searchHistoryRepository.save(search);
        });
    }

    public void deleteSearchHistory(Long searchHistoryId, Long userId) {
        searchHistoryRepository.findById(searchHistoryId).ifPresent(search -> {
            if (search.getUserId().equals(userId)) {
                searchHistoryRepository.delete(search);
            }
        });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getExternalApiStatus() {
        Map<String, Object> status = new HashMap<>();

        // Get status from all external APIs in parallel
        CompletableFuture<Map<String, Object>> courtListenerStatus =
            CompletableFuture.supplyAsync(courtListenerService::getApiStatus);
        CompletableFuture<Map<String, Object>> federalRegisterStatus =
            CompletableFuture.supplyAsync(federalRegisterService::getApiStatus);

        try {
            CompletableFuture.allOf(courtListenerStatus, federalRegisterStatus).get();

            status.put("courtListener", courtListenerStatus.get());
            status.put("federalRegister", federalRegisterStatus.get());

            // Calculate overall status
            boolean allConfigured = (Boolean) courtListenerStatus.get().get("configured") &&
                                  (Boolean) federalRegisterStatus.get().get("configured");

            boolean allAvailable = (Boolean) courtListenerStatus.get().getOrDefault("available", false) &&
                                 (Boolean) federalRegisterStatus.get().getOrDefault("available", false);

            status.put("overallConfigured", allConfigured);
            status.put("overallAvailable", allAvailable);
            status.put("lastChecked", new Date());

        } catch (Exception e) {
            log.error("Error checking external API status: ", e);
            status.put("error", "Failed to check API status: " + e.getMessage());
        }

        return status;
    }

    // Helper method to convert FrDocument DTOs to Map for compatibility with existing code
    private List<Map<String, Object>> convertFrDocumentsToMaps(List<FrDocument> documents) {
        List<Map<String, Object>> results = new ArrayList<>();

        for (FrDocument doc : documents) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", doc.getDocumentNumber());
            map.put("type", "federal_register_" + (doc.getType() != null ? doc.getType().toLowerCase() : "document"));
            map.put("title", doc.getTitle());
            map.put("documentNumber", doc.getDocumentNumber());
            map.put("publicationDate", doc.getPublicationDate() != null ? doc.getPublicationDate().toString() : null);
            map.put("documentType", doc.getDocumentType());
            map.put("summary", doc.getSummary());
            map.put("htmlUrl", doc.getHtmlUrl());
            map.put("pdfUrl", doc.getPdfUrl());
            map.put("federalRegisterUrl", doc.getFederalRegisterUrl());
            map.put("source", doc.getSource());

            // Convert agencies to list of names for backward compatibility
            if (doc.getAgencies() != null) {
                List<String> agencyNames = doc.getAgencies().stream()
                    .map(agency -> agency.getName())
                    .filter(name -> name != null && !name.isEmpty())
                    .collect(Collectors.toList());
                map.put("agencies", agencyNames);
            }

            results.add(map);
        }

        return results;
    }
}