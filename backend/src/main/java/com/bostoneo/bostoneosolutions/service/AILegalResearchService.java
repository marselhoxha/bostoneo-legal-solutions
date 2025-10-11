package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.service.external.CourtListenerService;
import com.bostoneo.bostoneosolutions.service.external.FederalRegisterService;
import com.bostoneo.bostoneosolutions.service.external.MassachusettsLegalService;
import com.bostoneo.bostoneosolutions.dto.FrDocument;
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

    private final AIResearchCacheRepository cacheRepository;
    private final SearchHistoryRepository searchHistoryRepository;
    private final ResearchSessionRepository sessionRepository;
    private final ResearchAnnotationRepository annotationRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ClaudeSonnet4Service claudeService;
    private final CourtListenerService courtListenerService;
    private final FederalRegisterService federalRegisterService;
    private final MassachusettsLegalService massachusettsLegalService;
    private final ImmigrationKnowledgeService immigrationKnowledgeService;
    private final MassachusettsCivilProcedureService massachusettsCivilProcedureService;
    private final ResearchProgressPublisher progressPublisher;
    private final ObjectMapper objectMapper;

    public Map<String, Object> performSearch(Map<String, Object> searchRequest) {
        log.info("Legal research search request: {}", searchRequest);

        String query = (String) searchRequest.get("query");
        String searchType = (String) searchRequest.getOrDefault("searchType", "all");
        String jurisdiction = (String) searchRequest.getOrDefault("jurisdiction", "massachusetts");
        Long userId = searchRequest.containsKey("userId") ? Long.valueOf(searchRequest.get("userId").toString()) : null;
        String sessionId = (String) searchRequest.get("sessionId");
        // CRITICAL: Extract caseId to ensure cache differentiation between different cases
        // Without this, same query for different cases would return cached results from wrong case
        String caseId = (String) searchRequest.get("caseId");

        log.info("Parsed search parameters - query: '{}', searchType: '{}', jurisdiction: '{}', caseId: '{}'",
                 query, searchType, jurisdiction, caseId != null ? caseId : "general");

        long startTime = System.currentTimeMillis();

        try {
            // Step 1: Understanding the query (10% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "query_analysis",
                    "Understanding your legal question",
                    query,
                    "ri-file-search-line",
                    10);
            }

            // Check if we have a cached result
            // IMPORTANT: Include caseId in hash so different cases don't share cached responses
            String queryHash = generateQueryHash(query, searchType, jurisdiction, caseId);
            Optional<AIResearchCache> cachedResult = cacheRepository.findByQueryHash(queryHash);

            if (cachedResult.isPresent() && cachedResult.get().getIsValid() &&
                cachedResult.get().getExpiresAt().isAfter(LocalDateTime.now())) {

                log.info("✓ CACHE HIT - Returning cached result for query: '{}', caseId: '{}', hash: {}",
                         query, caseId != null ? caseId : "general", queryHash.substring(0, 16) + "...");

                // Update cache usage
                AIResearchCache cache = cachedResult.get();
                cache.setUsageCount(cache.getUsageCount() + 1);
                cache.setLastUsed(LocalDateTime.now());
                cacheRepository.save(cache);

                // Still save search history
                saveSearchHistory(userId, sessionId, query, searchType, 0,
                                System.currentTimeMillis() - startTime);

                // Complete immediately for cached results
                if (sessionId != null) {
                    progressPublisher.publishComplete(sessionId, "Research completed (cached result)");
                }

                return parseAIResponse(cache.getAiResponse());
            }

            // Step 2: Searching legal databases (30% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "database_search",
                    "Searching Massachusetts statutes and regulations",
                    "Querying legal databases...",
                    "ri-search-line",
                    30);
            }

            // Perform new search
            log.info("✗ CACHE MISS - Performing new search for query: '{}', caseId: '{}'",
                     query, caseId != null ? caseId : "general");
            Map<String, Object> searchResults = executeSearch(query, searchType, jurisdiction);

            // Step 3: AI Analysis (60% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "ai_analysis",
                    "Analyzing legal sources with Claude AI",
                    "Processing " + searchResults.getOrDefault("totalResults", 0) + " legal sources...",
                    "ri-brain-line",
                    60);
            }

            // Generate AI analysis
            CompletableFuture<String> aiAnalysis = generateAIAnalysis(query, searchResults,
                                                                    QueryType.valueOf(searchType.toUpperCase()), caseId);

            // Wait for AI analysis
            String analysis = aiAnalysis.join();

            // Step 4: Preparing response (90% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "response_generation",
                    "Preparing comprehensive answer",
                    "Formatting legal analysis...",
                    "ri-quill-pen-line",
                    90);
            }

            // Cache the result with case-specific hash
            cacheAIResult(queryHash, query, searchType, jurisdiction, caseId, analysis);

            // Combine results with AI analysis
            Map<String, Object> finalResults = combineResultsWithAI(searchResults, analysis);

            // Save search history
            saveSearchHistory(userId, sessionId, query, searchType,
                            (Integer) finalResults.getOrDefault("totalResults", 0),
                            System.currentTimeMillis() - startTime);

            // Step 5: Complete (100% progress)
            if (sessionId != null) {
                progressPublisher.publishComplete(sessionId, "Research completed successfully");
            }

            return finalResults;

        } catch (Exception e) {
            log.error("Error performing search: ", e);

            // Publish error event
            if (sessionId != null) {
                progressPublisher.publishError(sessionId, "Search failed: " + e.getMessage());
            }

            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "Search failed: " + e.getMessage());
            errorResult.put("results", Collections.emptyList());
            return errorResult;
        }
    }

    private Map<String, Object> executeSearch(String query, String searchType, String jurisdiction) {
        log.info("Executing search with query: '{}', searchType: '{}', jurisdiction: '{}'", query, searchType, jurisdiction);
        Map<String, Object> results = new HashMap<>();
        List<Map<String, Object>> allResults = new ArrayList<>();
        int totalCount = 0;

        try {
            // Check if this is an immigration query first (always federal)
            boolean isImmigrationQuery = isImmigrationQuery(query);

            if (isImmigrationQuery) {
                // For immigration queries, skip state sources and focus on federal
                log.info("Detected IMMIGRATION QUERY - routing to federal sources only");

                // Add structured immigration knowledge
                Map<String, Object> immigrationGuidance = immigrationKnowledgeService.getStructuredImmigrationGuidance(query);
                results.put("structuredImmigrationData", immigrationGuidance);
                log.info("Added structured immigration guidance to results");
            } else if (isMassachusettsCivilProcedureQuery(query)) {
                log.info("Detected MASSACHUSETTS CIVIL PROCEDURE QUERY - routing to state sources");

                // Add structured Massachusetts civil procedure knowledge
                Map<String, Object> civilProcedureGuidance = massachusettsCivilProcedureService.getStructuredCivilProcedureGuidance(query);
                results.put("structuredMassachusettsCivilProcedureData", civilProcedureGuidance);
                log.info("Added structured Massachusetts civil procedure guidance to results");

            } else {
                // Check if this is a Massachusetts state law query
                boolean isStateLawQuery = isStateLawQuery(query);

                if (isStateLawQuery) {
                    // For Massachusetts queries, fetch directly from official sources
                    log.info("Detected Massachusetts state law query - fetching from official sources");
                    List<Map<String, Object>> massResults = massachusettsLegalService.searchMassachusettsLaw(query);
                    allResults.addAll(massResults);
                    totalCount += massResults.size();
                    log.info("Massachusetts Legal Service returned {} results", massResults.size());
                }
            }

            // Search External APIs (parallel execution for better performance)
            List<CompletableFuture<List<Map<String, Object>>>> externalSearches = new ArrayList<>();

            // Court Listener API - search opinions and dockets
            if ("all".equalsIgnoreCase(searchType) || "cases".equalsIgnoreCase(searchType) || "opinions".equalsIgnoreCase(searchType)) {
                externalSearches.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        // For immigration queries, enhance the search and set appropriate jurisdiction
                        String searchQuery = query;
                        String searchJurisdiction = jurisdiction;
                        if (isImmigrationQuery(query)) {
                            // Immigration cases are federal - search federal courts
                            searchJurisdiction = "federal";
                            // Enhance the query for better immigration case results
                            searchQuery = enhanceImmigrationQueryForCourtListener(query);
                            log.info("Enhanced Court Listener immigration query from '{}' to '{}'", query, searchQuery);
                        }

                        List<Map<String, Object>> opinions = courtListenerService.searchOpinions(searchQuery, searchJurisdiction, null, null);
                        List<Map<String, Object>> dockets = courtListenerService.searchDockets(searchQuery, searchJurisdiction);
                        List<Map<String, Object>> combined = new ArrayList<>(opinions);
                        combined.addAll(dockets);
                        return combined;
                    } catch (Exception e) {
                        log.warn("Error searching Court Listener: ", e);
                        return Collections.emptyList();
                    }
                }));
            }


            // Federal Register API - only use for federal regulatory queries
            boolean useFederalRegister = shouldUseFederalRegister(query, searchType);
            if (useFederalRegister) {
                log.info("Starting Federal Register search for searchType: {}, query: {} (intelligent classification: YES)", searchType, query);
                externalSearches.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        // Enhance query for immigration-specific searches
                        String enhancedQuery = query;
                        if (isImmigrationQuery(query)) {
                            // For immigration queries, make the search more specific
                            enhancedQuery = enhanceImmigrationQuery(query);
                            log.info("Enhanced immigration query from '{}' to '{}'", query, enhancedQuery);
                        }

                        log.info("Executing Federal Register API calls for query: {}", enhancedQuery);
                        List<FrDocument> rules = federalRegisterService.searchRules(enhancedQuery, null, null);
                        log.info("Federal Register rules search returned {} results", rules.size());
                        if (!rules.isEmpty()) {
                            log.error("🟢🟢🟢 BEFORE CONVERSION - First rule title: {}", rules.get(0).getTitle());
                        }

                        List<FrDocument> proposedRules = federalRegisterService.searchProposedRules(enhancedQuery, null, null);
                        log.info("Federal Register proposed rules search returned {} results", proposedRules.size());
                        if (!proposedRules.isEmpty()) {
                            log.error("🟢🟢🟢 BEFORE CONVERSION - First proposed rule title: {}", proposedRules.get(0).getTitle());
                        }

                        List<FrDocument> notices = federalRegisterService.searchNotices(enhancedQuery, null, null);
                        log.info("Federal Register notices search returned {} results", notices.size());
                        if (!notices.isEmpty()) {
                            log.error("🟢🟢🟢 BEFORE CONVERSION - First notice title: {}", notices.get(0).getTitle());
                        }

                        // Convert FrDocument to Map<String, Object> for compatibility
                        List<Map<String, Object>> combined = new ArrayList<>();
                        List<Map<String, Object>> rulesConverted = convertFrDocumentsToMaps(rules);
                        if (!rulesConverted.isEmpty()) {
                            log.error("🟡🟡🟡 AFTER CONVERSION - First rule title: {}", rulesConverted.get(0).get("title"));
                        }
                        combined.addAll(rulesConverted);

                        List<Map<String, Object>> proposedRulesConverted = convertFrDocumentsToMaps(proposedRules);
                        if (!proposedRulesConverted.isEmpty()) {
                            log.error("🟡🟡🟡 AFTER CONVERSION - First proposed rule title: {}", proposedRulesConverted.get(0).get("title"));
                        }
                        combined.addAll(proposedRulesConverted);

                        List<Map<String, Object>> noticesConverted = convertFrDocumentsToMaps(notices);
                        if (!noticesConverted.isEmpty()) {
                            log.error("🟡🟡🟡 AFTER CONVERSION - First notice title: {}", noticesConverted.get(0).get("title"));
                        }
                        combined.addAll(noticesConverted);

                        // Filter results for relevance if this is an immigration query
                        if (isImmigrationQuery(query)) {
                            int originalSize = combined.size();
                            // Remove filtering - it's too restrictive and removes valid results
                            // Instead, trust the enhanced query to return relevant results
                            log.info("Federal Register returned {} results for immigration query (no additional filtering)", combined.size());
                        }

                        log.info("Federal Register total combined results: {}", combined.size());
                        if (!combined.isEmpty()) {
                            log.error("🟣🟣🟣 COMBINED - First result title: {}", combined.get(0).get("title"));
                            log.error("🟣🟣🟣 COMBINED - First result source: {}", combined.get(0).get("source"));
                        }
                        return combined;
                    } catch (Exception e) {
                        log.error("Error searching Federal Register: ", e);
                        return Collections.emptyList();
                    }
                }));
                log.info("Federal Register CompletableFuture added to externalSearches");
            } else {
                log.info("Federal Register search skipped for searchType: {}, query: {} (intelligent classification: NO)", searchType, query);
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

            // Web search enhancement removed - consolidated into single AI call
            log.info("Skipping separate web search enhancement - will be handled in comprehensive AI analysis");

            // Sort results by relevance (this is simplified - could be more sophisticated)

            // Filter out completely irrelevant results before sorting
            allResults = allResults.stream()
                .filter(result -> {
                    String title = (String) result.get("title");
                    String summary = (String) result.get("summary");
                    String source = (String) result.get("source");
                    String content = (title + " " + (summary != null ? summary : "")).toLowerCase();
                    String queryLower = query.toLowerCase();

                    // For Federal Register results, be more lenient with filtering
                    if ("Federal Register".equals(source)) {
                        // For immigration queries, only filter out obviously irrelevant content
                        if (isImmigrationQuery(query)) {
                            // Filter out clearly non-immigration content that damages credibility
                            if (content.contains("viticultural") || content.contains("wine") ||
                                content.contains("food safety") || content.contains("pharmaceutical") ||
                                content.contains("securities and exchange") || content.contains("depository trust") ||
                                content.contains("marine mammals") || content.contains("environmental protection") ||
                                title.contains("AVA") || title.contains("Wine") || title.contains("SEC") ||
                                title.contains("Treasury Department") || title.contains("Commerce Department") ||
                                title.contains("Defense Department")) {
                                log.debug("Filtering out non-immigration Federal Register result: {}", title);
                                return false;
                            }
                            // For immigration, also require some immigration-related terms
                            if (content.contains("immigration") || content.contains("bia") ||
                                content.contains("eoir") || content.contains("uscis") ||
                                content.contains("deportation") || content.contains("removal") ||
                                content.contains("asylum") || content.contains("visa") ||
                                content.contains("8 cfr") || content.contains("homeland security") ||
                                content.contains("department of justice")) {
                                return true;
                            }
                            // If no immigration keywords, filter out
                            log.debug("Filtering out Federal Register result with no immigration keywords: {}", title);
                            return false;
                        }

                        // Check for agency-specific terms with expanded matching
                        if (queryLower.contains("epa") || queryLower.contains("environmental")) {
                            if (content.contains("environmental protection agency") ||
                                content.contains("epa") ||
                                content.contains("clean air") ||
                                content.contains("clean water") ||
                                content.contains("environmental")) {
                                return true;
                            }
                        }

                        if (queryLower.contains("sec") || queryLower.contains("securities")) {
                            if (content.contains("securities and exchange commission") ||
                                content.contains("sec") ||
                                content.contains("securities") ||
                                content.contains("exchange commission")) {
                                return true;
                            }
                        }

                        // For other Federal Register queries, since we've already filtered at the API level
                        // with agency filters and search terms, we should trust those results
                        // Only filter out completely unrelated documents
                        String[] significantTerms = queryLower.split("\\s+");
                        int matchCount = 0;
                        int totalSignificantTerms = 0;

                        for (String term : significantTerms) {
                            // Skip common words and very short terms
                            if (term.length() > 2 &&
                                !term.equals("from") && !term.equals("with") && !term.equals("that") &&
                                !term.equals("the") && !term.equals("and") && !term.equals("for")) {
                                totalSignificantTerms++;
                                if (content.contains(term)) {
                                    matchCount++;
                                }
                            }
                        }

                        // For Federal Register, be very lenient since API already filtered
                        // Include if ANY significant term matches (since API did the main filtering)
                        return totalSignificantTerms == 0 || matchCount > 0;
                    }

                    // For non-Federal Register sources, use standard relevance scoring
                    double relevanceScore = 0;
                    for (String term : queryLower.split("\\s+")) {
                        if (content.contains(term)) {
                            relevanceScore++;
                        }
                    }

                    // Keep only if at least 30% of query terms match for other sources
                    return relevanceScore >= (queryLower.split("\\s+").length * 0.3);
                })
                .collect(Collectors.toList());

            allResults.sort((a, b) -> {
                String titleA = (String) a.get("title");
                String titleB = (String) b.get("title");
                // Sort by relevance in DESCENDING order (most relevant first)
                return calculateRelevance(titleB, query).compareTo(calculateRelevance(titleA, query));
            });


            // Autonomous research removed - consolidated into single comprehensive AI call
            log.info("Autonomous research will be handled in single comprehensive AI analysis");

            // Debug logging to see what results are being returned
            log.info("executeSearch complete - Total results: {}", totalCount);
            log.info("Result breakdown - allResults.size(): {}", allResults.size());

            // Log sources of results
            Map<String, Long> sourceCount = allResults.stream()
                .collect(Collectors.groupingBy(
                    result -> (String) result.getOrDefault("source", "unknown"),
                    Collectors.counting()
                ));
            log.info("Results by source: {}", sourceCount);

            // Log sample Federal Register titles
            List<String> federalRegisterTitles = allResults.stream()
                .filter(result -> "Federal Register".equals(result.get("source")))
                .limit(3)
                .map(result -> (String) result.get("title"))
                .collect(Collectors.toList());
            log.info("Sample Federal Register titles: {}", federalRegisterTitles);

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



    private CompletableFuture<String> generateAIAnalysis(String query, Map<String, Object> searchResults, QueryType queryType, String caseId) {
        // Debug logging for AI input
        log.info("generateAIAnalysis called with query: '{}'", query);
        log.info("searchResults totalResults: {}", searchResults.get("totalResults"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) searchResults.get("results");
        if (results != null) {
            log.info("AI is receiving {} results", results.size());

            // Log sources being sent to AI
            Map<String, Long> aiSourceCount = results.stream()
                .collect(Collectors.groupingBy(
                    result -> (String) result.getOrDefault("source", "unknown"),
                    Collectors.counting()
                ));
            log.info("AI input - Results by source: {}", aiSourceCount);

            // Log sample Federal Register titles being sent to AI
            List<String> aiFederalRegisterTitles = results.stream()
                .filter(result -> "Federal Register".equals(result.get("source")))
                .limit(3)
                .map(result -> (String) result.get("title"))
                .collect(Collectors.toList());
            log.info("AI input - Sample Federal Register titles: {}", aiFederalRegisterTitles);
        } else {
            log.warn("AI is receiving NULL results list!");
        }

        String prompt = buildAIPrompt(query, searchResults, queryType, caseId);

        return claudeService.generateCompletion(prompt, false)
            .exceptionally(throwable -> {
                log.error("AI analysis failed: ", throwable);
                return "AI analysis temporarily unavailable. Please review the search results manually.";
            });
    }

    private String buildAIPrompt(String query, Map<String, Object> searchResults, QueryType queryType, String caseId) {
        StringBuilder prompt = new StringBuilder();

        // Detect query type for specialized prompt
        QueryCategory category = detectQueryCategory(query);

        // Detect jurisdiction and adjust prompt accordingly
        boolean isImmigrationQuery = isImmigrationQuery(query);
        String jurisdiction = isImmigrationQuery ? "Federal/Immigration" :
                            (isStateLawQuery(query) ? "Massachusetts State" : "General");

        prompt.append("You are an expert legal research assistant specializing in ").append(jurisdiction).append(" law.\n\n");

        prompt.append("**IMPORTANT - CONCISE RESPONSE FORMAT**:\n");
        prompt.append("- Provide a brief, direct answer (2-3 paragraphs maximum)\n");
        prompt.append("- Focus on the most relevant information for the specific query\n");
        prompt.append("- Use clear, confident language based on your legal knowledge\n");
        prompt.append("- Even if no documents were retrieved, provide substantive legal guidance based on your knowledge of ").append(jurisdiction).append(" law\n");
        prompt.append("- DO NOT apologize for lack of documents - just provide the best answer you can\n");
        prompt.append("- After your answer, suggest 3-5 relevant follow-up questions the user might ask\n");
        prompt.append("- Keep the total response concise and actionable\n\n");

        // Add comprehensive case context if available
        if (caseId != null && !caseId.isEmpty()) {
            try {
                Long caseIdLong = Long.parseLong(caseId);
                legalCaseRepository.findById(caseIdLong).ifPresent(legalCase -> {
                    prompt.append("**CRITICAL - CASE-SPECIFIC CONTEXT**:\n");
                    prompt.append("This research is for a SPECIFIC active case. Your response MUST be tailored to this case's details.\n\n");

                    // Basic Case Information
                    prompt.append("**Case Identification:**\n");
                    prompt.append("- Case Number: ").append(legalCase.getCaseNumber()).append("\n");
                    prompt.append("- Case Title: ").append(legalCase.getTitle()).append("\n");
                    prompt.append("- Case Type: ").append(legalCase.getType() != null ? legalCase.getType() : "General").append("\n");

                    // Full description (not truncated)
                    if (legalCase.getDescription() != null && !legalCase.getDescription().isEmpty()) {
                        prompt.append("- Case Description: ").append(legalCase.getDescription()).append("\n");
                    }

                    // Court and Jurisdiction Information
                    String courtName = legalCase.getCourtName();
                    String jurisdictionType = "UNKNOWN";
                    String applicableRules = "applicable procedural rules";

                    if (courtName != null && !courtName.isEmpty()) {
                        prompt.append("- Court: ").append(courtName).append("\n");

                        // Determine jurisdiction from court name
                        String courtLower = courtName.toLowerCase();
                        if (courtLower.contains("u.s. district") || courtLower.contains("federal") ||
                            courtLower.contains("usdc") || courtLower.contains("united states district")) {
                            jurisdictionType = "FEDERAL";
                            applicableRules = "Federal Rules of Civil Procedure (FRCP)";
                        } else if (courtLower.contains("superior") || courtLower.contains("massachusetts") ||
                                   courtLower.contains("district court") || courtLower.contains("ma ")) {
                            jurisdictionType = "STATE";
                            applicableRules = "Massachusetts Rules of Civil Procedure (Mass. R. Civ. P.)";
                        }

                        if (legalCase.getCourtroom() != null && !legalCase.getCourtroom().isEmpty()) {
                            prompt.append("- Courtroom: ").append(legalCase.getCourtroom()).append("\n");
                        }
                        if (legalCase.getJudgeName() != null && !legalCase.getJudgeName().isEmpty()) {
                            prompt.append("- Judge: ").append(legalCase.getJudgeName()).append("\n");
                        }
                    }

                    // Case Status and Priority
                    if (legalCase.getStatus() != null) {
                        prompt.append("- Status: ").append(legalCase.getStatus()).append("\n");
                    }
                    if (legalCase.getPriority() != null) {
                        prompt.append("- Priority: ").append(legalCase.getPriority()).append("\n");
                    }

                    // Important Dates and Procedural Posture
                    prompt.append("\n**Procedural Timeline:**\n");
                    String proceduralStage = "Unknown stage";

                    if (legalCase.getFilingDate() != null) {
                        prompt.append("- Filing Date: ").append(legalCase.getFilingDate()).append("\n");

                        // Calculate days since filing
                        long daysSinceFiling = (new Date().getTime() - legalCase.getFilingDate().getTime()) / (1000 * 60 * 60 * 24);

                        if (daysSinceFiling < 90) {
                            proceduralStage = "Early litigation (within 90 days of filing)";
                        } else if (daysSinceFiling < 180) {
                            proceduralStage = "Active discovery phase";
                        } else {
                            proceduralStage = "Advanced litigation";
                        }
                    } else {
                        proceduralStage = "Pre-filing stage (case not yet filed)";
                    }

                    if (legalCase.getNextHearing() != null) {
                        prompt.append("- Next Hearing: ").append(legalCase.getNextHearing()).append("\n");
                        proceduralStage = "Active litigation with upcoming hearing";
                    }
                    if (legalCase.getTrialDate() != null) {
                        prompt.append("- Trial Date: ").append(legalCase.getTrialDate()).append("\n");
                        proceduralStage = "Trial preparation phase";
                    }

                    prompt.append("- Current Procedural Stage: ").append(proceduralStage).append("\n");

                    // Client Information
                    prompt.append("\n**Client Information:**\n");
                    prompt.append("- Client: ").append(legalCase.getClientName()).append("\n");

                    // CRITICAL INSTRUCTIONS FOR AI
                    prompt.append("\n**CRITICAL INSTRUCTIONS - READ CAREFULLY**:\n");
                    prompt.append("1. JURISDICTION: This case is in ").append(jurisdictionType).append(" court.\n");
                    prompt.append("   - You MUST use ONLY ").append(applicableRules).append("\n");
                    prompt.append("   - DO NOT mix federal and state procedural rules\n");
                    prompt.append("   - DO NOT contradict yourself about which court system applies\n\n");

                    prompt.append("2. PROCEDURAL POSTURE: This case is in the \"").append(proceduralStage).append("\" stage.\n");
                    prompt.append("   - Tailor your recommendations to what is appropriate at THIS specific stage\n");
                    prompt.append("   - If suggesting motions, specify deadlines based on the filing date and procedural rules\n\n");

                    // Case-type-specific instructions
                    String caseType = legalCase.getType() != null ? legalCase.getType().toLowerCase() : "";
                    if (caseType.contains("data breach") || caseType.contains("privacy")) {
                        prompt.append("3. CASE-SPECIFIC FOCUS: This is a DATA BREACH/PRIVACY case.\n");
                        prompt.append("   - Address Article III standing issues (injury-in-fact requirements for data breach)\n");
                        prompt.append("   - Consider credit monitoring, identity theft concerns, and notification obligations\n");
                        prompt.append("   - Reference applicable consumer protection statutes (e.g., state data breach laws, FCRA)\n");
                        prompt.append("   - If class action, address data breach-specific class certification challenges\n\n");
                    } else if (caseType.contains("malpractice") || caseType.contains("medical negligence")) {
                        prompt.append("3. CASE-SPECIFIC FOCUS: This is a MEDICAL MALPRACTICE case.\n");
                        prompt.append("   - **Massachusetts Requirements**: Expert testimony REQUIRED to establish standard of care and causation (Mass. G.L. c. 231, §60B)\n");
                        prompt.append("   - **Tribunal Requirement**: If in state court, must go through medical malpractice tribunal first; if in FEDERAL court, tribunal MAY NOT apply under Erie doctrine\n");
                        prompt.append("   - **Res Ipsa Loquitur**: Rarely applies in Massachusetts medical malpractice - expert testimony generally required even for obvious errors\n");
                        prompt.append("   - **Statute of Limitations**: 3 years from date of injury or discovery of injury (Mass. G.L. c. 260, §2A), but not more than 7 years from act/omission\n");
                        prompt.append("   - **Expert Disclosure**: Critical to retain board-certified experts early - deadline typically 90-120 days before trial or per scheduling order\n");
                        prompt.append("   - **Informed Consent**: Consider separate informed consent claims under Massachusetts common law if applicable\n");
                        prompt.append("   - **Damages Cap**: Massachusetts has NO cap on medical malpractice damages (unlike many states)\n\n");
                    } else if (caseType.contains("class action")) {
                        prompt.append("3. CASE-SPECIFIC FOCUS: This is a CLASS ACTION.\n");
                        prompt.append("   - Address Rule 23 requirements (numerosity, commonality, typicality, adequacy)\n");
                        prompt.append("   - Consider class certification timing and strategy\n");
                        prompt.append("   - Address notice requirements and settlement approval procedures\n\n");
                    } else if (caseType.contains("employment")) {
                        prompt.append("3. CASE-SPECIFIC FOCUS: This is an EMPLOYMENT case.\n");
                        prompt.append("   - Address applicable employment laws and administrative exhaustion requirements\n");
                        prompt.append("   - Consider discovery of personnel files and employment records\n\n");
                    } else if (caseType.contains("trade secret") || caseType.contains("misappropriation")) {
                        prompt.append("3. CASE-SPECIFIC FOCUS: This is a TRADE SECRETS case.\n");
                        prompt.append("   - Address Defend Trade Secrets Act (DTSA) federal claims and/or state trade secret law\n");
                        prompt.append("   - **Identification Requirement**: Must identify trade secrets with reasonable particularity\n");
                        prompt.append("   - **Protection Measures**: Show reasonable steps taken to maintain secrecy (NDAs, access controls, etc.)\n");
                        prompt.append("   - **Preliminary Injunction**: Consider immediate injunctive relief to prevent ongoing misappropriation\n");
                        prompt.append("   - **Irreparable Harm**: Trade secrets lose value once disclosed - emphasize cannot be \"un-rung\"\n\n");
                    } else if (caseType.contains("immigration") || caseType.contains("removal") || caseType.contains("asylum")) {
                        prompt.append("3. CASE-SPECIFIC FOCUS: This is an IMMIGRATION case.\n");
                        prompt.append("   - **Dual Proceedings**: If criminal charges exist, coordinate immigration and criminal defense strategy carefully\n");
                        prompt.append("   - **Aggravated Felony**: Any aggravated felony conviction = mandatory removal with no relief\n");
                        prompt.append("   - **Asylum Requirements**: Must show past persecution or well-founded fear on account of protected ground\n");
                        prompt.append("   - **Country Conditions**: Expert testimony on home country conditions often critical\n");
                        prompt.append("   - **Padilla Warning**: Criminal defense counsel MUST advise on immigration consequences of pleas\n\n");
                    }

                    prompt.append("4. PRACTICAL FOCUS: Provide SPECIFIC, ACTIONABLE guidance for THIS case.\n");
                    prompt.append("   - Base your answer on the case facts and procedural posture provided above\n");
                    prompt.append("   - Do NOT give generic legal education; give specific next steps\n");
                    prompt.append("   - If the user's question doesn't make sense at this procedural stage, explain why\n\n");

                    // Judge personalization
                    if (legalCase.getJudgeName() != null && !legalCase.getJudgeName().isEmpty()) {
                        prompt.append("5. PERSONALIZATION: Reference the assigned judge by name when discussing hearings, motions, or rulings.\n");
                        prompt.append("   - The judge assigned to this case is: ").append(legalCase.getJudgeName()).append("\n");
                        prompt.append("   - Example: \"").append(legalCase.getJudgeName()).append(" will hear the motion on...\"\n");
                        prompt.append("   - Example: \"You should file with ").append(legalCase.getJudgeName()).append("'s courtroom procedures in mind\"\n\n");
                    }

                    // Deadline urgency calculation
                    if (legalCase.getNextHearing() != null) {
                        long daysToHearing = (legalCase.getNextHearing().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
                        if (daysToHearing > 0 && daysToHearing < 45) {
                            String urgencyLevel = daysToHearing < 15 ? "CRITICAL URGENCY" :
                                                 daysToHearing < 30 ? "URGENT" : "TIME-SENSITIVE";
                            prompt.append("6. ").append(urgencyLevel).append(" - UPCOMING DEADLINE:\n");
                            prompt.append("   - Next hearing/deadline: ").append(legalCase.getNextHearing()).append(" (").append(daysToHearing).append(" days from now)\n");
                            if (daysToHearing < 30 && legalCase.getPriority() != null &&
                                (legalCase.getPriority().toString().equals("URGENT") || legalCase.getPriority().toString().equals("HIGH"))) {
                                prompt.append("   - **EMPHASIZE IMMEDIATE ACTION REQUIRED** - This is a high-priority case with imminent deadline\n");
                                prompt.append("   - User needs to act NOW to meet this deadline\n");
                            }
                            prompt.append("\n");
                        }
                    }

                    // Legal citation disclaimer
                    prompt.append("**CRITICAL - LEGAL CITATION DISCLAIMER**:\n");
                    prompt.append("⚠️ IMPORTANT: If you cite any cases, statutes, or legal authorities in your response:\n");
                    prompt.append("   - Include this disclaimer: \"⚠️ VERIFY ALL CASE CITATIONS: I cannot guarantee the accuracy of specific case citations, pin cites, or holdings. Always independently verify any cases, statutes, or legal authorities cited before relying on them in court filings or legal advice.\"\n");
                    prompt.append("   - Use phrases like: \"Research cases such as [Case Name]\" or \"Cases addressing this issue include...\" rather than stating holdings as definitive facts\n");
                    prompt.append("   - If uncertain about a citation, say: \"Consult Westlaw/Lexis to find controlling authority on [issue]\"\n");
                    prompt.append("   - NEVER invent case names, citations, or holdings\n\n");

                    // Document drafting expectations
                    prompt.append("**DOCUMENT DRAFTING LIMITATIONS**:\n");
                    prompt.append("   - If user requests you to \"draft\" a legal document (motion, brief, complaint, contract):\n");
                    prompt.append("   - Clarify: \"I can provide a detailed outline and key arguments, but cannot generate a complete, court-ready legal document\"\n");
                    prompt.append("   - Provide: Structure, legal standards, key arguments, case theories, and strategic considerations\n");
                    prompt.append("   - Advise: \"You'll need to draft the formal document with proper formatting, caption, signature blocks, and certificates\"\n\n");
                });
            } catch (NumberFormatException e) {
                log.warn("Invalid caseId format: {}", caseId);
            }
        }

        // Simplified - no special warnings or jurisdictional notices
        if (isImmigrationQuery) {
            @SuppressWarnings("unchecked")
            Map<String, Object> structuredData = (Map<String, Object>) searchResults.get("structuredImmigrationData");
            if (structuredData != null) {
                try {
                    String structuredJson = objectMapper.writeValueAsString(structuredData);
                    prompt.append("**Immigration Law Procedures:**\n").append(structuredJson).append("\n\n");
                } catch (Exception e) {
                    log.warn("Could not serialize structured data", e);
                }
            }
        }

        // Simplified Massachusetts civil procedure data
        @SuppressWarnings("unchecked")
        Map<String, Object> massStructuredData = (Map<String, Object>) searchResults.get("structuredMassachusettsCivilProcedureData");
        if (massStructuredData != null) {
            try {
                String structuredJson = objectMapper.writeValueAsString(massStructuredData);
                prompt.append("**Massachusetts Civil Procedure Data:**\n").append(structuredJson).append("\n\n");
            } catch (Exception e) {
                log.warn("Could not serialize Massachusetts civil procedure structured data", e);
            }
        }

        prompt.append("**Legal Query:** ").append(query).append("\n");
        prompt.append("**Jurisdiction:** ").append(jurisdiction).append("\n\n");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) searchResults.get("results");

        // Include detailed document content (increased from 500 to 2000 characters)
        prompt.append("=== LEGAL DOCUMENTS FOUND ===\n");
        prompt.append("Total: ").append(results.size()).append(" documents\n\n");

        // Group results by source for better organization, prioritizing AI Web Research
        Map<String, List<Map<String, Object>>> resultsBySource = results.stream()
            .collect(Collectors.groupingBy(r -> (String) r.getOrDefault("source", "Other")));

        // Special handling for AI Web Research results
        boolean hasWebResearch = resultsBySource.containsKey("AI Web Research");
        if (hasWebResearch) {
            prompt.append("🌐 **AUTONOMOUS WEB RESEARCH FINDINGS AVAILABLE** 🌐\n");
            prompt.append("The system has conducted autonomous web research to supplement database results.\n");
            prompt.append("These findings should be prioritized for comprehensive legal guidance.\n\n");
        }

        int resultsIncluded = 0;

        // Process AI Web Research first if available
        if (hasWebResearch) {
            List<Map<String, Object>> webResults = resultsBySource.get("AI Web Research");
            prompt.append("--- 🌐 AI WEB RESEARCH (").append(webResults.size()).append(" comprehensive analysis) ---\n");

            for (Map<String, Object> result : webResults) {
                prompt.append("\n").append(resultsIncluded + 1).append(". ").append(result.get("title")).append("\n");
                prompt.append("   Type: AUTONOMOUS LEGAL RESEARCH\n");

                // Include web search findings details
                @SuppressWarnings("unchecked")
                Map<String, Object> webFindings = (Map<String, Object>) result.get("webFindings");
                if (webFindings != null) {
                    prompt.append("   Research Strategy: ").append(webFindings.get("searchStrategy")).append("\n");
                    prompt.append("   Confidence Level: ").append(webFindings.get("confidenceLevel")).append("\n");

                    // Include legal authorities found
                    @SuppressWarnings("unchecked")
                    Map<String, Object> legalAuthorities = (Map<String, Object>) webFindings.get("legalAuthorities");
                    if (legalAuthorities != null) {
                        prompt.append("   Legal Authorities Found:\n");
                        if (legalAuthorities.get("primaryStatutes") != null) {
                            prompt.append("     - Statutes: ").append(legalAuthorities.get("primaryStatutes")).append("\n");
                        }
                        if (legalAuthorities.get("courtRules") != null) {
                            prompt.append("     - Court Rules: ").append(legalAuthorities.get("courtRules")).append("\n");
                        }
                    }
                }

                // Include comprehensive analysis
                String analysis = (String) result.get("summary");
                if (analysis != null && !analysis.isEmpty()) {
                    String textSnippet = analysis.length() > 3000 ? analysis.substring(0, 3000) + "..." : analysis;
                    prompt.append("   Comprehensive Analysis: ").append(textSnippet).append("\n");
                }

                resultsIncluded++;
            }
            prompt.append("\n");
        }

        // Process other sources
        for (Map.Entry<String, List<Map<String, Object>>> entry : resultsBySource.entrySet()) {
            String source = entry.getKey();
            if ("AI Web Research".equals(source)) continue; // Already processed

            List<Map<String, Object>> sourceResults = entry.getValue();
            prompt.append("--- ").append(source.toUpperCase()).append(" (").append(sourceResults.size()).append(" documents) ---\n");

            for (Map<String, Object> result : sourceResults) {
                if (resultsIncluded >= 20) break;

                prompt.append("\n").append(resultsIncluded + 1).append(". ").append(result.get("title")).append("\n");
                prompt.append("   Type: ").append(result.get("type")).append("\n");

                // Include more detailed content (increased limit to 2000 chars)
                String fullText = (String) result.get("fullText");
                String abstractText = (String) result.get("abstractText");
                String summary = (String) result.get("summary");
                String content = (String) result.get("content");

                String textToUse = null;
                if (fullText != null && !fullText.isEmpty()) {
                    textToUse = fullText;
                } else if (content != null && !content.isEmpty()) {
                    textToUse = content;
                } else if (abstractText != null && !abstractText.isEmpty()) {
                    textToUse = abstractText;
                } else if (summary != null && !summary.isEmpty()) {
                    textToUse = summary;
                }

                if (textToUse != null) {
                    // Increased limit from 500 to 2000 characters for better context
                    String textSnippet = textToUse.length() > 2000 ?
                        textToUse.substring(0, 2000) + "..." : textToUse;
                    prompt.append("   Content: ").append(textSnippet).append("\n");
                }

                // Add document URL if available
                String url = (String) result.get("federalRegisterUrl");
                if (url == null) url = (String) result.get("htmlUrl");
                if (url == null) url = (String) result.get("documentUrl");
                if (url != null) {
                    prompt.append("   URL: ").append(url).append("\n");
                }

                resultsIncluded++;
            }

            if (resultsIncluded >= 20) break;
        }

        // Add concise analysis structure
        prompt.append("\n=== RESPONSE FORMAT ===\n\n");
        prompt.append("Structure your response as follows:\n\n");

        prompt.append("## Quick Answer\n");
        prompt.append("Provide a direct, concise answer to the query (2-3 paragraphs). Include:\n");
        prompt.append("- The most relevant legal framework and authorities\n");
        prompt.append("- Key points specific to ").append(jurisdiction).append(" law\n");
        prompt.append("- Any critical deadlines, procedures, or requirements\n\n");

        prompt.append("## Key Points\n");
        prompt.append("List 3-5 essential points as bullet items:\n");
        prompt.append("- Most important statutes, rules, or regulations\n");
        prompt.append("- Critical procedural requirements or deadlines\n");
        prompt.append("- Practical considerations for practitioners\n\n");

        prompt.append("## Follow-up Questions\n");
        prompt.append("Suggest 3-5 relevant follow-up questions the user might want to explore, such as:\n");
        prompt.append("- Specific procedural steps or filing requirements\n");
        prompt.append("- Related legal issues or considerations\n");
        prompt.append("- Jurisdictional variations or exceptions\n");
        prompt.append("Format each as a clear, clickable question.\n\n");

        // Add category-specific additions
        String categorySpecific = buildCategorySpecificPrompt(category, query);
        if (!categorySpecific.isEmpty()) {
            prompt.append("\n**Additional Category-Specific Requirements:**\n");
            prompt.append(categorySpecific).append("\n");
        }

        prompt.append("\n**IMPORTANT REMINDERS**:\n");
        if (results.size() > 0) {
            prompt.append("- Base your analysis on the ").append(results.size()).append(" search results provided\n");
            prompt.append("- Include specific citations from the documents when available\n");
        } else {
            prompt.append("- Provide answers based on your comprehensive knowledge of ").append(jurisdiction).append(" law\n");
            prompt.append("- Include general statutory references and legal principles\n");
        }
        prompt.append("- Keep your response concise and focused on the specific query\n");
        prompt.append("- Format follow-up questions clearly so they can be clicked\n");
        prompt.append("- Provide actionable guidance that attorneys can use immediately\n\n");

        return prompt.toString();
    }

    private enum QueryCategory {
        FILING_PROCEDURE, APPEAL_PROCESS, LEGAL_REQUIREMENTS, COURT_RULES,
        CRIMINAL_DEFENSE, CIVIL_LITIGATION, FAMILY_LAW, REAL_ESTATE,
        BUSINESS_LAW, GENERAL_LEGAL
    }

    private QueryCategory detectQueryCategory(String query) {
        if (query == null) return QueryCategory.GENERAL_LEGAL;

        String queryLower = query.toLowerCase();

        // Filing and procedure keywords
        if (queryLower.contains("file") || queryLower.contains("filing") ||
            queryLower.contains("submit") || queryLower.contains("how to") ||
            queryLower.contains("procedure") || queryLower.contains("process") ||
            queryLower.contains("requirements")) {
            return QueryCategory.FILING_PROCEDURE;
        }

        // Appeal keywords
        if (queryLower.contains("appeal") || queryLower.contains("appellate") ||
            queryLower.contains("reverse") || queryLower.contains("overturn")) {
            return QueryCategory.APPEAL_PROCESS;
        }

        // Criminal law keywords
        if (queryLower.contains("criminal") || queryLower.contains("conviction") ||
            queryLower.contains("defendant") || queryLower.contains("sentence") ||
            queryLower.contains("bail") || queryLower.contains("arrest")) {
            return QueryCategory.CRIMINAL_DEFENSE;
        }

        // Civil litigation keywords
        if (queryLower.contains("lawsuit") || queryLower.contains("complaint") ||
            queryLower.contains("damages") || queryLower.contains("civil") ||
            queryLower.contains("tort") || queryLower.contains("negligence")) {
            return QueryCategory.CIVIL_LITIGATION;
        }

        // Family law keywords
        if (queryLower.contains("divorce") || queryLower.contains("custody") ||
            queryLower.contains("child support") || queryLower.contains("marriage") ||
            queryLower.contains("family")) {
            return QueryCategory.FAMILY_LAW;
        }

        // Business law keywords
        if (queryLower.contains("business") || queryLower.contains("corporate") ||
            queryLower.contains("llc") || queryLower.contains("contract") ||
            queryLower.contains("employment")) {
            return QueryCategory.BUSINESS_LAW;
        }

        // Court rules keywords
        if (queryLower.contains("rule") || queryLower.contains("court rule") ||
            queryLower.contains("procedure rule")) {
            return QueryCategory.COURT_RULES;
        }

        return QueryCategory.GENERAL_LEGAL;
    }

    private String buildCategorySpecificPrompt(QueryCategory category, String query) {
        switch (category) {
            case FILING_PROCEDURE:
                return "Provide step-by-step filing instructions including:\n" +
                       "• Exact forms required and where to get them\n" +
                       "• Filing deadlines and time limits\n" +
                       "• Required fees and payment methods\n" +
                       "• Court procedures and what to expect\n" +
                       "• Common mistakes to avoid\n\n" +
                       "Be specific about Massachusetts requirements.";

            case APPEAL_PROCESS:
                return "Explain the appeal process including:\n" +
                       "• Specific deadlines (e.g., 30 days from judgment)\n" +
                       "• Required forms and documents\n" +
                       "• Filing procedures and fees\n" +
                       "• Standards of review and chances of success\n" +
                       "• Timeline for the appeal process\n\n" +
                       "Cite specific Massachusetts Rules of Appellate Procedure.";

            case CRIMINAL_DEFENSE:
                return "Provide criminal defense guidance including:\n" +
                       "• Specific legal options and defenses available\n" +
                       "• Procedural requirements and deadlines\n" +
                       "• Rights of the defendant\n" +
                       "• Potential penalties and consequences\n" +
                       "• Next steps in the legal process\n\n" +
                       "Reference specific Massachusetts criminal statutes and court rules.";

            case CIVIL_LITIGATION:
                return "Explain civil litigation procedures including:\n" +
                       "• Cause of action and legal theories\n" +
                       "• Statute of limitations\n" +
                       "• Required elements to prove the case\n" +
                       "• Procedural requirements for filing\n" +
                       "• Potential damages and remedies\n\n" +
                       "Cite relevant Massachusetts General Laws and court rules.";

            case FAMILY_LAW:
                return "Address family law matters including:\n" +
                       "• Specific legal requirements and procedures\n" +
                       "• Required documentation and forms\n" +
                       "• Timeline and court process\n" +
                       "• Rights and obligations of parties\n" +
                       "• Potential outcomes and enforcement\n\n" +
                       "Reference Massachusetts family law statutes and guidelines.";

            case BUSINESS_LAW:
                return "Explain business law requirements including:\n" +
                       "• Legal compliance requirements\n" +
                       "• Filing procedures and deadlines\n" +
                       "• Required documentation\n" +
                       "• Regulatory obligations\n" +
                       "• Potential legal consequences\n\n" +
                       "Cite specific Massachusetts business statutes and regulations.";

            case COURT_RULES:
                return "Interpret court rules including:\n" +
                       "• Specific rule requirements and procedures\n" +
                       "• Deadlines and time limits\n" +
                       "• Formatting and filing requirements\n" +
                       "• Consequences of non-compliance\n" +
                       "• Practical application tips\n\n" +
                       "Explain how the rules apply to this specific situation.";

            default:
                return "Provide comprehensive legal guidance including:\n" +
                       "• Applicable laws and regulations\n" +
                       "• Specific requirements and procedures\n" +
                       "• Deadlines and time limits\n" +
                       "• Rights and obligations\n" +
                       "• Practical next steps\n\n" +
                       "Be specific about Massachusetts law and procedures.";
        }
    }

    private Map<String, Object> combineResultsWithAI(Map<String, Object> searchResults, String aiAnalysis) {
        Map<String, Object> combined = new HashMap<>(searchResults);
        combined.put("aiAnalysis", aiAnalysis);
        combined.put("hasAIAnalysis", true);
        return combined;
    }

    private void cacheAIResult(String queryHash, String query, String searchType, String jurisdiction, String caseId, String aiResponse) {
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
            log.info("Cached AI result for query hash: {} (caseId: {})", queryHash, caseId != null ? caseId : "general");

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


    // Utility methods
    private String generateQueryHash(String query, String searchType, String jurisdiction, String caseId) {
        try {
            // Include caseId in hash to ensure different cases get different cached responses
            // Use "general" for queries not tied to a specific case
            String caseIdentifier = (caseId != null && !caseId.isEmpty()) ? caseId : "general";
            String combined = query + "|" + searchType + "|" + jurisdiction + "|" + caseIdentifier;
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
            return objectMapper.readValue(aiResponse, objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
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

    /**
     * Filters Federal Register results for immigration relevance
     */
    private List<Map<String, Object>> filterImmigrationResults(List<Map<String, Object>> results, String originalQuery) {
        // Keywords that indicate immigration-related content
        String[] immigrationKeywords = {
            "immigration", "immigrant", "visa", "uscis", "ice", "cbp",
            "deportation", "removal", "asylum", "refugee", "citizenship",
            "naturalization", "8 cfr", "ina", "eoir", "bia", "homeland security",
            "department of justice", "adjustment of status", "green card",
            "nonimmigrant", "lawful permanent", "i-130", "i-485", "i-765",
            "board of immigration appeals", "immigration judge"
        };

        // Keywords that indicate NOT immigration (to filter out)
        String[] excludeKeywords = {
            "environmental", "epa", "water quality", "air quality", "pollution",
            "fda", "drug", "medical device", "food safety", "pharmaceutical",
            "securities", "sec", "financial", "banking", "treasury",
            "agriculture", "usda", "farm", "crop", "livestock"
        };

        return results.stream()
            .filter(result -> {
                String title = ((String) result.getOrDefault("title", "")).toLowerCase();
                String summary = ((String) result.getOrDefault("summary", "")).toLowerCase();
                String content = title + " " + summary;

                // Exclude if it contains exclude keywords
                for (String exclude : excludeKeywords) {
                    if (content.contains(exclude)) {
                        log.debug("Filtering out non-immigration result: {}", title);
                        return false;
                    }
                }

                // Include if it contains immigration keywords
                for (String keyword : immigrationKeywords) {
                    if (content.contains(keyword)) {
                        return true;
                    }
                }

                // Default to excluding if no immigration keywords found
                log.debug("Filtering out result with no immigration keywords: {}", title);
                return false;
            })
            .collect(Collectors.toList());
    }

    /**
     * Enhances immigration queries for Court Listener searches
     */
    private String enhanceImmigrationQueryForCourtListener(String query) {
        String queryLower = query.toLowerCase();

        // For Court Listener, we want to find relevant case law
        if (queryLower.contains("immigration") && queryLower.contains("appeal")) {
            return "Board Immigration Appeals OR BIA OR immigration judge OR removal proceedings appeal";
        }
        if (queryLower.contains("asylum")) {
            return "asylum persecution refugee withholding removal CAT";
        }
        if (queryLower.contains("deportation") || queryLower.contains("removal")) {
            return "removal proceedings deportation immigration judge BIA";
        }
        if (queryLower.contains("visa")) {
            return "visa petition consular processing immigrant nonimmigrant";
        }
        if (queryLower.contains("green card")) {
            return "adjustment status permanent resident I-485";
        }

        // Default enhancement for general immigration queries
        return query + " immigration";
    }

    /**
     * Enhances immigration queries to be more specific for Federal Register searches
     */
    private String enhanceImmigrationQuery(String query) {
        String queryLower = query.toLowerCase();

        // Map common immigration terms to more specific Federal Register search terms
        if (queryLower.contains("immigration") && queryLower.contains("appeal")) {
            return "\"Board of Immigration Appeals\" OR \"immigration judge\" OR \"8 CFR 1003\" OR \"EOIR\" OR \"removal proceedings\"";
        }
        if (queryLower.contains("green card")) {
            return "\"adjustment of status\" OR \"I-485\" OR \"8 CFR 245\" OR \"lawful permanent resident\"";
        }
        if (queryLower.contains("visa")) {
            return "\"nonimmigrant visa\" OR \"immigrant visa\" OR \"8 CFR 214\" OR \"consular processing\"";
        }
        if (queryLower.contains("deportation") || queryLower.contains("removal")) {
            return "\"removal proceedings\" OR \"deportation\" OR \"8 CFR 1240\" OR \"immigration judge\"";
        }
        if (queryLower.contains("asylum")) {
            return "\"asylum\" OR \"refugee\" OR \"8 CFR 208\" OR \"persecution\" OR \"withholding of removal\"";
        }
        if (queryLower.contains("citizenship") || queryLower.contains("naturalization")) {
            return "\"naturalization\" OR \"citizenship\" OR \"8 CFR 316\" OR \"N-400\"";
        }

        // For general immigration queries, add DHS/DOJ agency filters
        return query + " AND (\"Department of Homeland Security\" OR \"Department of Justice\" OR \"USCIS\" OR \"immigration\")";
    }

    /**
     * Determines if a query is related to immigration law (always federal)
     */
    private boolean isImmigrationQuery(String query) {
        if (query == null) return false;

        String queryLower = query.toLowerCase();

        // Immigration-specific terms and agencies
        String[] immigrationIndicators = {
            "immigration", "immigrant", "visa", "green card", "citizenship",
            "naturalization", "deportation", "removal proceedings", "asylum",
            "refugee", "uscis", "ice", "cbp", "eoir", "bia",
            "board of immigration appeals", "immigration judge", "immigration court",
            "i-130", "i-485", "i-765", "i-140", "i-129", "i-589", "n-400",
            "adjustment of status", "consular processing", "inadmissibility",
            "unlawful presence", "voluntary departure", "cancellation of removal",
            "withholding of removal", "convention against torture", "cat",
            "temporary protected status", "tps", "daca", "dream act",
            "h1b", "h-1b", "l1", "l-1", "f1", "f-1", "j1", "j-1", "eb1", "eb2", "eb3",
            "family-based immigration", "employment-based immigration",
            "notice to appear", "nta", "master calendar", "individual hearing",
            "immigration appeal", "bia appeal", "circuit court immigration",
            "aao", "administrative appeals office", "request for evidence", "rfe",
            "notice of intent to deny", "noid", "immigration detention"
        };

        for (String indicator : immigrationIndicators) {
            if (queryLower.contains(indicator)) {
                log.info("Detected immigration law indicator: '{}'", indicator);
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if a query is related to Massachusetts civil procedure
     */
    private boolean isMassachusettsCivilProcedureQuery(String query) {
        if (query == null) return false;

        String queryLower = query.toLowerCase();

        // Massachusetts civil procedure specific indicators
        String[] civilProcedureIndicators = {
            "mass. r. civ. p.", "mass r civ p", "massachusetts rules of civil procedure",
            "rule 12", "12(b)(6)", "12b6", "motion to dismiss",
            "rule 56", "summary judgment", "rule 11", "sanctions",
            "12(b)(2)", "personal jurisdiction", "12(b)(1)", "subject matter jurisdiction",
            "12(b)(3)", "improper venue", "12(b)(4)", "improper service",
            "12(b)(5)", "insufficient service", "12(b)(7)", "indispensable party",
            "civil procedure", "motion practice", "pleading", "discovery",
            "superior court", "district court", "housing court"
        };

        for (String indicator : civilProcedureIndicators) {
            if (queryLower.contains(indicator)) {
                log.info("Detected Massachusetts civil procedure indicator: '{}'", indicator);
                return true;
            }
        }

        // Check for Massachusetts + procedure terms
        boolean hasMassachusetts = queryLower.contains("massachusetts") || queryLower.contains("mass.");
        boolean hasProcedure = queryLower.contains("procedure") || queryLower.contains("motion") ||
                              queryLower.contains("rule") || queryLower.contains("filing");

        if (hasMassachusetts && hasProcedure) {
            log.info("Detected Massachusetts + procedure terms");
            return true;
        }

        return false;
    }

    /**
     * Determines if a query is related to Massachusetts state law
     */
    private boolean isStateLawQuery(String query) {
        if (query == null) return false;

        String queryLower = query.toLowerCase();

        // First check if this is an immigration query - immigration is ALWAYS federal
        if (isImmigrationQuery(query)) {
            log.info("Immigration query detected - not a state law query");
            return false;
        }

        // Massachusetts specific indicators
        String[] massachusettsIndicators = {
            "massachusetts", "ma ", " ma", "mass.", "mass ",
            "commonwealth", "boston", "worcester", "springfield"
        };

        // State law practice area indicators (removed generic "appeal" - too broad)
        String[] stateIndicators = {
            "state law", "state court", "state statute", "state regulation",
            "criminal", "conviction", "defendant", "sentencing",
            "divorce", "custody", "child support", "family law", "domestic",
            "probate", "estate", "will", "trust", "guardianship",
            "real estate", "property", "landlord", "tenant", "eviction",
            "personal injury", "tort", "negligence", "malpractice",
            "contract", "breach", "damages", "civil procedure",
            "superior court", "district court", "appeals court", "sjc",
            "supreme judicial court", "housing court", "probate court",
            "dui", "oui", "dwi", "traffic", "motor vehicle",
            "workers compensation", "unemployment", "disability"
        };

        // Check for Massachusetts indicators
        for (String indicator : massachusettsIndicators) {
            if (queryLower.contains(indicator)) {
                log.info("Detected Massachusetts indicator: '{}'", indicator);
                return true;
            }
        }

        // Check for state law indicators (if not clearly federal)
        boolean hasStateIndicator = false;
        for (String indicator : stateIndicators) {
            if (queryLower.contains(indicator)) {
                hasStateIndicator = true;
                break;
            }
        }

        // Check for federal indicators that would override state classification
        String[] federalIndicators = {
            "federal", "cfr", "usc", "united states code", "federal register",
            "sec", "epa", "fda", "irs", "federal regulation", "federal law",
            "immigration", "visa", "uscis", "ice", "deportation", "asylum"
        };

        for (String indicator : federalIndicators) {
            if (queryLower.contains(indicator)) {
                log.info("Federal indicator found, not a state query: '{}'", indicator);
                return false;
            }
        }

        // If has state indicators and no federal indicators, it's a state query
        if (hasStateIndicator) {
            log.info("Detected state law query based on practice area indicators");
            return true;
        }

        return false;
    }


    /**
     * Determines whether the Federal Register API should be used for a given query.
     * Returns true for federal law/regulatory queries, false for state law queries.
     */
    private boolean shouldUseFederalRegister(String query, String searchType) {
        if (query == null) return false;

        String queryLower = query.toLowerCase();

        // NEVER use Federal Register for state law queries
        if (queryLower.contains("mass.") || queryLower.contains("massachusetts") ||
            queryLower.contains("m.g.l.") || queryLower.contains("state court") ||
            queryLower.contains("r. civ. p.") || queryLower.contains("rule") ||
            queryLower.contains("state law") || queryLower.contains("state statute")) {
            log.info("Federal Register: NO - state law query detected: {}", query);
            return false;
        }

        // Immigration queries should always use federal sources
        if (isImmigrationQuery(query)) {
            log.info("Federal Register: YES - immigration query detected");
            return true;
        }

        // Always use Federal Register if explicitly searching for federal regulations
        if ("regulations".equalsIgnoreCase(searchType) || "rules".equalsIgnoreCase(searchType)) {
            // But only if not state law
            if (!isStateLawQuery(query)) {
                log.info("Federal Register: YES - explicit federal regulations/rules search type");
                return true;
            }
        }

        // Never use for non-regulatory search types (unless immigration)
        if ("statutes".equalsIgnoreCase(searchType) || "cases".equalsIgnoreCase(searchType) ||
            "guidelines".equalsIgnoreCase(searchType)) {
            log.info("Federal Register: NO - search type '{}' is not regulatory", searchType);
            return false;
        }

        // Federal agency indicators - SHOULD use Federal Register (including immigration agencies)
        String[] federalAgencies = {
            "epa", "environmental protection agency", "sec", "securities and exchange commission",
            "fda", "food and drug administration", "irs", "internal revenue service",
            "dol", "department of labor", "osha", "occupational safety",
            "ftc", "federal trade commission", "cfpb", "consumer financial protection",
            "cftc", "commodity futures", "treasury", "homeland security", "dhs",
            "cms", "centers for medicare", "usda", "agriculture department",
            "energy department", "doe", "commerce department", "transportation department",
            "uscis", "ice", "cbp", "eoir", "state department", "dos"
        };

        for (String agency : federalAgencies) {
            if (queryLower.contains(agency)) {
                log.info("Federal Register: YES - contains federal agency '{}'", agency);
                return true;
            }
        }

        // Federal law/regulatory keywords - SHOULD use Federal Register
        String[] federalKeywords = {
            "federal regulation", "cfr", "code of federal regulations", "usc", "united states code",
            "federal register", "administrative law", "agency rule", "proposed rule",
            "federal law", "federal statute", "administrative procedure", "rule making",
            "federal compliance", "federal requirement", "federal standard",
            "8 cfr", "title 8", "ina", "immigration and nationality act"
        };

        for (String keyword : federalKeywords) {
            if (queryLower.contains(keyword)) {
                log.info("Federal Register: YES - contains federal keyword '{}'", keyword);
                return true;
            }
        }

        // State law indicators - SHOULD NOT use Federal Register (removed generic "appeal")
        String[] stateIndicators = {
            "massachusetts", "ma ", " ma", "state court", "state law", "state statute",
            "criminal", "family law", "divorce", "custody", "child support", "probate",
            "real estate", "personal injury", "contract", "tort", "motion",
            "superior court", "district court", "appeals court", "supreme judicial court",
            "state regulation", "commonwealth", "municipal", "local law", "zoning"
        };

        for (String indicator : stateIndicators) {
            if (queryLower.contains(indicator)) {
                log.info("Federal Register: NO - contains state law indicator '{}'", indicator);
                return false;
            }
        }

        // Practice area analysis - bias toward state law for common legal practice areas
        String[] statePracticeAreas = {
            "criminal defense", "family court", "divorce proceedings", "child custody",
            "criminal conviction", "criminal appeal", "sentencing", "plea", "arraignment",
            "restraining order", "domestic violence", "landlord tenant", "eviction",
            "small claims", "traffic", "dui", "dwi", "probate court", "estate planning",
            "workers compensation", "unemployment", "disability", "medicaid"
        };

        for (String area : statePracticeAreas) {
            if (queryLower.contains(area)) {
                log.info("Federal Register: NO - contains state practice area '{}'", area);
                return false;
            }
        }

        // Default decision based on context
        // If no clear indicators, be conservative and skip Federal Register for:
        // - Questions (how, what, when, where, can i, should i)
        // - Procedural queries
        if (queryLower.matches(".*(how do|how to|what is|what are|when|where|can i|should i|procedure|process).*")) {
            log.info("Federal Register: NO - appears to be procedural/how-to question");
            return false;
        }

        // If we reach here with searchType="all", make a conservative decision
        // Bias toward NOT using Federal Register unless clearly federal
        log.info("Federal Register: NO - no clear federal indicators found, defaulting to state sources");
        return false;
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

            // Include abstract text for AI analysis
            map.put("abstractText", doc.getAbstractText());

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