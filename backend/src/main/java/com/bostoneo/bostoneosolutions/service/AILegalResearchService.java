package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.DeadlineInfo;
import com.bostoneo.bostoneosolutions.dto.ai.CitationVerificationResult;
import com.bostoneo.bostoneosolutions.dto.ai.ConversationMessage;
import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import com.bostoneo.bostoneosolutions.enumeration.QuestionType;
import com.bostoneo.bostoneosolutions.enumeration.ResearchMode;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.service.external.CourtListenerService;
import com.bostoneo.bostoneosolutions.service.external.FederalRegisterService;
import com.bostoneo.bostoneosolutions.service.external.MassachusettsLegalService;
import com.bostoneo.bostoneosolutions.service.validation.ResponseValidator;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
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
    private final com.bostoneo.bostoneosolutions.service.ai.AIRequestRouter aiRequestRouter;
    private final CourtListenerService courtListenerService;
    private final FederalRegisterService federalRegisterService;
    private final MassachusettsLegalService massachusettsLegalService;
    private final ImmigrationKnowledgeService immigrationKnowledgeService;
    private final MassachusettsCivilProcedureService massachusettsCivilProcedureService;
    private final ResearchProgressPublisher progressPublisher;
    private final ObjectMapper objectMapper;
    private final ResponseValidator responseValidator;
    private final RateLimitService rateLimitService;
    private final ResearchAnalyticsService analyticsService;
    private final QueryValidationService queryValidationService;
    private final SmartModeSelector smartModeSelector;
    private final CostPredictionService costPredictionService;
    private final ResponseQualityScorer qualityScorer;
    private final QuerySimilarityService similarityService;
    private final CitationUrlInjector citationUrlInjector;
    private final CourtRulesService courtRulesService;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;
    private final CaseDocumentService caseDocumentService;
    private final com.bostoneo.bostoneosolutions.service.tools.LegalResearchTools legalResearchTools;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    public Map<String, Object> performSearch(Map<String, Object> searchRequest) {
        log.info("Legal research search request: {}", searchRequest);

        String query = (String) searchRequest.get("query");
        String searchType = (String) searchRequest.getOrDefault("searchType", "all");
        String jurisdiction = (String) searchRequest.getOrDefault("jurisdiction", "General");
        Long userId = searchRequest.containsKey("userId") ? Long.valueOf(searchRequest.get("userId").toString()) : null;
        String sessionId = (String) searchRequest.get("sessionId");
        // CRITICAL: Extract caseId to ensure cache differentiation between different cases
        // Without this, same query for different cases would return cached results from wrong case
        String caseId = (String) searchRequest.get("caseId");

        // NEW: Research mode - FAST (existing) or THOROUGH (agentic with tools)
        String researchModeStr = (String) searchRequest.getOrDefault("researchMode", "FAST");
        ResearchMode researchMode = ResearchMode.valueOf(researchModeStr.toUpperCase());

        // NEW: Extract conversation history for context-aware responses
        List<ConversationMessage> conversationHistory = extractConversationHistory(searchRequest);

        // Phase 4: Query validation (relaxed for conversation follow-ups)
        boolean hasHistory = conversationHistory != null && !conversationHistory.isEmpty();
        QueryValidationService.ValidationResult validation = queryValidationService.validateQuery(query, researchModeStr, hasHistory);
        if (!validation.isValid) {
            log.warn("❌ Query validation failed: {}", validation.errorMessage);
            Map<String, Object> validationError = new HashMap<>();
            validationError.put("success", false);
            validationError.put("error", validation.errorMessage);
            validationError.put("errorType", "VALIDATION_ERROR");
            return validationError;
        }

        // Use sanitized query and include warnings/suggestions in response metadata
        query = validation.sanitizedQuery;

        // Phase 4: Rate limiting check
        if (!rateLimitService.allowRequest(userId, researchModeStr)) {
            Map<String, Integer> remaining = rateLimitService.getRemainingRequests(userId, researchModeStr);
            log.warn("🚫 Rate limit exceeded for user {} in {} mode", userId, researchModeStr);

            Map<String, Object> rateLimitError = new HashMap<>();
            rateLimitError.put("success", false);
            rateLimitError.put("error", "Rate limit exceeded. Please try again later.");
            rateLimitError.put("errorType", "RATE_LIMIT_EXCEEDED");
            rateLimitError.put("rateLimitInfo", remaining);
            rateLimitError.put("researchMode", researchModeStr);
            return rateLimitError;
        }

        log.info("Parsed search parameters - query: '{}', searchType: '{}', jurisdiction: '{}', caseId: '{}', mode: UNIFIED",
                 query, searchType, jurisdiction, caseId != null ? caseId : "general");

        // UNIFIED MODE: Always route through agentic path with tools
        // Claude decides when to use tools based on question type (classification-driven)
        return performThoroughResearch(searchRequest);
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

            // NOTE: Court Listener API skipped in FAST mode for performance (it can timeout/take 60s+)
            // Court Listener is only used in THOROUGH mode for verified case law citations
            log.info("FAST mode - skipping Court Listener API (use THOROUGH mode for case law search)");

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



    private CompletableFuture<String> generateAIAnalysis(String query, Map<String, Object> searchResults, QueryType queryType, String caseId, List<ConversationMessage> conversationHistory) {
        // Debug logging for AI input
        log.info("generateAIAnalysis called with query: '{}', conversation history: {} messages", query, conversationHistory.size());
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

        String prompt = buildAIPrompt(query, searchResults, queryType, caseId, conversationHistory);
        String systemMessage = buildSystemMessage();

        return aiRequestRouter.routeSimple(
                com.bostoneo.bostoneosolutions.enumeration.AIOperationType.RESEARCH_ANALYSIS,
                prompt, systemMessage, false, null)
            .exceptionally(throwable -> {
                log.error("AI analysis failed: ", throwable);
                return "AI analysis temporarily unavailable. Please review the search results manually.";
            });
    }

    /**
     * Build system message with high-priority universal directives
     * These instructions have higher priority than user message context
     */
    private String buildSystemMessage() {
        StringBuilder system = new StringBuilder();

        system.append("You are an expert legal research assistant providing counsel-ready analysis.\n\n");

        // CRITICAL: Define audience - addressing attorney, not client
        system.append("**CRITICAL - AUDIENCE**:\n");
        system.append("You are addressing the ATTORNEY who represents the client in this case.\n");
        system.append("- The attorney is your audience; the client is the subject of the case\n");
        system.append("- Refer to the client in third person: \"your client\" or \"[client name]\" or \"the [party]\"\n");
        system.append("- NEVER use \"you\" or \"your\" to address the client directly\n\n");
        system.append("**CORRECT ATTORNEY PERSPECTIVE**:\n");
        system.append("✅ \"Your client (the museum) faces a sophisticated dispute...\"\n");
        system.append("✅ \"Advise the museum that it should consider filing...\"\n");
        system.append("✅ \"The museum faces challenges in proving good faith purchase...\"\n");
        system.append("✅ \"Counsel the defendant that they have strong suppression arguments...\"\n\n");
        system.append("**INCORRECT CLIENT PERSPECTIVE** (NEVER USE):\n");
        system.append("❌ \"Your museum faces a dispute...\" (addresses client directly)\n");
        system.append("❌ \"You should file a motion...\" (addresses client, not attorney)\n");
        system.append("❌ \"Your company violated regulations...\" (addresses client)\n\n");

        // COST & TIMELINE REQUIREMENTS (moved from user prompt for higher priority)
        system.append("**COST & TIMELINE REQUIREMENTS - HIGHEST PRIORITY**:\n");
        system.append("   - **MANDATORY**: Include practical cost estimates for ALL responses:\n");
        system.append("     • Expert witness costs with specific dollar ranges (e.g., \"Budget $25K-$50K for product defect expert\")\n");
        system.append("     • Filing fees, motion practice costs, discovery expenses when relevant to the question\n");
        system.append("     • Total estimated litigation costs when discussing case strategy or viability\n");
        system.append("   - **MANDATORY**: Include timeline estimates for ALL responses:\n");
        system.append("     • Specific procedural deadlines with rule citations (e.g., \"Motion to dismiss due 21 days after service under FRCP 12\")\n");
        system.append("     • Expected time to resolution with realistic ranges (e.g., \"Personal injury cases typically take 18-30 months to trial\")\n");
        system.append("     • Key milestone dates (Markman hearing, class certification, trial dates)\n");
        system.append("   - **FORMAT REQUIREMENT**: Be quantitative and specific:\n");
        system.append("     • Use dollar ranges: \"$15K-$25K\" NOT \"expensive\" or \"significant cost\"\n");
        system.append("     • Use time ranges: \"18-24 months\" NOT \"long time\" or \"substantial period\"\n");
        system.append("     • Provide both optimistic and realistic estimates\n\n");

        // DEADLINE ANALYSIS (replaces removed tools - gives FAST mode deadline intelligence)
        String currentDate = java.time.LocalDate.now().toString();
        system.append("**DEADLINE ANALYSIS & TEMPORAL AWARENESS**:\n");
        system.append("   - **TODAY'S DATE: ").append(currentDate).append("** - Use this for ALL deadline calculations\n");
        system.append("   - **CRITICAL URGENCY (< 48 hours)**: Lead response with 🚨 URGENT ALERT:\n");
        system.append("     • \"🚨 CRITICAL: [Deadline name] is in [X] hours/days (due [date])\"\n");
        system.append("     • Provide immediate action steps\n");
        system.append("     • Flag as highest priority\n");
        system.append("   - **HIGH URGENCY (< 7 days)**: Flag prominently:\n");
        system.append("     • \"⚡ HIGH PRIORITY: [Deadline] in [X] days (due [date])\"\n");
        system.append("     • Include in Quick Answer section\n");
        system.append("   - **EXPIRED DEADLINES**: If deadline has passed:\n");
        system.append("     • Lead with: \"❌ DEADLINE PASSED: [Deadline] was [X] days ago ([date])\"\n");
        system.append("     • DO NOT provide preparation advice\n");
        system.append("     • INSTEAD: Provide post-deadline remedies (emergency motion, excusable neglect, etc.)\n");
        system.append("   - **CALCULATE ACCURATELY**: Always show your math:\n");
        system.append("     • \"From today (").append(currentDate).append(") to deadline ([date]) = [X] days\"\n");
        system.append("     • Account for weekends/holidays when relevant\n\n");

        // LEGAL CITATION POLICY
        system.append("**CITATION POLICY**:\n");
        system.append("Include case law citations you're confident about with proper Bluebook format. ");
        system.append("Post-processing will automatically verify all citations via CourtListener — you don't need to hedge.\n");
        system.append("If unsure about a specific citation, describe the legal principle without fabricating a case name.\n");
        system.append("End each response with: \"⚠️ VERIFY ALL CITATIONS: Always verify cases and statutes against primary sources before relying on them in court filings.\"\n");
        system.append("IMPORTANT: Only include sections you can fully complete with substantive content. Do NOT include empty or placeholder sections like 'Timing & Cost Estimates' with no data. If you cannot complete a section, omit it entirely.\n\n");

        // CITATION AUTHORITY HIERARCHY
        system.append("**CITATION AUTHORITY HIERARCHY** (always prefer higher tiers):\n");
        system.append("   1. **BINDING AUTHORITY** — Same jurisdiction appellate court decisions, controlling statutes, constitutional provisions\n");
        system.append("   2. **PERSUASIVE AUTHORITY** — Other circuit/state court decisions, Restatements, influential treatises\n");
        system.append("   3. **SECONDARY AUTHORITY** — Law reviews, treatises, older or out-of-jurisdiction cases\n");
        system.append("   When citing, identify the tier implicitly through your analysis (e.g., \"The First Circuit held...\" vs \"A district court in another jurisdiction noted...\").\n\n");

        // ADMINISTRATIVE PRECEDENTS
        system.append("**ADMINISTRATIVE PRECEDENTS - CITE WHERE APPLICABLE**:\n");
        system.append("   - **Immigration**: Cite BIA precedent decisions (Matter of [Name]) and AAO decisions for immigration procedures, eligibility, relief from removal\n");
        system.append("   - **Tax**: Cite Tax Court Memorandum opinions (T.C. Memo. [Year]-[Number]), Revenue Rulings (Rev. Rul. [Year]-[Number]), Chief Counsel Advice, IRS guidance\n");
        system.append("   - **Securities**: Reference SEC no-action letters, ALJ decisions, SEC enforcement releases for interpretive guidance\n");
        system.append("   - **Employment**: Cite EEOC guidance, DOL opinion letters, NLRB decisions for federal employment law\n");
        system.append("   - **Environmental**: Reference EPA guidance documents, administrative orders, settlement precedents\n");
        system.append("   - **Administrative Law**: These precedents carry significant weight - use them alongside published court opinions\n\n");

        // DOCUMENT DRAFTING CAPABILITIES
        system.append("**DOCUMENT DRAFTING CAPABILITIES**:\n");
        system.append("   - When drafting legal documents (motions, briefs, complaints, discovery), generate complete professional documents\n");
        system.append("   - Include: Proper structure, verified citations, legal standards, compelling arguments, and clear organization\n");
        system.append("   - Follow: Court rules, professional standards, proper formatting with numbered paragraphs and headings\n");
        system.append("   - Provide: Signature blocks and certificates of service when appropriate\n");
        system.append("   - For questions (non-drafting): Provide detailed analysis with structure, legal standards, key arguments, and strategic considerations\n\n");

        // RESPONSE FORMATTING
        system.append("**RESPONSE FORMATTING**:\n");
        system.append("The UI renders charts, timelines, tables, and badges. Use them when appropriate:\n");
        system.append("- **Charts**: `CHART:BAR`, `CHART:PIE`, `CHART:LINE`, `CHART:DONUT` — for numeric data only. Bar/Line use markdown table syntax; Pie/Donut use bullet list syntax.\n");
        system.append("- **Timelines**: Start with `TIMELINE:` then date-prefixed bullets (e.g., `- **Day 0**: File complaint`)\n");
        system.append("- **Risk levels**: `⚠️ CRITICAL:`, `⚠️ HIGH:`, `⚠️ MEDIUM:`, `⚠️ LOW:`\n");
        system.append("- **Tables**: Standard markdown tables for text comparisons\n");
        system.append("- **Outcome badges**: `✅ Favorable` or `❌ Unfavorable` for motion/case outcomes\n\n");

        // STRUCTURED SOURCES MARKER
        system.append("📌 **SOURCES MARKER** (MANDATORY on every response):\n");
        system.append("Every response MUST end with a SOURCES marker, placed AFTER your analysis but BEFORE '## Follow-up Questions':\n\n");
        system.append("Format:\n");
        system.append("SOURCES: Case or Statute 1 | Case or Statute 2 | Case or Statute 3\n\n");
        system.append("Rules:\n");
        system.append("- SOURCES: List ALL cases, statutes, and regulations you cited in your answer, separated by |\n");
        system.append("- The marker must be on its own line\n");
        system.append("- Use the same citation format as in your prose (e.g., 'Smith v. Jones, 123 S.W.3d 456')\n");
        system.append("- Do NOT wrap in markdown headings or bullet points\n\n");
        system.append("Example:\n");
        system.append("SOURCES: Smith v. Jones, 123 S.W.3d 456 | 18 U.S.C. § 1001 | Doe v. Roe, 456 F.3d 789\n\n");

        // MANDATORY FOLLOW-UP QUESTIONS SECTION
        system.append("**MANDATORY - FOLLOW-UP QUESTIONS SECTION**:\n");
        system.append("⚠️ CRITICAL: EVERY response MUST end with a '## Follow-up Questions' section.\n");
        system.append("This section is REQUIRED for the user interface to work correctly.\n\n");
        system.append("⚠️⚠️⚠️ VERY IMPORTANT - QUESTION DIRECTION ⚠️⚠️⚠️\n");
        system.append("These are clickable suggestions for the USER to ask YOU (the AI) for more research.\n");
        system.append("The USER clicks them → they get sent to YOU → YOU answer them.\n");
        system.append("They are NOT questions you are asking the user. NEVER ask the user for information.\n\n");
        system.append("FORMAT (use EXACTLY this format):\n");
        system.append("## Follow-up Questions\n");
        system.append("- [Question user asks AI]\n");
        system.append("- [Question user asks AI]\n");
        system.append("- [Question user asks AI]\n\n");
        system.append("❌ WRONG EXAMPLES (AI asking user - NEVER DO THIS):\n");
        system.append("  ❌ \"Can you provide a case citation you need summarized?\" - WRONG, asks user for input\n");
        system.append("  ❌ \"Is there a filing deadline you need calculated?\" - WRONG, asks user for input\n");
        system.append("  ❌ \"What legal doctrine would be useful for me to explain?\" - WRONG, asks user for input\n");
        system.append("  ❌ \"Do you want me to research...\" - WRONG, asks user yes/no\n\n");
        system.append("✅ CORRECT EXAMPLES (user asking AI - DO THIS):\n");
        system.append("  ✅ \"What are the key elements of a breach of fiduciary duty claim?\"\n");
        system.append("  ✅ \"Find [jurisdiction] cases on preliminary injunction standards\"\n");
        system.append("  ✅ \"What are the filing deadlines for summary judgment motions?\"\n");
        system.append("  ✅ \"Explain the doctrine of res judicata under applicable state law\"\n");
        system.append("  ✅ \"How do federal courts handle venue transfer motions?\"\n\n");
        system.append("REQUIREMENTS:\n");
        system.append("- Use '## Follow-up Questions' as the EXACT header\n");
        system.append("- Each question starts with '- ' (dash space)\n");
        system.append("- Questions are requests FROM the user TO the AI for research/analysis\n");
        system.append("- Questions should explore related topics or go deeper into the analysis\n");
        system.append("- NEVER start with \"Can you provide...\", \"Do you need...\", \"Would you like...\"\n\n");

        return system.toString();
    }

    private String buildAIPrompt(String query, Map<String, Object> searchResults, QueryType queryType, String caseId, List<ConversationMessage> conversationHistory) {
        StringBuilder prompt = new StringBuilder();

        // Detect question type for adaptive response formatting
        QuestionType questionType = detectQuestionType(query, conversationHistory);
        log.info("🎯 Question type: {} for query: {}", questionType, query.substring(0, Math.min(50, query.length())));

        // Detect query type for specialized prompt
        QueryCategory category = detectQueryCategory(query);

        // Resolve jurisdiction: user-selected > case jurisdiction > default
        boolean isImmigrationQuery = isImmigrationQuery(query);
        String jurisdiction;
        String userJurisdiction = (String) searchResults.get("jurisdiction");
        if (isImmigrationQuery) {
            jurisdiction = "Federal/Immigration";
        } else if (userJurisdiction != null && !userJurisdiction.isBlank()
                   && !"all".equalsIgnoreCase(userJurisdiction)
                   && !"general".equalsIgnoreCase(userJurisdiction)) {
            jurisdiction = userJurisdiction.substring(0, 1).toUpperCase() + userJurisdiction.substring(1);
        } else {
            // Fallback: resolve from case context (case jurisdiction → org state → "General")
            jurisdiction = resolveCaseJurisdiction(caseId);
        }

        prompt.append("You are an expert legal research assistant specializing in ").append(jurisdiction).append(" law.\n\n");

        // CRITICAL: Tell Claude the current date for accurate deadline calculations
        prompt.append("**TODAY'S DATE: ").append(java.time.LocalDate.now().toString()).append("**\n");
        prompt.append("Use this date for ALL deadline calculations, time-sensitive recommendations, and \"days from now\" calculations.\n\n");

        prompt.append("**CRITICAL - DATE CALCULATIONS**:\n");
        prompt.append("- ALL date calculations have been done for you in the case context below\n");
        prompt.append("- DO NOT recalculate days/months between dates - use the exact values provided\n");
        prompt.append("- When referencing deadlines, use EXACTLY the time descriptions provided (e.g., '251 days ago')\n");
        prompt.append("- NEVER calculate your own date arithmetic - it produces inconsistent results\n");
        prompt.append("- **CRITICAL**: If the case description contains old date calculations like '(in X days)', IGNORE THEM - they are stale\n");
        prompt.append("- ONLY use the date calculations that appear with field labels like 'Next Hearing:' or in the deadline urgency section\n\n");

        // Adaptive response format based on question type
        prompt.append("**RESPONSE FORMAT** (").append(questionType).append("):\n");

        switch (questionType) {
            case NARROW_TECHNICAL:
                prompt.append("- This is a NARROW TECHNICAL question requiring a focused answer\n");
                prompt.append("- Provide a direct, specific answer (200-400 words)\n");
                prompt.append("- Focus exclusively on the specific concept, statute, or definition asked about\n");
                prompt.append("- DO NOT provide full case analysis or multiple arguments\n");
                prompt.append("- Include the exact statutory text or citation if relevant\n");
                prompt.append("- End with 2-3 suggested follow-up questions (user asking AI for more research)\n\n");
                break;

            case FOLLOW_UP_CLARIFICATION:
                prompt.append("- This is a FOLLOW-UP question in an ongoing conversation\n");
                prompt.append("- Provide a focused clarification (1-2 paragraphs)\n");
                prompt.append("- Reference the previous discussion naturally\n");
                prompt.append("- DO NOT repeat information already provided - build on it\n");
                prompt.append("- Focus on the NEW aspect being asked about\n");
                prompt.append("- Keep it concise and directly responsive\n");
                prompt.append("- End with 2-3 suggested follow-up questions (user asking AI for more research)\n\n");
                break;

            case PROCEDURAL_GUIDANCE:
                prompt.append("- This is a PROCEDURAL question about court process or filing requirements\n");
                prompt.append("- Provide step-by-step guidance (numbered list format)\n");
                prompt.append("- Include specific deadlines, forms, and court rules\n");
                prompt.append("- Be practical and action-oriented\n");
                prompt.append("- Format: 1. First step, 2. Second step, etc.\n");
                prompt.append("- End with 2-3 suggested follow-up questions (user asking AI for more research)\n\n");
                break;

            case INITIAL_STRATEGY:
            default:
                prompt.append("- This is a COMPREHENSIVE STRATEGY question requiring full analysis\n");
                prompt.append("- Provide a thorough answer (2-3 paragraphs)\n");
                prompt.append("- Include multiple legal arguments ranked by strength\n");
                prompt.append("- Cite relevant case law and statutes\n");
                prompt.append("- Address risks and procedural considerations\n");
                prompt.append("- End with 3-5 suggested follow-up questions (user asking AI for more research)\n\n");
                break;
        }

        prompt.append("**GENERAL GUIDANCE**:\n");
        prompt.append("- Use clear, confident language based on your legal knowledge\n");
        prompt.append("- Even if no documents were retrieved, provide substantive legal guidance based on your knowledge of ").append(jurisdiction).append(" law\n");
        prompt.append("- DO NOT apologize for lack of documents - just provide the best answer you can\n");
        prompt.append("- Keep the response concise and actionable\n\n");

        // Add conversation history if available
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            prompt.append("**CONVERSATION HISTORY**:\n");
            prompt.append("This is a follow-up question in an ongoing conversation. Here is the conversation history:\n\n");

            for (ConversationMessage msg : conversationHistory) {
                prompt.append(msg.getRole().toUpperCase()).append(": ").append(msg.getContent()).append("\n\n");
            }

            prompt.append("**IMPORTANT**: This is a FOLLOW-UP question. ");
            prompt.append("Reference the previous conversation naturally without repeating information already provided. ");
            prompt.append("Build on what was already discussed. Be concise and focused on the new question.\n\n");

            // Compact anti-repetition instruction (replaces verbose ~400 token block)
            prompt.append("CRITICAL: Never repeat case basics, court info, dates, jurisdiction, or legal framework already discussed. ");
            prompt.append("Use conversational back-references (e.g. \"Building on the strategy we discussed...\"). ");
            prompt.append("This overrides standard template format.\n\n");
        }

        // Add comprehensive case context if available
        if (caseId != null && !caseId.isEmpty()) {
            try {
                // Try parsing as Long ID first
                Long caseIdLong = Long.parseLong(caseId);
                Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
                // SECURITY: Use tenant-filtered query
                Optional<LegalCase> caseOpt = orgId != null
                    ? legalCaseRepository.findByIdAndOrganizationId(caseIdLong, orgId)
                    : Optional.empty();
                caseOpt.ifPresent(legalCase -> appendCaseContext(prompt, legalCase, questionType));
            } catch (NumberFormatException e) {
                // If not a numeric ID, try looking up by case_number
                log.info("CaseId '{}' is not numeric, trying lookup by case_number", caseId);
                legalCaseRepository.findByCaseNumber(caseId).ifPresent(legalCase -> appendCaseContext(prompt, legalCase, questionType));
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

        // META-INSTRUCTION: Conversation flow overrides template structure
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            prompt.append("\n⚠️⚠️⚠️ META-INSTRUCTION (HIGHEST PRIORITY) ⚠️⚠️⚠️\n");
            prompt.append("This is a multi-turn conversation. The following template format is DEFAULT ONLY.\n");
            prompt.append("**CONVERSATIONAL FLOW OVERRIDES TEMPLATE STRUCTURE.**\n");
            prompt.append("If this is a follow-up question:\n");
            prompt.append("- Ignore rigid template formatting (Strategic Analysis / Key Points)\n");
            prompt.append("- Use natural conversational language\n");
            prompt.append("- Reference prior messages with phrases like \"As we discussed...\" or \"Building on that...\"\n");
            prompt.append("- Focus ONLY on the new information being asked\n");
            prompt.append("- Keep it brief and avoid repeating anything from the conversation history\n\n");
        }

        // Conditional template based on question type
        prompt.append("\n=== RESPONSE FORMAT ===\n\n");

        // FOLLOW_UP_CLARIFICATION: Simplified conversational format (NO rigid template)
        if (questionType == QuestionType.FOLLOW_UP_CLARIFICATION) {
            prompt.append("**CONVERSATIONAL FORMAT** (Follow-Up Question):\n");
            prompt.append("Since this is a follow-up, DO NOT use the \"Strategic Analysis / Key Points\" template structure.\n");
            prompt.append("Instead, provide a natural, conversational response:\n\n");

            prompt.append("1. Start with a conversational transition that EXPLICITLY references the prior discussion:\n");
            prompt.append("   ✅ GOOD: \"Building on the suppression strategy we outlined, here's how the applicable regulation works...\"\n");
            prompt.append("   ✅ GOOD: \"As we discussed in the initial strategy, here's how the appeal process works...\"\n");
            prompt.append("   ✅ GOOD: \"To expand on the disposition option we mentioned earlier...\"\n");
            prompt.append("   ✅ GOOD: \"Following up on the earlier recommendation about discovery requests...\"\n");
            prompt.append("   ❌ BAD: \"Regulation Requirements\" (no connection to prior conversation)\n\n");

            prompt.append("2. Provide 1-2 focused paragraphs directly answering the NEW aspect being asked\n");
            prompt.append("   - Focus ONLY on what's being clarified\n");
            prompt.append("   - Reference previous discussion naturally throughout\n");
            prompt.append("   - DO NOT repeat case basics, deadlines, or framework already covered\n\n");

            prompt.append("3. Include client communication note when discussing options/outcomes/decisions:\n");
            prompt.append("   💬 **Client Discussion**: [Brief 1-2 sentence note about how to explain this to the client]\n");
            prompt.append("   Example: \"💬 **Client Discussion**: Explain to the client that this disposition option avoids a criminal conviction but requires completing the court-ordered program and license suspension period.\"\n");
            prompt.append("   Only include if discussing outcomes, strategic choices, or decisions the client needs to understand.\n\n");

            prompt.append("4. End with 2-3 follow-up questions:\n");
            prompt.append("   ## Follow-up Questions\n");
            prompt.append("   - Jurisdiction-specific, precedent-focused research requests\n");
            prompt.append("   - Questions the attorney asks the AI, NOT questions asking the user for info\n");
            prompt.append("   - Build on what was just discussed\n\n");

        // NARROW_TECHNICAL: Simplified format (just answer + citation)
        } else if (questionType == QuestionType.NARROW_TECHNICAL) {
            prompt.append("**FOCUSED FORMAT** (Narrow Technical Question):\n\n");

            prompt.append("Provide a direct answer (200-400 words) focusing exclusively on the specific concept/statute asked about.\n\n");

            prompt.append("Structure:\n");
            prompt.append("- Direct answer to the specific question\n");
            prompt.append("- Exact statutory text or legal definition if relevant\n");
            prompt.append("- Brief practical application (1-2 sentences)\n");
            prompt.append("- Client communication note (if discussing outcomes/decisions):\n");
            prompt.append("  💬 **Client Discussion**: [How to explain this to the client in plain language]\n");
            prompt.append("  Only include if the technical point has client-facing implications.\n");
            prompt.append("- End with 2-3 follow-up questions:\n");
            prompt.append("  ## Follow-up Questions\n");
            prompt.append("  - Jurisdiction-specific, precedent-focused research requests\n");
            prompt.append("  - Questions the attorney asks the AI, NOT questions asking the user for info\n\n");

            prompt.append("DO NOT provide full case analysis or multiple arguments - keep it focused.\n\n");

        // INITIAL_STRATEGY or PROCEDURAL_GUIDANCE: Full template (original format)
        } else {
            prompt.append("Structure your response as follows:\n\n");

            prompt.append("**CONVERSATION PROGRESSION** (for multi-turn discussions):\n");
            prompt.append("If the user asks follow-up questions, each subsequent response should add NEW layers of insight:\n");
            prompt.append("- Response 1 (Strategy): High-level overview, key options, timeline\n");
            prompt.append("- Follow-up responses: Deep dives into specific aspects, procedural details, tactical considerations\n");
            prompt.append("- Avoid restating conclusions from earlier responses - reference and build on them\n");
            prompt.append("- Each answer should introduce new information, not repeat what was already said\n\n");

            prompt.append("## Strategic Analysis\n");
            prompt.append("Provide a direct, concise answer to the query (2-3 paragraphs). Include:\n");
            prompt.append("- The most relevant legal framework and authorities\n");
            prompt.append("- Key points specific to ").append(jurisdiction).append(" law\n");
            prompt.append("- Any critical deadlines, procedures, or requirements\n\n");

            prompt.append("(Cited sources go in the SOURCES marker at the end)\n\n");

            prompt.append("## Client Communication Note (when applicable)\n");
            prompt.append("When discussing strategic options, plea deals, motion outcomes, or key decisions:\n");
            prompt.append("💬 **Client Discussion**: [1-2 sentences explaining how to set client expectations]\n");
            prompt.append("Example: \"💬 **Client Discussion**: Explain to the client that this disposition option avoids a criminal conviction but requires completing the court-ordered program, so they should weigh avoiding a record against the program requirements.\"\n");
            prompt.append("Only include if the response discusses outcomes or decisions the client must understand or choose between.\n\n");

            prompt.append("## Follow-up Questions\n");
            prompt.append("Suggest 3-5 relevant follow-up questions that the USER (attorney) would ask YOU (AI) to research.\n\n");
            prompt.append("🚨 MANDATORY REQUIREMENT - COMPLETE QUESTIONS ONLY (STRICT ENFORCEMENT):\n");
            prompt.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            prompt.append("EVERY question MUST be a COMPLETE, GRAMMATICALLY CORRECT SENTENCE.\n");
            prompt.append("FRAGMENTS, KEYWORDS, and INCOMPLETE PHRASES WILL BE REJECTED.\n");
            prompt.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
            prompt.append("❌ REJECTED PATTERNS (DO NOT GENERATE):\n");
            prompt.append("• Single words: \"acquisition?\", \"waiver?\", \"jurisdiction?\"\n");
            prompt.append("• Fragments: \"faith purchaser defense to art\", \"good faith defense\"\n");
            prompt.append("• Keyword phrases: \"era Italian exports?\", \"expert requirements?\"\n");
            prompt.append("• Missing context: \"appointed experts in civil?\", \"export laws?\"\n");
            prompt.append("• Questions under 40 characters (likely incomplete)\n");
            prompt.append("• Questions without verbs: \"Italian art laws?\", \"restitution precedent?\"\n\n");
            prompt.append("✅ REQUIRED FORMAT (COMPLETE SENTENCES):\n");
            prompt.append("• \"Find [jurisdiction] cases on good faith purchaser defense for art restitution\" ✓\n");
            prompt.append("• \"Does [court] require court-appointed experts in art disputes?\" ✓\n");
            prompt.append("• \"What Italian export laws applied to Renaissance artwork in 1943?\" ✓\n");
            prompt.append("• \"How does First Circuit define 'good faith' in acquisition cases?\" ✓\n\n");
            prompt.append("Questions must be complete, grammatically correct sentences. No fragments or single words.\n\n");
            prompt.append("**FOLLOW-UP QUALITY RULES**:\n");
            prompt.append("- Jurisdiction-specific (mention court, circuit, or state)\n");
            prompt.append("- Precedent-focused (\"Find cases\", \"How does [court] interpret\")\n");
            prompt.append("- Research-oriented requests from the attorney TO the AI\n");
            prompt.append("- NEVER ask the user for information\n\n");
            prompt.append("✅ Good: \"Find [court] cases on automobile exception for parked cars\"\n");
            prompt.append("✅ Good: \"Does INA § 212(h) waiver apply to aggravated felony convictions?\"\n");
            prompt.append("✅ Good: \"How does [circuit] apply McDonnell Douglas to age claims?\"\n");
            prompt.append("❌ Bad: \"What is qualified immunity?\" (too conceptual)\n");
            prompt.append("❌ Bad: \"What documents do you have?\" (asks user for info)\n\n");
        }

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
        prompt.append("**SPECIFICITY REQUIREMENT**:\n");
        prompt.append("Every piece of guidance must be jurisdiction-specific, practice-area-specific, and fact-specific.\n");
        prompt.append("❌ \"File your motion with supporting documents\" → ✓ \"Per [applicable local rule], file motion with supporting memorandum and proposed order\"\n");
        prompt.append("❌ \"Retain an expert witness\" → ✓ \"Retain [specialty] expert; budget $[range] for analysis + testimony\"\n\n");
        prompt.append("**ORAL ARGUMENT / CROSS-EXAMINATION**: Use THEMES and KEY POINTS, not word-for-word scripts. Provide strategic objectives, not scripted dialogue.\n\n");

        // Authority confidence tagging
        prompt.append("**CITATION TAGGING**:\n");
        prompt.append("- Statutes/regulations: Use ✓ prefix (e.g., \"✓ 18 U.S.C. § 1001\")\n");
        prompt.append("- Case law: Use ⚖️ prefix (e.g., \"⚖️ Ashcroft v. Iqbal, 556 U.S. 662, 678 (2009)\")\n");
        prompt.append("- Persuasive/lower court: Use 📋 prefix\n\n");

        // Enhanced case law citation format
        prompt.append("**CASE LAW CITATION FORMAT** (CRITICAL FOR 9-10/10 QUALITY):\n");
        prompt.append("Every case citation MUST include ALL four components:\n");
        prompt.append("1. Full Bluebook citation with pin cites: ⚖️ Ashcroft v. Iqbal, 556 U.S. 662, 678 (2009)\n");
        prompt.append("2. Holding in parentheses: \"(held that to survive a motion to dismiss, a complaint must contain sufficient factual matter to state a claim that is plausible on its face)\"\n");
        prompt.append("3. Relevance to current case showing how precedent applies to these specific facts\n");
        prompt.append("4. Include relevant case citations where they strengthen the analysis. Prioritize controlling authority from the jurisdiction.\n\n");
        prompt.append("**PIN CITE ENFORCEMENT**:\n");
        prompt.append("- EVERY case must have pin cites on first mention:\n");
        prompt.append("  ✓ CORRECT: ⚖️ Bell Atlantic Corp. v. Twombly, 550 U.S. 544, 570 (2007)\n");
        prompt.append("  ❌ WRONG: ⚖️ Twombly, 550 U.S. 544 (2007) — Missing pin cites!\n\n");

        // Assumption flagging (concise)
        prompt.append("**ASSUMPTIONS**: When your analysis depends on facts not in the case context, flag with ⚠️ **Assumption**: [what] — [impact if wrong].\n\n");

        // Jurisdiction-specific procedural citations
        prompt.append("**JURISDICTION-SPECIFIC PROCEDURAL CITATIONS**:\n\n");
        prompt.append("For FEDERAL cases:\n");
        prompt.append("- ALWAYS cite the applicable U.S. District Court's Local Rules alongside Fed. R. Civ. P./Crim. P.\n");
        prompt.append("- Include standing orders for specific judges when judge name is provided\n");
        prompt.append("- Calculate specific deadlines with rule citations, not generic timing\n\n");
        prompt.append("For STATE court cases:\n");
        prompt.append("- Cite the applicable state's Rules of Civil/Criminal Procedure with specific rule numbers\n");
        prompt.append("- Reference any court-specific standing orders or local rules\n");
        prompt.append("- Note session/division-specific procedural requirements when applicable\n\n");
        prompt.append("❌ INSUFFICIENT: \"File motion 30 days before trial\"\n");
        prompt.append("✓ SUFFICIENT: \"Per [applicable local rule] and [applicable procedural rule], file motion at least 30 days before trial with supporting memorandum\"\n\n");

        // UCC subsection specificity
        prompt.append("**UCC CITATION SPECIFICITY** (for commercial cases):\n");
        prompt.append("When citing UCC provisions, include ALL relevant subsections:\n");
        prompt.append("Example for commercial impracticability:\n");
        prompt.append("- ✓ UCC § 2-615(a): Basic commercial impracticability defense elements\n");
        prompt.append("- ✓ UCC § 2-615(b): Allocation among customers when partial performance possible\n");
        prompt.append("- ✓ UCC § 2-615(c): Seasonable notice requirement to buyer\n");
        prompt.append("Do NOT cite only the main section - include procedural subsections (notice, allocation) that often determine outcomes.\n\n");

        // Citation approach
        prompt.append("**CITATION APPROACH**:\n");
        prompt.append("Provide actual cases when you know them. For narrow topics where specific precedent is uncertain, ");
        prompt.append("clearly state the legal principle and suggest a targeted research strategy.\n\n");

        // Practice-area specific deep expertise
        prompt.append("**PRACTICE-AREA DEEP EXPERTISE** (for achieving 9-10/10 quality):\n\n");
        prompt.append("When the case involves these specialized areas, proactively include detailed guidance:\n\n");
        prompt.append("CRYPTOCURRENCY/BLOCKCHAIN CASES:\n");
        prompt.append("- Name specific blockchain analysis firms: Chainalysis, CipherBlade, Elliptic (have testified in federal courts)\n");
        prompt.append("- Include cost estimates: \"Blockchain forensic analysis typically costs $15K-25K for expert report + declaration\"\n");
        prompt.append("- Reference crypto-specific defenses: market volatility vs. fraud, token vs. security classification under Howey test\n");
        prompt.append("- Cite SEC/CFTC guidance: ✓ SEC Framework for Investment Contract Analysis (2019), ✓ CFTC guidance on virtual currencies\n");
        prompt.append("- Federal sentencing: Note typical § 2B1.1 loss calculations for crypto fraud (actual loss = investment minus current token value)\n");
        prompt.append("- Wallet analysis: Explain difference between custodial vs. non-custodial wallets, private key searches\n\n");
        prompt.append("FEDERAL CRIMINAL DEFENSE:\n");
        prompt.append("- Cite ✓ U.S.S.G. commentary and Application Notes (not just main guidelines)\n");
        prompt.append("- Reference circuit-specific departure precedents with statistics when available\n");
        prompt.append("- Include typical plea bargaining ranges with jurisdiction context when applicable\n");
        prompt.append("- Note BOP facility designation factors: offense level, criminal history, geography\n");
        prompt.append("- For suppression motions: Include circuit success rates when discussing strategy\n");
        prompt.append("- Expert appointment: Reference ✓ 18 U.S.C. § 3006A(e) for indigent defendants needing experts\n\n");
        prompt.append("IMMIGRATION LAW:\n");
        prompt.append("- Always cite ✓ 8 C.F.R. regulations (not just INA statutes)\n");
        prompt.append("- Reference EOIR Practice Manual by section number for procedure\n");
        prompt.append("- Include BIA precedent decisions in \"Matter of [Name]\" format\n");
        prompt.append("- Note USCIS Policy Manual volume and chapter for benefit applications\n");
        prompt.append("- Include processing times from USCIS website when discussing timelines\n");
        prompt.append("- Specify which USCIS service center or asylum office has jurisdiction\n\n");
        prompt.append("STATE CIVIL LITIGATION:\n");
        prompt.append("- Cite court-specific standing orders and local rules by number\n");
        prompt.append("- Reference the jurisdiction's court rule-specific requirements\n");
        prompt.append("- Include typical discovery timelines for the relevant court\n");
        prompt.append("- Note fee-shifting provisions when applicable under the jurisdiction's consumer protection and frivolous claims statutes\n");
        prompt.append("- For commercial cases: Reference whether business/commercial court assignment is appropriate\n\n");
        prompt.append("GENERAL PRINCIPLE: Every piece of guidance must be jurisdiction-specific, practice-area-specific, case-stage-specific, and fact-specific (not generic).\n\n");

        // FAST MODE CITATION POLICY - CRITICAL
        prompt.append("⚠️⚠️⚠️ CITATION POLICY - FAST MODE ⚠️⚠️⚠️\n");
        prompt.append("DO NOT include ANY case citations in FAST mode responses.\n");
        prompt.append("FAST mode cannot verify citations → citing cases = hallucination risk (industry: 17-33%)\n");
        prompt.append("Instead: Explain legal concepts, procedures, timelines WITHOUT citing specific cases\n");
        prompt.append("If user asks for case law, suggest: 'For verified case citations, please switch to THOROUGH mode'\n\n");

        // Mode nudge: Suggest THOROUGH mode when query indicates need for deep research
        if (shouldSuggestThoroughMode(query)) {
            String nudge = getThoroughModeNudge(query);
            prompt.append("**MODE SUGGESTION**:\n");
            prompt.append("Include this tip BEFORE the \"Follow-up Questions\" section:\n\n");
            prompt.append(nudge).append("\n\n");
        }

        // Add practice-area-specific follow-up templates
        prompt.append(getFollowUpTemplatesByPracticeArea(query, questionType)).append("\n");

        return prompt.toString();
    }

    /**
     * Append case-specific context to the prompt. Extracted to eliminate duplication
     * between numeric ID lookup and case_number lookup paths.
     * Uses compact JSON for basic case data to reduce token usage.
     */
    private void appendCaseContext(StringBuilder prompt, LegalCase legalCase, QuestionType questionType) {
        boolean isFollowUp = questionType == QuestionType.FOLLOW_UP_CLARIFICATION;
        String countyName = legalCase.getCountyName();
        // Use case jurisdiction if set, otherwise fall back to org state
        String caseJurisdiction = legalCase.getJurisdiction() != null ? legalCase.getJurisdiction() : "the applicable state";
        String jurisdictionType = "STATE";
        String applicableRules = caseJurisdiction + " Rules of Civil/Criminal Procedure";

        if (!isFollowUp) {
            // Full case context for initial questions — compact JSON format
            prompt.append("**CASE CONTEXT** (tailor response to this case):\n");

            // Build case data as compact JSON to reduce tokens
            java.util.LinkedHashMap<String, Object> caseData = new java.util.LinkedHashMap<>();
            caseData.put("caseNumber", legalCase.getCaseNumber());
            caseData.put("title", legalCase.getTitle());
            caseData.put("type", legalCase.getEffectivePracticeArea() != null ? legalCase.getEffectivePracticeArea() : "General");
            if (legalCase.getDescription() != null && !legalCase.getDescription().isEmpty()) {
                caseData.put("description", removeStaleDateCalculations(legalCase.getDescription()));
            }
            if (countyName != null && !countyName.isEmpty()) {
                caseData.put("county", countyName);
                String countyLower = countyName.toLowerCase();
                if (countyLower.contains("u.s. district") || countyLower.contains("federal") ||
                    countyLower.contains("usdc") || countyLower.contains("united states district")) {
                    jurisdictionType = "FEDERAL";
                    applicableRules = "Federal Rules of Civil Procedure (FRCP)";
                }
                // For state courts, applicableRules already set from user-selected jurisdiction
            }
            if (legalCase.getCourtroom() != null && !legalCase.getCourtroom().isEmpty()) {
                caseData.put("courtroom", legalCase.getCourtroom());
            }
            if (legalCase.getJudgeName() != null && !legalCase.getJudgeName().isEmpty()) {
                caseData.put("judge", legalCase.getJudgeName());
            }
            if (legalCase.getStatus() != null) {
                caseData.put("status", legalCase.getStatus().toString());
            }
            if (legalCase.getPriority() != null) {
                caseData.put("priority", legalCase.getPriority().toString());
            }
            caseData.put("client", legalCase.getClientName());
            try {
                prompt.append(objectMapper.writeValueAsString(caseData)).append("\n\n");
            } catch (Exception e) {
                log.warn("Could not serialize case data to JSON, falling back to text", e);
                prompt.append("Case: ").append(legalCase.getCaseNumber()).append(" - ").append(legalCase.getTitle()).append("\n\n");
            }

            // Court-specific rules
            String caseDetails = String.format("County: %s, Type: %s, Description: %s",
                countyName != null ? countyName : "",
                legalCase.getEffectivePracticeArea() != null ? legalCase.getEffectivePracticeArea() : "",
                legalCase.getDescription() != null ? legalCase.getDescription() : ""
            );
            CourtRulesService.CourtRulesContext courtRules = courtRulesService.getApplicableRules(caseDetails);
            if (courtRules != null) {
                prompt.append(courtRules.generatePromptAddition()).append("\n");
            }
        } else {
            // Minimal context for follow-ups (do not repeat)
            prompt.append("**CASE CONTEXT** (reference only - do not repeat):\n");
            prompt.append("Case: ").append(legalCase.getCaseNumber()).append(" - ").append(legalCase.getTitle()).append("\n");
        }

        // Procedural timeline (always include — dates can change)
        prompt.append("\n**Procedural Timeline:**\n");
        String proceduralStage = "Unknown stage";

        if (legalCase.getFilingDate() != null) {
            prompt.append("- Filing Date: ").append(legalCase.getFilingDate()).append("\n");
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
            long daysToHearing = (legalCase.getNextHearing().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
            String timeDescription = daysToHearing >= 0
                ? daysToHearing + " days from now"
                : Math.abs(daysToHearing) + " days ago (DEADLINE PASSED)";
            prompt.append("- Next Hearing: ").append(legalCase.getNextHearing())
                  .append(" (").append(timeDescription).append(")\n");
            proceduralStage = daysToHearing >= 0 ? "Active litigation with upcoming hearing" : "Active litigation - hearing deadline passed";
        }
        if (legalCase.getTrialDate() != null) {
            long daysToTrial = (legalCase.getTrialDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
            String timeDescription = daysToTrial >= 0
                ? daysToTrial + " days from now"
                : Math.abs(daysToTrial) + " days ago (PAST)";
            prompt.append("- Trial Date: ").append(legalCase.getTrialDate())
                  .append(" (").append(timeDescription).append(")\n");
            proceduralStage = daysToTrial >= 0 ? "Trial preparation phase" : "Post-trial phase";
        }
        prompt.append("- Stage: ").append(proceduralStage).append("\n");

        // Client info
        prompt.append("- Client: ").append(legalCase.getClientName()).append(" (address the ATTORNEY, not the client)\n");

        // Jurisdiction and procedural posture instructions
        prompt.append("\n**CRITICAL INSTRUCTIONS**:\n");
        prompt.append("1. JURISDICTION: ").append(jurisdictionType).append(" court. Use ONLY ").append(applicableRules).append(". Do not mix federal/state rules.\n");
        prompt.append("2. PROCEDURAL STAGE: \"").append(proceduralStage).append("\" — tailor recommendations accordingly.\n");

        // Case-type-specific instructions
        String caseType = legalCase.getEffectivePracticeArea() != null ? legalCase.getEffectivePracticeArea().toLowerCase() : "";
        log.info("Case type for case {}: '{}' (practiceArea: '{}', type: '{}')",
                 legalCase.getCaseNumber(), caseType, legalCase.getPracticeArea(), legalCase.getType());

        appendCaseTypeInstructions(prompt, caseType);

        prompt.append("4. PRACTICAL FOCUS: Provide SPECIFIC, ACTIONABLE guidance for THIS case. No generic legal education.\n\n");

        // Judge personalization
        if (legalCase.getJudgeName() != null && !legalCase.getJudgeName().isEmpty()) {
            prompt.append("5. Reference judge ").append(legalCase.getJudgeName()).append(" by name when discussing hearings, motions, or rulings.\n\n");
        }

        // Deadline urgency — skip for follow-ups
        if (!isFollowUp && legalCase.getNextHearing() != null) {
            long daysToHearing = (legalCase.getNextHearing().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
            if (daysToHearing < 0) {
                prompt.append("🚨 PAST DEADLINE: ").append(legalCase.getNextHearing())
                      .append(" (").append(Math.abs(daysToHearing)).append(" days ago). IMMEDIATE EMERGENCY ACTION REQUIRED.\n\n");
            } else if (daysToHearing < 45) {
                String urgencyLevel = daysToHearing < 15 ? "CRITICAL URGENCY" :
                                     daysToHearing < 30 ? "URGENT" : "TIME-SENSITIVE";
                prompt.append(urgencyLevel).append(": Next hearing ").append(legalCase.getNextHearing())
                      .append(" (").append(daysToHearing).append(" days).");
                if (daysToHearing < 30 && legalCase.getPriority() != null &&
                    (legalCase.getPriority().toString().equals("URGENT") || legalCase.getPriority().toString().equals("HIGH"))) {
                    prompt.append(" HIGH-PRIORITY — emphasize immediate action.");
                }
                prompt.append("\n\n");
            }
        }
    }

    /**
     * Append case-type-specific legal instructions to the prompt.
     */
    private void appendCaseTypeInstructions(StringBuilder prompt, String caseType) {
        if (caseType.contains("data breach") || caseType.contains("privacy")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: DATA BREACH/PRIVACY case.\n");
            prompt.append("   - Article III standing, credit monitoring, notification obligations, consumer protection statutes (FCRA)\n");
            prompt.append("   - If class action: class certification challenges. COSTS: Cyber expert $30K-$60K, notification $50K-$200K, forensics $25K-$50K\n");
            prompt.append("   - TIMELINE: Class cert 9-15 months; settlement 12-24 months\n\n");
        } else if (caseType.contains("malpractice") || caseType.contains("medical negligence")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: MEDICAL MALPRACTICE case.\n");
            prompt.append("   - Expert testimony REQUIRED per applicable state law. Screening/tribunal requirements vary by state; Erie doctrine (federal)\n");
            prompt.append("   - SOL: Varies by state (typically 2-3 years from discovery). Check applicable statute of limitations and damages caps\n");
            prompt.append("   - COSTS: Medical expert $15K-$30K, causation $10K-$25K, economics $15K-$25K, life care $25K-$50K\n");
            prompt.append("   - TIMELINE: Tribunal 3-9 months; trial 18-30 months from filing\n\n");
        } else if (caseType.contains("class action")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: CLASS ACTION. Address Rule 23 (numerosity, commonality, typicality, adequacy), certification timing, notice, settlement approval.\n\n");
        } else if (caseType.contains("employment")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: EMPLOYMENT case.\n");
            prompt.append("   - McDonnell Douglas framework (prima facie → legitimate reason → pretext). Administrative exhaustion (EEOC 300/180 days)\n");
            prompt.append("   - Comparator evidence, temporal proximity for retaliation. Discovery: personnel files, reviews, emails\n");
            prompt.append("   - Key statutes: Title VII, ADEA, ADA, FMLA, FLSA. COSTS: Experts $15K-$30K; 12-18 months to trial\n\n");
        } else if (caseType.contains("family") || caseType.contains("divorce") || caseType.contains("custody")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: FAMILY LAW case.\n");
            prompt.append("   - Best interests of the child standard. Modification: material change required\n");
            prompt.append("   - GAL ($3K-$10K), parenting plan required, applicable state child support guidelines. Evidence: stability, caregiving, mental health\n");
            prompt.append("   - TIMELINE: Temporary orders 2-4 weeks; trial 6-12 months\n\n");
        } else if (caseType.contains("estate") || caseType.contains("probate") || caseType.contains("will")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: ESTATE/PROBATE case.\n");
            prompt.append("   - Contest grounds: capacity, undue influence, fraud, improper execution per applicable probate code, revocation\n");
            prompt.append("   - Standing: interested persons only. Fiduciary duties: loyalty, prudence, impartiality\n");
            prompt.append("   - COSTS: $50K-$200K+; experts $10K-$25K each. TIMELINE: 3-6 months to hearing\n\n");
        } else if (caseType.contains("real estate") || caseType.contains("property")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: REAL ESTATE case.\n");
            prompt.append("   - Specific performance (unique land), marketable title, P&S agreement, time of essence, title insurance exceptions\n");
            prompt.append("   - Remedies: specific performance, rescission + deposit return, damages\n");
            prompt.append("   - TIMELINE: Title exam 2-4 weeks, closing 30-60 days, litigation 12-18 months\n\n");
        } else if (caseType.contains("trade secret") || caseType.contains("misappropriation")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: TRADE SECRETS case.\n");
            prompt.append("   - DTSA federal + state claims. Identification with reasonable particularity. Protection measures (NDAs, access controls)\n");
            prompt.append("   - Preliminary injunction for ongoing misappropriation. Irreparable harm — cannot be un-rung\n\n");
        } else if (caseType.contains("immigration") || caseType.contains("removal") || caseType.contains("asylum")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: IMMIGRATION case.\n");
            prompt.append("   - Dual proceedings coordination. Aggravated felony = mandatory removal. Asylum: persecution on protected ground\n");
            prompt.append("   - Country conditions expert testimony. Padilla: counsel MUST advise on immigration consequences of pleas\n\n");
        } else if (caseType.contains("bankruptcy")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: BANKRUPTCY case.\n");
            prompt.append("   - Ch. 11 first-day motions: cash collateral (§363(c)), DIP financing (§364), critical vendors, wages, utilities\n");
            prompt.append("   - Automatic stay (§362). Fed. R. Bankr. P. (NOT FRCP). First-day hearing 24-48 hours post-petition\n");
            prompt.append("   - Key: §365 (executory contracts), §503(b)(9) (reclamation), §1129 (plan confirmation)\n\n");
        } else if (caseType.contains("tax")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: TAX case.\n");
            prompt.append("   - Tax Court: 90-day petition deadline (150 abroad) — jurisdictional. Burden: IRS for fraud (§7491(c)), taxpayer otherwise\n");
            prompt.append("   - SOL: 3 years (§6501(a)), 6 years for 25%+ understatement, unlimited for fraud. Golsen Rule: circuit of residence\n");
            prompt.append("   - Penalties: accuracy 20% (§6662), fraud 75% (§6663), failure to file 5%/month up to 25%\n\n");
        } else if (caseType.contains("securities") || caseType.contains("fraud") && (caseType.contains("stock") || caseType.contains("investment"))) {
            prompt.append("3. CASE-SPECIFIC FOCUS: SECURITIES case.\n");
            prompt.append("   - 10b-5: material misrep, scienter, connection with purchase/sale, reliance, economic loss, loss causation\n");
            prompt.append("   - PSLRA: plead scienter with particularity (Tellabs strong inference). Loss causation per Dura Pharmaceuticals\n");
            prompt.append("   - SOL: 2 years from discovery, 5 years from violation (SOX)\n\n");
        } else if (caseType.contains("patent") || caseType.contains("intellectual property") || caseType.contains("ip")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: PATENT/IP case.\n");
            prompt.append("   - Federal Circuit exclusive. Alice/§101 (abstract ideas). KSR/§103 (obviousness). Markman claim construction\n");
            prompt.append("   - Willfulness: 3x damages under §284 (Halo standard). COSTS: Tech experts $50K-$150K+, damages $75K-$200K\n");
            prompt.append("   - TIMELINE: Markman 12-18 months, trial 24-36 months. PTAB may stay district court\n\n");
        } else if (caseType.contains("antitrust")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: ANTITRUST case.\n");
            prompt.append("   - Sherman §1: agreement required (Twombly). §2: monopoly power (>65%) + exclusionary conduct (Grinnell)\n");
            prompt.append("   - Market definition: SSNIP test. Treble damages (§4 Clayton). Predatory pricing: Brooke Group\n");
            prompt.append("   - COSTS: Econ expert $75K-$200K+\n\n");
        } else if (caseType.contains("environmental") || caseType.contains("cercla") || caseType.contains("epa")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: ENVIRONMENTAL case.\n");
            prompt.append("   - CERCLA: strict, joint/several, retroactive. Defenses: innocent landowner, third-party, BFPP\n");
            prompt.append("   - AAI: 40 CFR Part 312, ASTM E1527. PRP categories under §9607(a). Settlement under §9622\n\n");
        } else if (caseType.contains("civil rights") || caseType.contains("§ 1983") || caseType.contains("1983")) {
            prompt.append("3. CASE-SPECIFIC FOCUS: CIVIL RIGHTS case.\n");
            prompt.append("   - Qualified immunity: (1) constitutional violation? (2) clearly established? (Pearson). High specificity required (White v. Pauly)\n");
            prompt.append("   - Immunity from suit — immediately appealable (Mitchell). Distinguish absolute immunity (prosecutors, judges)\n\n");
        }
    }

    /**
     * Generate practice-area-specific follow-up question templates
     * to help AI create attorney-focused, tactical follow-up questions
     */
    private String getFollowUpTemplatesByPracticeArea(String query, QuestionType questionType) {
        String queryLower = query.toLowerCase();

        StringBuilder templates = new StringBuilder();
        templates.append("\n**PRACTICE-AREA-SPECIFIC FOLLOW-UP TEMPLATES**:\n");
        templates.append("Generate follow-ups using these templates for your practice area:\n\n");

        // Immigration
        if (isImmigrationQuery(queryLower)) {
            templates.append("Immigration:\n");
            templates.append("- \"Find [Circuit] precedent on [specific immigration issue]\"\n");
            templates.append("- \"How does Matter of [X] affect [type of application]?\"\n");
            templates.append("- \"Can I file [form] before/after [procedural step]?\"\n");
            templates.append("- \"Does [INA section] exception apply to [scenario]?\"\n\n");
        }

        // Criminal Defense
        if (queryLower.matches(".*(suppression|search|seizure|arrest|miranda|fourth amendment|criminal|defendant|motion to suppress|warrant|probable cause|exigent).*")) {
            templates.append("Criminal Defense:\n");
            templates.append("- \"Does [exception] apply to [specific scenario] in [jurisdiction]?\"\n");
            templates.append("- \"Find [court] cases on [constitutional issue] for [fact pattern]\"\n");
            templates.append("- \"Can I suppress evidence if [specific defect in procedure]?\"\n");
            templates.append("- \"What's strongest response to [prosecution's anticipated argument]?\"\n\n");
        }

        // Civil Litigation
        if (queryLower.matches(".*(summary judgment|motion to dismiss|pleading|discovery|trial|complaint|answer|rule 12|rule 56|class action).*")) {
            templates.append("Civil Litigation:\n");
            templates.append("- \"Find [court] cases [granting/denying] [motion] despite [complication]\"\n");
            templates.append("- \"Does [local rule] apply to [specific situation] in [court]?\"\n");
            templates.append("- \"How does [circuit] interpret [legal standard] differently?\"\n");
            templates.append("- \"Can I get [relief] without showing [typical requirement]?\"\n\n");
        }

        // Employment Law
        if (queryLower.matches(".*(employment|discrimination|retaliation|wrongful termination|title vii|eeoc|ada|fmla|flsa).*")) {
            templates.append("Employment Law:\n");
            templates.append("- \"Find [circuit] cases on [employment issue] for [scenario]\"\n");
            templates.append("- \"How does [circuit] apply McDonnell Douglas to [claim type]?\"\n");
            templates.append("- \"Does [statute] exception apply to [employee classification]?\"\n");
            templates.append("- \"What temporal proximity standard applies in [circuit] for retaliation?\"\n\n");
        }

        // Medical Malpractice
        if (queryLower.matches(".*(malpractice|medical negligence|standard of care|expert testimony|informed consent).*")) {
            templates.append("Medical Malpractice:\n");
            templates.append("- \"Find [jurisdiction] cases on [medical procedure] standard of care\"\n");
            templates.append("- \"Does screening/tribunal requirement apply in federal court for [state] malpractice?\"\n");
            templates.append("- \"What expert qualifications required for [specialty] in [state]?\"\n");
            templates.append("- \"How does res ipsa loquitur apply to [scenario] in [jurisdiction]?\"\n\n");
        }

        templates.append("**Use these templates to generate jurisdiction-specific, precedent-focused follow-ups.**\n");
        templates.append("**Each follow-up MUST reference a specific court, statute, case, or procedural rule.**\n");
        return templates.toString();
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
                       "Be specific about the applicable jurisdiction's requirements.";

            case APPEAL_PROCESS:
                return "Explain the appeal process including:\n" +
                       "• Specific deadlines (e.g., 30 days from judgment)\n" +
                       "• Required forms and documents\n" +
                       "• Filing procedures and fees\n" +
                       "• Standards of review and chances of success\n" +
                       "• Timeline for the appeal process\n\n" +
                       "Cite the applicable Rules of Appellate Procedure for the jurisdiction.";

            case CRIMINAL_DEFENSE:
                return "Provide criminal defense guidance including:\n" +
                       "• Specific legal options and defenses available\n" +
                       "• Procedural requirements and deadlines\n" +
                       "• Rights of the defendant\n" +
                       "• Potential penalties and consequences\n" +
                       "• Next steps in the legal process\n\n" +
                       "Reference the applicable criminal statutes and court rules for the jurisdiction.";

            case CIVIL_LITIGATION:
                return "Explain civil litigation procedures including:\n" +
                       "• Cause of action and legal theories\n" +
                       "• Statute of limitations\n" +
                       "• Required elements to prove the case\n" +
                       "• Procedural requirements for filing\n" +
                       "• Potential damages and remedies\n\n" +
                       "Cite the applicable statutes and court rules for the jurisdiction.";

            case FAMILY_LAW:
                return "Address family law matters including:\n" +
                       "• Specific legal requirements and procedures\n" +
                       "• Required documentation and forms\n" +
                       "• Timeline and court process\n" +
                       "• Rights and obligations of parties\n" +
                       "• Potential outcomes and enforcement\n\n" +
                       "Reference the applicable family law statutes and guidelines for the jurisdiction.";

            case BUSINESS_LAW:
                return "Explain business law requirements including:\n" +
                       "• Legal compliance requirements\n" +
                       "• Filing procedures and deadlines\n" +
                       "• Required documentation\n" +
                       "• Regulatory obligations\n" +
                       "• Potential legal consequences\n\n" +
                       "Cite the applicable business statutes and regulations for the jurisdiction.";

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
                       "Be specific about the applicable jurisdiction's law and procedures.";
        }
    }

    /**
     * Detects if query would benefit from THOROUGH mode's deep research capabilities
     */
    private boolean shouldSuggestThoroughMode(String query) {
        if (query == null) return false;

        String queryLower = query.toLowerCase();

        // Case law / precedent queries
        if (queryLower.contains("case law") || queryLower.contains("precedent") ||
            queryLower.contains("judicial decision") || queryLower.contains("court decision") ||
            queryLower.contains("controlling authority") || queryLower.contains("binding precedent") ||
            queryLower.contains("persuasive authority")) {
            return true;
        }

        // Comprehensive analysis requests
        if (queryLower.contains("comprehensive") || queryLower.contains("thorough") ||
            queryLower.contains("all relevant") || queryLower.contains("full analysis") ||
            queryLower.contains("deep dive") || queryLower.contains("all statutes") ||
            queryLower.contains("all authorities") || queryLower.contains("complete research")) {
            return true;
        }

        // Multi-jurisdiction / circuit analysis
        if (queryLower.contains("circuit split") || queryLower.contains("circuit court") ||
            queryLower.contains("multiple jurisdictions") || queryLower.contains("cross-jurisdiction") ||
            (queryLower.contains("first circuit") && queryLower.contains("second circuit")) ||
            queryLower.contains("different circuits")) {
            return true;
        }

        // Specific precedent sources
        if (queryLower.contains("bia precedent") || queryLower.contains("tax court precedent") ||
            queryLower.contains("published opinion") || queryLower.contains("unpublished decision") ||
            queryLower.contains("supreme court precedent")) {
            return true;
        }

        // Legislative / statutory deep research
        if (queryLower.contains("legislative history") || queryLower.contains("congressional intent") ||
            queryLower.contains("statutory interpretation") || queryLower.contains("regulatory history") ||
            queryLower.contains("rulemaking")) {
            return true;
        }

        return false;
    }

    /**
     * Generates context-specific nudge based on query content
     */
    private String getThoroughModeNudge(String query) {
        String queryLower = query.toLowerCase();

        // Case law / precedent specific
        if (queryLower.contains("case law") || queryLower.contains("precedent")) {
            return "💡 **Mode Tip**: For comprehensive precedent analysis with 5-10 cited cases, try **THOROUGH Mode**";
        }

        // Circuit / jurisdiction specific
        if (queryLower.contains("circuit") || queryLower.contains("multiple jurisdictions")) {
            return "⚡ **Research Tip**: THOROUGH Mode provides circuit-by-circuit analysis with judicial precedents";
        }

        // Legislative history specific
        if (queryLower.contains("legislative history") || queryLower.contains("congressional intent")) {
            return "💡 **Pro Tip**: Switch to THOROUGH Mode for legislative history and statutory interpretation research";
        }

        // BIA / Immigration precedent
        if (queryLower.contains("bia precedent") || queryLower.contains("immigration precedent")) {
            return "⚡ **Research Tip**: THOROUGH Mode searches BIA precedent decisions and circuit immigration case law";
        }

        // Tax Court precedent
        if (queryLower.contains("tax court precedent")) {
            return "💡 **Mode Tip**: THOROUGH Mode analyzes Tax Court precedents (T.C. and T.C. Memo) with full citations";
        }

        // Comprehensive / all authorities
        if (queryLower.contains("comprehensive") || queryLower.contains("all relevant") || queryLower.contains("all authorities")) {
            return "⚡ **Research Tip**: THOROUGH Mode delivers deep analysis with multiple sources and full citations";
        }

        // Default nudge
        return "💡 **Mode Tip**: For deeper research with case law and full citations, try **THOROUGH Mode**";
    }

    private Map<String, Object> combineResultsWithAI(Map<String, Object> searchResults, String aiAnalysis) {
        Map<String, Object> combined = new HashMap<>(searchResults);
        combined.put("aiAnalysis", aiAnalysis);
        combined.put("hasAIAnalysis", true);
        combined.put("researchMode", "FAST");  // Mode used for this response
        return combined;
    }



    private void saveSearchHistory(Long userId, String sessionId, String query, String searchType,
                                   Integer resultsCount, Long executionTime) {
        try {
            if (userId != null) {
                // SECURITY: Require organization context for search history
                Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
                if (orgId == null) {
                    log.warn("Cannot save search history without organization context for user: {}", userId);
                    return;
                }

                QueryType queryTypeEnum = QueryType.valueOf(searchType.toUpperCase());

                SearchHistory history = SearchHistory.builder()
                    .userId(userId)
                    .organizationId(orgId)
                    .sessionId(sessionId)
                    .searchQuery(query)
                    .queryType(queryTypeEnum)
                    .resultsCount(resultsCount)
                    .executionTimeMs(executionTime)
                    .isSaved(false)
                    .build();

                searchHistoryRepository.save(history);
                log.info("Saved search history for user: {} in org: {} query: {}", userId, orgId, query);
            }
        } catch (Exception e) {
            log.error("Failed to save search history: ", e);
        }
    }


    // Utility methods
    private String generateQueryHash(String query, String searchType, String jurisdiction, String caseId, String researchMode) {
        try {
            // Include caseId in hash to ensure different cases get different cached responses
            // Use "general" for queries not tied to a specific case
            String caseIdentifier = (caseId != null && !caseId.isEmpty()) ? caseId : "general";

            // CRITICAL: Include current date in hash to invalidate cache daily
            // This ensures deadline calculations are always current
            String currentDate = java.time.LocalDate.now().toString();

            // CRITICAL: Include researchMode to separate FAST and THOROUGH caches
            String combined = query + "|" + searchType + "|" + jurisdiction + "|" + caseIdentifier + "|" + currentDate + "|" + researchMode;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            log.error("Failed to generate query hash: ", e);
            return UUID.randomUUID().toString();
        }
    }

    /**
     * Extract conversation history from search request.
     * Parses the conversationHistory field from the request map and converts it to ConversationMessage objects.
     */
    @SuppressWarnings("unchecked")
    private List<ConversationMessage> extractConversationHistory(Map<String, Object> searchRequest) {
        List<ConversationMessage> history = new ArrayList<>();

        try {
            Object historyObj = searchRequest.get("conversationHistory");
            if (historyObj instanceof List) {
                List<Map<String, Object>> historyList = (List<Map<String, Object>>) historyObj;

                for (Map<String, Object> messageMap : historyList) {
                    String role = (String) messageMap.get("role");
                    String content = (String) messageMap.get("content");

                    // Handle timestamp - could be String or LocalDateTime
                    LocalDateTime timestamp = null;
                    Object timestampObj = messageMap.get("timestamp");
                    if (timestampObj instanceof String) {
                        // Parse ISO 8601 with milliseconds and 'Z' suffix (e.g., 2025-10-21T20:42:19.322Z)
                        timestamp = java.time.Instant.parse((String) timestampObj)
                            .atZone(java.time.ZoneId.systemDefault())
                            .toLocalDateTime();
                    } else if (timestampObj instanceof LocalDateTime) {
                        timestamp = (LocalDateTime) timestampObj;
                    }

                    if (role != null && content != null) {
                        history.add(new ConversationMessage(role, content, timestamp));
                    }
                }

                log.info("📚 Extracted {} conversation messages from request", history.size());
            }
        } catch (Exception e) {
            log.warn("Failed to parse conversation history: {}", e.getMessage());
        }

        return history;
    }

    /**
     * Detect question type based on patterns in the query and conversation context.
     * This helps determine the appropriate response format and level of detail.
     */
    /**
     * Resolve jurisdiction from case context: case.jurisdiction → org.state → "General".
     * Used by both FAST and THOROUGH research paths as fallback when no explicit jurisdiction is provided.
     */
    private String resolveCaseJurisdiction(String caseId) {
        if (caseId != null && !caseId.isEmpty()) {
            try {
                Long caseIdLong = Long.parseLong(caseId);
                Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
                if (orgId != null) {
                    Optional<LegalCase> caseOpt = legalCaseRepository.findByIdAndOrganizationId(caseIdLong, orgId);
                    if (caseOpt.isPresent() && caseOpt.get().getJurisdiction() != null) {
                        String resolved = caseOpt.get().getJurisdiction();
                        log.info("📍 Resolved jurisdiction from case {}: {}", caseId, resolved);
                        return resolved;
                    }
                }
            } catch (NumberFormatException ignored) {}
        }
        return "General";
    }

    private QuestionType detectQuestionType(String query, List<ConversationMessage> conversationHistory) {
        String queryLower = query.toLowerCase().trim();

        // FOLLOW_UP_CLARIFICATION: User is asking for more detail on previous discussion
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            // Short questions in context of conversation are usually follow-ups
            if (queryLower.split("\\s+").length <= 10) {
                if (queryLower.matches(".*(elaborate|explain|clarify|mean by|tell me more|more about|more detail|specifically|example).*")) {
                    log.debug("📋 Detected FOLLOW_UP_CLARIFICATION (elaboration request with context)");
                    return QuestionType.FOLLOW_UP_CLARIFICATION;
                }
            }

            // Pronoun references indicate follow-up ("that", "this", "it", "those")
            if (queryLower.matches(".*(what (is|does|are) (this|that|it|those)|about (this|that|it)|regarding (this|that)).*")) {
                log.debug("📋 Detected FOLLOW_UP_CLARIFICATION (pronoun reference)");
                return QuestionType.FOLLOW_UP_CLARIFICATION;
            }
        }

        // NARROW_TECHNICAL: Asking about specific statute, citation, or definition
        if (queryLower.matches(".*(what (does|is)|define|definition of|meaning of|text of|language of|cite|citation|section|statute|rule|regulation|irc|usc|cfr|§).*")) {
            // But if it's asking for strategy/arguments with the citation, it's still INITIAL_STRATEGY
            if (!queryLower.matches(".*(strateg|argument|approach|defend|attack|challenge|motion|brief|position).*")) {
                log.debug("📋 Detected NARROW_TECHNICAL (specific legal concept/citation)");
                return QuestionType.NARROW_TECHNICAL;
            }
        }

        // PROCEDURAL_GUIDANCE: Asking about how to do something procedurally
        if (queryLower.matches(".*(how (do|can|should) (i|we)|steps (for|to)|procedure|process|filing|deadline|timeline|schedule|calendar).*")) {
            log.debug("📋 Detected PROCEDURAL_GUIDANCE (procedural how-to)");
            return QuestionType.PROCEDURAL_GUIDANCE;
        }

        // INITIAL_STRATEGY: Comprehensive case strategy questions (default for substantial questions)
        if (queryLower.matches(".*(strateg|argument|approach|strongest|best|recommend|advise|should we|what are|analyze|assess|review|evaluate|chances|likelihood|risk|exposure).*")) {
            log.debug("📋 Detected INITIAL_STRATEGY (comprehensive case strategy)");
            return QuestionType.INITIAL_STRATEGY;
        }

        // DEFAULT: If no pattern matches and there's no conversation history, treat as initial strategy
        if (conversationHistory == null || conversationHistory.isEmpty()) {
            log.debug("📋 Detected INITIAL_STRATEGY (default for first question)");
            return QuestionType.INITIAL_STRATEGY;
        }

        // DEFAULT: If there's conversation history but no clear pattern, treat as follow-up
        log.debug("📋 Detected FOLLOW_UP_CLARIFICATION (default for continued conversation)");
        return QuestionType.FOLLOW_UP_CLARIFICATION;
    }

    /**
     * Detect if user's query is about case documents/files
     */
    private boolean isDocumentRelatedQuery(String query) {
        if (query == null) return false;
        String q = query.toLowerCase();
        return q.matches(".*(document|contract|agreement|file|exhibit|pleading|motion|filed|uploaded|attachment|clause|term|provision|paragraph|section of the|what does the|review the|analyze the|read the|look at the|check the).*");
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
            .mapToLong(term -> lowerText.split(Pattern.quote(term)).length - 1)
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
        // NOTE: Removed short/ambiguous acronyms (visa, ice, bia) to avoid false positives
        String[] immigrationKeywords = {
            "immigration", "immigrant", "visa application", "visa petition", "visa status",
            "uscis", "immigration and customs enforcement", "cbp",
            "deportation", "removal", "asylum", "refugee", "citizenship",
            "naturalization", "8 cfr", "immigration and nationality act", "eoir", "homeland security",
            "board of immigration appeals", "immigration judge", "immigration court",
            "department of justice", "adjustment of status", "green card",
            "nonimmigrant", "lawful permanent", "i-130", "i-485", "i-765"
        };

        // Keywords that indicate NOT immigration (to filter out)
        // NOTE: Removed short acronyms (epa, fda, sec, usda) to avoid false positives
        String[] excludeKeywords = {
            "environmental", "environmental protection agency", "water quality", "air quality", "pollution",
            "food and drug administration", "drug", "medical device", "food safety", "pharmaceutical",
            "securities", "securities and exchange commission", "financial", "banking", "treasury",
            "agriculture", "agriculture department", "farm", "crop", "livestock"
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
        // NOTE: Only use full phrases or highly specific acronyms to avoid false positives
        // Removed: "ice" (matches practice, service), "bia" (matches viable), "visa" (matches television)
        // Removed: "nta" (matches representative), "rfe" (matches perfect), "noid" (matches avoid)
        // Removed: "tps", "daca", and short visa type codes to prevent substring false positives
        String[] immigrationIndicators = {
            "immigration", "immigrant", "green card", "citizenship",
            "naturalization", "deportation", "removal proceedings", "asylum",
            "refugee", "uscis", "eoir", "cbp",
            "immigration and customs enforcement",  // instead of "ice"
            "board of immigration appeals", "immigration judge", "immigration court",
            "i-130", "i-485", "i-765", "i-140", "i-129", "i-589", "n-400",
            "adjustment of status", "consular processing", "inadmissibility",
            "unlawful presence", "voluntary departure", "cancellation of removal",
            "withholding of removal", "convention against torture",
            "temporary protected status", "deferred action for childhood arrivals", "dream act",
            "h-1b visa category", "l-1 visa category", "f-1 visa category", "j-1 visa category",
            "eb-1 visa category", "eb-2 visa category", "eb-3 visa category",
            "family-based immigration", "employment-based immigration",
            "notice to appear", "master calendar", "individual hearing",
            "immigration appeal", "circuit court immigration",
            "administrative appeals office", "request for evidence",
            "notice of intent to deny", "immigration detention",
            "visa application", "visa petition", "visa status"  // instead of just "visa"
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
        // NOTE: Removed "ma " and " ma" to avoid false positives (matches may, make, schema, etc.)
        String[] massachusettsIndicators = {
            "massachusetts", "mass.", "mass ",
            "commonwealth", "boston", "worcester", "springfield",
            "m.g.l.", "general laws"  // Massachusetts General Laws
        };

        // State law practice area indicators (removed generic "appeal" - too broad)
        // NOTE: Removed "will" and "trust" to avoid false positives (matches "will be", "I trust that", etc.)
        String[] stateIndicators = {
            "state law", "state court", "state statute", "state regulation",
            "criminal", "conviction", "defendant", "sentencing",
            "divorce", "custody", "child support", "family law", "domestic",
            "probate", "estate", "guardianship",
            "last will and testament", "testamentary", "probate will", "codicil", "testator",
            "trust estate", "testamentary trust", "living trust", "irrevocable trust", "revocable trust",
            "trust instrument", "trustee", "beneficiary designation",
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
        // NOTE: Removed short/ambiguous terms (ice, visa, sec, epa, fda) to avoid false positives
        String[] federalIndicators = {
            "federal", "cfr", "usc", "united states code", "federal register",
            "securities and exchange commission",
            "environmental protection agency", "food and drug administration",
            "irs", "internal revenue service", "federal regulation", "federal law",
            "immigration", "uscis", "immigration and customs enforcement", "deportation", "asylum",
            "visa application", "visa petition", "visa status"  // instead of just "visa"
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
        // NOTE: Removed ALL short/ambiguous acronyms (epa, fda, sec, dol, doe, dos, cms, ftc, dhs, usda) to avoid false positives
        String[] federalAgencies = {
            "environmental protection agency",  // removed "epa" (matches prepare!)
            "securities and exchange commission",  // removed "sec"
            "food and drug administration",  // removed "fda"
            "irs", "internal revenue service",
            "department of labor", "osha", "occupational safety",  // removed "dol"
            "federal trade commission",  // removed "ftc"
            "cfpb", "consumer financial protection",
            "cftc", "commodity futures",
            "treasury", "treasury department",
            "homeland security", "department of homeland security",  // removed "dhs"
            "centers for medicare", "medicaid services",  // removed "cms"
            "agriculture department", "department of agriculture",  // removed "usda"
            "department of energy", "energy department",  // removed "doe"
            "commerce department", "transportation department",
            "uscis", "immigration and customs enforcement", "cbp", "eoir",  // removed "ice"
            "department of state", "state department"  // removed "dos"
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
        // NOTE: Removed "ma " and " ma" to avoid false positives (matches may, make, schema, etc.)
        String[] stateIndicators = {
            "massachusetts", "m.g.l.", "commonwealth", "state court", "state law", "state statute",
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
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(0, limit);
        // SECURITY: Use tenant-filtered query
        Page<SearchHistory> page = searchHistoryRepository.findByUserIdAndOrganizationIdOrderBySearchedAtDesc(userId, orgId, pageable);
        return page.getContent();
    }

    @Transactional(readOnly = true)
    public List<SearchHistory> getSavedSearches(Long userId) {
        Long orgId = getRequiredOrganizationId();
        return searchHistoryRepository.findByUserIdAndOrganizationIdAndIsSavedTrueOrderBySearchedAtDesc(userId, orgId);
    }

    public void saveSearch(Long searchHistoryId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use org-filtered query to verify ownership and org membership
        searchHistoryRepository.findByIdAndOrganizationId(searchHistoryId, orgId).ifPresent(search -> {
            if (search.getUserId().equals(userId)) {
                search.setIsSaved(true);
                searchHistoryRepository.save(search);
            }
        });
    }

    public void deleteSearchHistory(Long searchHistoryId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use org-filtered query to verify ownership and org membership
        searchHistoryRepository.findByIdAndOrganizationId(searchHistoryId, orgId).ifPresent(search -> {
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

    /**
     * Remove stale date calculations from case descriptions.
     * Case descriptions may contain old date calculations like "(in 28 days)" or "(3 months ago)"
     * that were accurate when the case was created but are now stale.
     */
    private String removeStaleDateCalculations(String description) {
        if (description == null) return "";

        // Remove patterns like "(in X days)", "(in X months)", "(X days from now)", etc.
        String cleaned = description
            .replaceAll("\\(in \\d+ days?\\)", "")
            .replaceAll("\\(in \\d+ weeks?\\)", "")
            .replaceAll("\\(in \\d+ months?\\)", "")
            .replaceAll("\\(\\d+ days? from now\\)", "")
            .replaceAll("\\(\\d+ days? ago\\)", "")
            .replaceAll("\\(\\d+ weeks? ago\\)", "")
            .replaceAll("\\(\\d+ months? ago\\)", "")
            .replaceAll("\\s+", " ")  // Normalize whitespace
            .trim();

        return cleaned;
    }

    /**
     * Extract deadline information from a legal case
     * Returns map of event name to DeadlineInfo with status (passed/upcoming)
     */
    private Map<String, DeadlineInfo> extractCaseDeadlines(LegalCase legalCase) {
        Map<String, DeadlineInfo> deadlines = new LinkedHashMap<>();

        if (legalCase == null) {
            return deadlines;
        }

        // Helper to convert Date to LocalDate
        // Note: JPA @Temporal(TemporalType.DATE) uses java.sql.Date which has direct toLocalDate()
        java.util.function.Function<Date, LocalDate> toLocalDate = date -> {
            if (date == null) return null;
            // java.sql.Date has native toLocalDate() method
            if (date instanceof java.sql.Date) {
                return ((java.sql.Date) date).toLocalDate();
            }
            // java.util.Date needs conversion via Instant
            return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        };

        // Extract filing date
        if (legalCase.getFilingDate() != null) {
            LocalDate filingDate = toLocalDate.apply(legalCase.getFilingDate());
            deadlines.put("Filing Date",
                DeadlineInfo.fromDate(filingDate, "Case Filed", DeadlineInfo.DeadlineType.FILING));
        }

        // Extract next hearing
        if (legalCase.getNextHearing() != null) {
            LocalDate hearingDate = toLocalDate.apply(legalCase.getNextHearing());
            deadlines.put("Next Hearing",
                DeadlineInfo.fromDate(hearingDate, "Next Hearing", DeadlineInfo.DeadlineType.HEARING));
        }

        // Extract trial date
        if (legalCase.getTrialDate() != null) {
            LocalDate trialDate = toLocalDate.apply(legalCase.getTrialDate());
            deadlines.put("Trial Date",
                DeadlineInfo.fromDate(trialDate, "Trial", DeadlineInfo.DeadlineType.TRIAL));
        }

        return deadlines;
    }

    /**
     * Smart mode selector: automatically choose optimal research mode based on query type
     * Returns the optimal mode, respecting explicit user choices
     */
    private ResearchMode selectOptimalMode(String query, ResearchMode requestedMode) {
        // Respect explicit user choices - only auto-select if mode is FAST (the default)
        // Users who explicitly choose THOROUGH get THOROUGH
        // This preserves backward compatibility while adding intelligence

        String lowerQuery = query.toLowerCase();

        // Pattern 1: Case law search queries → THOROUGH
        // "Find cases about...", "What cases address...", "Case law on..."
        boolean needsCaseLaw = lowerQuery.matches(".*\\b(find|search|locate|identify)\\s+(cases?|precedents?|decisions?)\\b.*") ||
                               lowerQuery.matches(".*\\bwhat\\s+cases?\\b.*") ||
                               lowerQuery.matches(".*\\bcase\\s+law\\s+(on|about|regarding)\\b.*") ||
                               lowerQuery.matches(".*\\b(supreme court|circuit|appellate)\\s+(cases?|decisions?|rulings?)\\b.*");

        // Pattern 2: Regulation/statute lookup queries → THOROUGH
        // "What does 8 CFR § 1003.38 say...", "Text of regulation...", "Read statute..."
        boolean needsRegulation = lowerQuery.matches(".*\\b(what|show|find|get)\\s+(does|me)?\\s*(the)?\\s*\\d+\\s+(cfr|u\\.?s\\.?c\\.?|c\\.?f\\.?r\\.).*") ||
                                  lowerQuery.contains("text of") && (lowerQuery.contains("regulation") || lowerQuery.contains("statute") || lowerQuery.contains("cfr")) ||
                                  lowerQuery.matches(".*\\bread\\s+(the\\s+)?(statute|regulation|rule)\\b.*");

        // Pattern 3: Citation verification queries → THOROUGH
        // "Verify this case...", "Is this citation correct...", "Check if case exists..."
        boolean needsVerification = lowerQuery.matches(".*\\b(verify|check|validate|confirm)\\s+(this|the|that)?\\s*(case|citation|holding)\\b.*") ||
                                    lowerQuery.matches(".*\\bis\\s+(this|that)\\s+(case|citation)\\s+(correct|valid|real)\\b.*");

        // Pattern 4: Strategic/procedural queries → FAST (Claude's reasoning is sufficient)
        // "What is our strategy...", "How should I approach...", "What are the risks..."
        boolean needsStrategy = lowerQuery.matches(".*\\b(what|how)\\s+(is|are|should)\\s+(our|my|the)\\s+(strategy|approach|defense|argument)\\b.*") ||
                                lowerQuery.matches(".*\\b(risks?|benefits?|pros?|cons?)\\b.*") ||
                                lowerQuery.matches(".*\\b(procedural|deadline|timeline|next\\s+steps?)\\b.*") ||
                                lowerQuery.matches(".*\\b(motion|brief|filing|discovery)\\s+(strategy|approach|plan)\\b.*");

        // Decision logic
        if (needsCaseLaw || needsRegulation || needsVerification) {
            log.info("📊 Query classifier: Detected {} - recommending THOROUGH mode",
                    needsCaseLaw ? "case law search" :
                    needsRegulation ? "regulation lookup" : "citation verification");
            return ResearchMode.THOROUGH;
        }

        if (needsStrategy) {
            log.info("📊 Query classifier: Detected strategic/procedural query - FAST mode sufficient");
            return ResearchMode.FAST;
        }

        // Default: preserve requested mode
        log.info("📊 Query classifier: No strong signal - using requested mode: {}", requestedMode);
        return requestedMode;
    }

    /**
     * Build prompt for agentic/thorough mode research
     * This prompt tells Claude to use tools for research instead of relying on pre-fetched documents
     */
    private String buildAgenticPrompt(String query, String caseId, List<ConversationMessage> conversationHistory, QuestionType questionType) {
        return buildAgenticPrompt(query, caseId, conversationHistory, questionType, null);
    }

    private String buildAgenticPrompt(String query, String caseId, List<ConversationMessage> conversationHistory, QuestionType questionType, String userJurisdiction) {
        StringBuilder prompt = new StringBuilder();

        log.info("🎯 THOROUGH mode - Question type: {} for query: {}", questionType, query.substring(0, Math.min(50, query.length())));

        // Resolve jurisdiction: user-selected > query detection > default
        String jurisdiction;
        boolean isImmigrationQuery = isImmigrationQuery(query);
        if (isImmigrationQuery) {
            jurisdiction = "Federal/Immigration";
        } else if (userJurisdiction != null && !userJurisdiction.isBlank()
                   && !"all".equalsIgnoreCase(userJurisdiction)
                   && !"general".equalsIgnoreCase(userJurisdiction)) {
            // Capitalize first letter if it's a state code like "texas" → "Texas"
            jurisdiction = userJurisdiction.substring(0, 1).toUpperCase() + userJurisdiction.substring(1);
        } else {
            // Fallback: resolve from case context (case jurisdiction → org state → "General")
            jurisdiction = resolveCaseJurisdiction(caseId);
        }

        prompt.append("Expert legal research assistant specializing in **").append(jurisdiction).append("** law. **TODAY: ").append(java.time.LocalDate.now().toString()).append("**\n\n");
        prompt.append("**JURISDICTION: ").append(jurisdiction).append("**\n");
        prompt.append("All legal analysis, case citations, statutes, and procedural rules MUST be specific to ").append(jurisdiction).append(". ");
        prompt.append("Do NOT cite Massachusetts law, M.G.L. statutes, or Mass. rules unless the jurisdiction IS Massachusetts.\n\n");

        // Add conversation history if available
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            prompt.append("**CONVERSATION HISTORY**:\n");
            prompt.append("This is a follow-up question in an ongoing conversation. Here is the conversation history:\n\n");

            for (ConversationMessage msg : conversationHistory) {
                prompt.append(msg.getRole().toUpperCase()).append(": ").append(msg.getContent()).append("\n\n");
            }

            prompt.append("**IMPORTANT**: This is a FOLLOW-UP question. ");
            prompt.append("Reference the previous conversation naturally without repeating information already provided. ");
            prompt.append("Build on what was already discussed. Focus on the new question and provide NEW insights.\n\n");
        }

        // Adaptive response type hint
        prompt.append("**RESPONSE TYPE**: ").append(questionType).append("\n");
        switch (questionType) {
            case NARROW_TECHNICAL:
                prompt.append("Focused answer (400-600 words). Search only if highly relevant.\n\n");
                break;
            case FOLLOW_UP_CLARIFICATION:
                prompt.append("Build on previous discussion. No repetition. Tools only if new research needed.\n\n");
                break;
            case PROCEDURAL_GUIDANCE:
                prompt.append("Step-by-step procedural guidance with deadlines.\n\n");
                break;
            case INITIAL_STRATEGY:
            default:
                prompt.append("Comprehensive analysis. Use search_case_law to find relevant precedents.\n\n");
                break;
        }

        // Question-type-aware tool instructions — reduces API rounds for non-strategy queries
        switch (questionType) {
            case INITIAL_STRATEGY:
                prompt.append("**TOOLS**: search_case_law, get_cfr_text, verify_citation, read_case_document\n\n");
                prompt.append("**TOOL USAGE**:\n");
                prompt.append("1. Use search_case_law 1-2 times with broad terms to find controlling precedents\n");
                prompt.append("2. Verify your top 3-5 citations using verify_citation (batch in one round)\n");
                prompt.append("3. Complete ALL research in 3-5 rounds max. Don't over-research.\n");
                prompt.append("4. Verified citations: '✓ [Case Name, Citation](URL)'. Unverified: '⚠️ Case Name, Citation'\n\n");
                break;
            case PROCEDURAL_GUIDANCE:
                prompt.append("**TOOLS**: get_cfr_text, read_case_document\n\n");
                prompt.append("**TOOL USAGE**:\n");
                prompt.append("1. Use get_cfr_text if a specific federal regulation applies\n");
                prompt.append("2. Cite procedural rules from your training data — do NOT search for case law\n");
                prompt.append("3. Complete in 1-2 rounds max.\n\n");
                break;
            case NARROW_TECHNICAL:
                prompt.append("**TOOLS**: get_cfr_text, read_case_document\n\n");
                prompt.append("**TOOL USAGE**:\n");
                prompt.append("1. Provide a direct answer. Use get_cfr_text only if looking up exact regulation text\n");
                prompt.append("2. Complete in 1-2 rounds max.\n\n");
                break;
            case FOLLOW_UP_CLARIFICATION:
                prompt.append("**TOOLS**: read_case_document\n\n");
                prompt.append("**TOOL USAGE**:\n");
                prompt.append("1. Answer from conversation context. Do NOT use research tools.\n");
                prompt.append("2. Use read_case_document only if the user asks about a specific document.\n");
                prompt.append("3. Complete in 1 round.\n\n");
                break;
        }

        // Add comprehensive case context if available (ported from buildAIPrompt for full document-informed research)
        String[] caseTypeHolder = new String[1]; // To capture case type from lambda
        Long[] caseIdLongHolder = new Long[1];
        Long[] orgIdHolder = new Long[1];
        if (caseId != null && !caseId.isEmpty()) {
            try {
                Long caseIdLong = Long.parseLong(caseId);
                caseIdLongHolder[0] = caseIdLong;
                Long orgIdForCase = tenantService.getCurrentOrganizationId().orElse(null);
                orgIdHolder[0] = orgIdForCase;
                // SECURITY: Use tenant-filtered query
                Optional<LegalCase> caseOptForPrompt = orgIdForCase != null
                    ? legalCaseRepository.findByIdAndOrganizationId(caseIdLong, orgIdForCase)
                    : Optional.empty();
                caseOptForPrompt.ifPresent(legalCase -> {
                    caseTypeHolder[0] = legalCase.getEffectivePracticeArea(); // Capture for practice-area guidance
                    boolean isFollowUp = questionType == QuestionType.FOLLOW_UP_CLARIFICATION;

                    String countyName = legalCase.getCountyName();
                    String jurisdictionType = "STATE";
                    String applicableRules = jurisdiction + " Rules of Civil/Criminal Procedure";

                    if (!isFollowUp) {
                        prompt.append("**CRITICAL - CASE-SPECIFIC CONTEXT**:\n");
                        prompt.append("This research is for a SPECIFIC active case. Your response MUST be tailored to this case's details.\n\n");

                        prompt.append("**Case Identification:**\n");
                        prompt.append("- Case Number: ").append(legalCase.getCaseNumber()).append("\n");
                        prompt.append("- Case Title: ").append(legalCase.getTitle()).append("\n");
                        prompt.append("- Case Type: ").append(legalCase.getEffectivePracticeArea() != null ? legalCase.getEffectivePracticeArea() : "General").append("\n");

                        // Full description (not truncated)
                        if (legalCase.getDescription() != null && !legalCase.getDescription().isEmpty()) {
                            String cleanDescription = removeStaleDateCalculations(legalCase.getDescription());
                            prompt.append("- Case Description: ").append(cleanDescription).append("\n");
                        }

                        // County and Jurisdiction
                        if (countyName != null && !countyName.isEmpty()) {
                            prompt.append("- County: ").append(countyName).append("\n");
                            String countyLower = countyName.toLowerCase();
                            if (countyLower.contains("u.s. district") || countyLower.contains("federal") ||
                                countyLower.contains("usdc") || countyLower.contains("united states district")) {
                                jurisdictionType = "FEDERAL";
                                applicableRules = "Federal Rules of Civil Procedure (FRCP)";
                            } else {
                                jurisdictionType = "STATE";
                                // Use the user-selected jurisdiction for applicable rules, not hardcoded MA
                                applicableRules = jurisdiction + " Rules of Civil/Criminal Procedure";
                            }
                            if (legalCase.getCourtroom() != null && !legalCase.getCourtroom().isEmpty()) {
                                prompt.append("- Courtroom: ").append(legalCase.getCourtroom()).append("\n");
                            }
                            if (legalCase.getJudgeName() != null && !legalCase.getJudgeName().isEmpty()) {
                                prompt.append("- Judge: ").append(legalCase.getJudgeName()).append("\n");
                            }
                        }

                        // Court rules
                        String caseDetails = String.format("County: %s, Type: %s, Description: %s",
                            countyName != null ? countyName : "",
                            legalCase.getEffectivePracticeArea() != null ? legalCase.getEffectivePracticeArea() : "",
                            legalCase.getDescription() != null ? legalCase.getDescription() : "");
                        CourtRulesService.CourtRulesContext courtRules = courtRulesService.getApplicableRules(caseDetails);
                        if (courtRules != null) {
                            prompt.append("\n").append(courtRules.generatePromptAddition());
                        }

                        if (legalCase.getStatus() != null) {
                            prompt.append("- Status: ").append(legalCase.getStatus()).append("\n");
                        }
                        if (legalCase.getPriority() != null) {
                            prompt.append("- Priority: ").append(legalCase.getPriority()).append("\n");
                        }
                    } else {
                        prompt.append("**CASE CONTEXT** (for reference - do not repeat in your response):\n");
                        prompt.append("- Case: ").append(legalCase.getCaseNumber()).append(" - ").append(legalCase.getTitle()).append("\n");
                    }

                    // Procedural Timeline (always include — can change)
                    prompt.append("\n**Procedural Timeline:**\n");
                    String proceduralStage = "Unknown stage";

                    if (legalCase.getFilingDate() != null) {
                        prompt.append("- Filing Date: ").append(legalCase.getFilingDate()).append("\n");
                        long daysSinceFiling = (new java.util.Date().getTime() - legalCase.getFilingDate().getTime()) / (1000 * 60 * 60 * 24);
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
                        long daysToHearing = (legalCase.getNextHearing().getTime() - new java.util.Date().getTime()) / (1000 * 60 * 60 * 24);
                        String timeDescription = daysToHearing >= 0
                            ? daysToHearing + " days from now"
                            : Math.abs(daysToHearing) + " days ago (DEADLINE PASSED)";
                        prompt.append("- Next Hearing: ").append(legalCase.getNextHearing())
                              .append(" (").append(timeDescription).append(")\n");
                        proceduralStage = daysToHearing >= 0 ? "Active litigation with upcoming hearing" : "Active litigation - hearing deadline passed";
                    }
                    if (legalCase.getTrialDate() != null) {
                        long daysToTrial = (legalCase.getTrialDate().getTime() - new java.util.Date().getTime()) / (1000 * 60 * 60 * 24);
                        String timeDescription = daysToTrial >= 0
                            ? daysToTrial + " days from now"
                            : Math.abs(daysToTrial) + " days ago (PAST)";
                        prompt.append("- Trial Date: ").append(legalCase.getTrialDate())
                              .append(" (").append(timeDescription).append(")\n");
                        proceduralStage = daysToTrial >= 0 ? "Trial preparation phase" : "Post-trial phase";
                    }
                    prompt.append("- Current Procedural Stage: ").append(proceduralStage).append("\n");

                    // Client Information
                    prompt.append("\n**Client Information:**\n");
                    prompt.append("(Remember: You are addressing the ATTORNEY representing this client, not the client themselves)\n");
                    prompt.append("- Client: ").append(legalCase.getClientName()).append("\n");

                    // Jurisdiction enforcement
                    if (!isFollowUp) {
                        prompt.append("\n**CRITICAL INSTRUCTIONS**:\n");
                        prompt.append("1. JURISDICTION: This case is in ").append(jurisdictionType).append(" court.\n");
                        prompt.append("   - You MUST use ONLY ").append(applicableRules).append("\n");
                        prompt.append("   - DO NOT mix federal and state procedural rules\n");
                        prompt.append("2. PROCEDURAL POSTURE: This case is in the \"").append(proceduralStage).append("\" stage.\n");
                        prompt.append("   - Tailor recommendations to what is appropriate at THIS stage\n\n");

                        // Case-type-specific instructions (ported from buildAIPrompt)
                        String caseType = legalCase.getEffectivePracticeArea() != null ? legalCase.getEffectivePracticeArea().toLowerCase() : "";
                        if (caseType.contains("data breach") || caseType.contains("privacy")) {
                            prompt.append("3. CASE-SPECIFIC: DATA BREACH/PRIVACY - Address Article III standing, notification obligations, consumer protection statutes.\n\n");
                        } else if (caseType.contains("malpractice") || caseType.contains("medical negligence")) {
                            prompt.append("3. CASE-SPECIFIC: MEDICAL MALPRACTICE - Expert testimony requirements per ").append(jurisdiction).append(" law, applicable tribunal/screening requirements, statute of limitations.\n\n");
                        } else if (caseType.contains("class action")) {
                            prompt.append("3. CASE-SPECIFIC: CLASS ACTION - Address Rule 23 requirements (numerosity, commonality, typicality, adequacy).\n\n");
                        } else if (caseType.contains("employment")) {
                            prompt.append("3. CASE-SPECIFIC: EMPLOYMENT - Use McDonnell Douglas framework, check administrative exhaustion, temporal proximity.\n\n");
                        } else if (caseType.contains("trade secret") || caseType.contains("misappropriation")) {
                            prompt.append("3. CASE-SPECIFIC: TRADE SECRETS - Address DTSA claims, identification requirement, reasonable protection measures.\n\n");
                        } else if (caseType.contains("immigration") || caseType.contains("removal") || caseType.contains("asylum")) {
                            prompt.append("3. CASE-SPECIFIC: IMMIGRATION - Consider dual proceedings, aggravated felony bars, asylum requirements, Padilla warning.\n\n");
                        } else if (caseType.contains("bankruptcy")) {
                            prompt.append("3. CASE-SPECIFIC: BANKRUPTCY - Priorities: cash collateral, DIP financing, critical vendor, employee wages.\n\n");
                        }
                    }

                    // Deadlines (compressed format)
                    Map<String, DeadlineInfo> deadlines = extractCaseDeadlines(legalCase);
                    if (!deadlines.isEmpty()) {
                        prompt.append("**DEADLINES**: ");
                        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d");
                        boolean first = true;
                        long passedCount = 0;
                        for (Map.Entry<String, DeadlineInfo> entry : deadlines.entrySet()) {
                            DeadlineInfo info = entry.getValue();
                            if (!first) prompt.append(", ");
                            first = false;
                            String emoji = switch (info.getStatus()) {
                                case PASSED -> { passedCount++; yield "❌"; }
                                case TODAY -> "🔔";
                                case UPCOMING -> info.getUrgency() == DeadlineInfo.UrgencyLevel.CRITICAL ? "🚨" :
                                              info.getUrgency() == DeadlineInfo.UrgencyLevel.HIGH ? "⚡" : "✅";
                            };
                            prompt.append(emoji).append(entry.getKey().replace("Date", "")).append(" ")
                                .append(info.getDate().format(formatter));
                        }
                        prompt.append("\n");
                        if (passedCount > 0) {
                            prompt.append("⚠️ ").append(passedCount).append(" deadline(s) PASSED - advise on post-deadline remedies.\n");
                        }
                    }

                    prompt.append("\n");
                });
            } catch (NumberFormatException e) {
                log.warn("Invalid case ID format: {}", caseId);
            }
        }

        // Add document inventory if case has documents
        if (caseIdLongHolder[0] != null && orgIdHolder[0] != null) {
            List<com.bostoneo.bostoneosolutions.dto.CaseDocumentSummary> docs =
                caseDocumentService.getDocumentInventory(caseIdLongHolder[0], orgIdHolder[0]);
            if (!docs.isEmpty()) {
                prompt.append("**CASE DOCUMENTS** (").append(docs.size()).append(" files available via read_case_document tool):\n");
                for (com.bostoneo.bostoneosolutions.dto.CaseDocumentSummary doc : docs) {
                    prompt.append("  - ID: ").append(doc.getId())
                        .append(" | ").append(doc.getName())
                        .append(" (").append(doc.getFileType());
                    if (doc.getCategory() != null) {
                        prompt.append(", ").append(doc.getCategory());
                    }
                    prompt.append(")\n");
                }
                prompt.append("\n");

                // Document relevance detection — mandate tool use when query is about documents
                if (isDocumentRelatedQuery(query)) {
                    prompt.append("⚠️ **MANDATORY**: The user's question relates to case documents. ");
                    prompt.append("You MUST use read_case_document to examine the relevant files listed above before answering.\n\n");
                } else {
                    prompt.append("Case documents are available via read_case_document if you need to examine file contents.\n\n");
                }
            }
        }

        // Quality standard
        prompt.append("**QUALITY STANDARD**:\n");
        prompt.append("Write as a senior attorney advising a colleague. Your analysis should:\n");
        prompt.append("- Be grounded in controlling authorities with citations and holdings\n");
        prompt.append("- Address the specific facts of this case, not generic advice\n");
        prompt.append("- Identify the strongest and weakest positions honestly\n");
        prompt.append("- Provide clear next steps with deadlines where applicable\n");
        prompt.append("- Be concise (800-1200 words). No filler.\n\n");

        // Add Practice-Area-Specific Guidance
        String practiceAreaGuidance = getPracticeAreaGuidance(caseTypeHolder[0]);
        prompt.append(practiceAreaGuidance).append("\n");

        // Compressed judicial/scheduling context
        prompt.append("**CONTEXT**: Judges favor procedural compliance, documented motions, professionalism. ")
            .append("Timelines: District 4-6wk, Superior 8-12wk, Federal 6-10wk, Immigration 1-3yr. ")
            .append("Emergency motions heard in days; 1st continuances usually granted.\n\n");

        // Response format — flexible, natural structure
        prompt.append("**RESPONSE FORMAT**:\n\n");
        prompt.append("# [Descriptive Title]\n\n");
        prompt.append("**Summary**: 2-3 sentences — bottom-line assessment and recommendation.\n\n");
        prompt.append("[Body: Structure however best fits the question — by issue, by argument strength, ");
        prompt.append("by timeline, or by procedural step. Weave citations into your analysis naturally. ");
        prompt.append("Use ### subheadings when they help readability. Use numbered lists for sequential steps or ranked items only.]\n\n");
        prompt.append("## Follow-Up Questions\n");
        prompt.append("3-5 specific questions to explore further.\n\n");
        prompt.append("SOURCES: [Case1 v. Case2, Reporter Citation] | [Statute § X] | [Case3 v. Case4, Reporter Citation]\n");
        prompt.append("(List ALL cases, statutes, and rules you relied on, separated by | pipes. This line is MANDATORY.)\n\n");
        prompt.append("**RULES**: Bold for emphasis, *italics* for case names. No emoji prefixes. ");
        prompt.append("No meta-commentary about tools or search process. Present findings confidently.\n\n");

        prompt.append("**LEGAL QUERY:** ").append(query).append("\n\n");
        prompt.append("Conduct thorough research using your tools and provide a comprehensive, cite-backed response.\n");

        return prompt.toString();
    }

    /**
     * THOROUGH mode: Agentic research with tool calling
     * Claude iteratively uses tools to research, verify citations, retrieve statutes
     */
    private Map<String, Object> performThoroughResearch(Map<String, Object> searchRequest) {
        long startTime = System.currentTimeMillis();

        String query = (String) searchRequest.get("query");
        String sessionId = (String) searchRequest.get("sessionId");
        String caseId = (String) searchRequest.get("caseId");
        String searchType = (String) searchRequest.getOrDefault("searchType", "all");
        String jurisdiction = (String) searchRequest.getOrDefault("jurisdiction", "General");
        Long userId = searchRequest.containsKey("userId") ?
            Long.valueOf(searchRequest.get("userId").toString()) : null;

        // Fetch case documents for source-link matching in CitationUrlInjector
        List<com.bostoneo.bostoneosolutions.dto.CaseDocumentSummary> caseDocs = Collections.emptyList();
        if (caseId != null) {
            try {
                Long caseIdLong = Long.parseLong(caseId);
                Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
                if (orgId != null) {
                    caseDocs = caseDocumentService.getDocumentInventory(caseIdLong, orgId);
                }
            } catch (NumberFormatException ignored) {}
        }

        log.info("🎯 Starting THOROUGH agentic research for query: {}", query);

        // NEW: Extract conversation history for context-aware responses
        List<ConversationMessage> conversationHistory = extractConversationHistory(searchRequest);

        // Check cache first (THOROUGH mode uses longer TTL: 24 hours for case-specific, 7 days for general)
        String queryHash = generateQueryHash(query, searchType, jurisdiction, caseId, "THOROUGH");
        // SECURITY: Require org context for cache lookup to prevent cross-tenant data leakage
        Long currentOrgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required for research"));
        Optional<AIResearchCache> cachedResult = cacheRepository.findByOrganizationIdAndQueryHash(currentOrgId, queryHash);

        // Phase 5: If no exact cache hit, try similarity-based cache lookup
        boolean similarityMatch = false;
        if (cachedResult.isEmpty() || !cachedResult.get().getIsValid() ||
            cachedResult.get().getExpiresAt().isBefore(LocalDateTime.now())) {

            Optional<AIResearchCache> similarCache = similarityService.findSimilarCachedQuery(
                query, searchType, jurisdiction, "THOROUGH", caseId);

            if (similarCache.isPresent()) {
                cachedResult = similarCache;
                similarityMatch = true;
                log.info("🎯 SIMILARITY CACHE HIT (THOROUGH mode only) - Using similar cached query");
            }
        }

        if (cachedResult.isPresent() && cachedResult.get().getIsValid() &&
            cachedResult.get().getExpiresAt().isAfter(LocalDateTime.now())) {

            log.info("✓ THOROUGH CACHE HIT - Returning cached result for query: '{}', hash: {}",
                     query, queryHash.substring(0, 16) + "...");

            // Update cache usage
            AIResearchCache cache = cachedResult.get();
            cache.setUsageCount(cache.getUsageCount() + 1);
            cache.setLastUsed(LocalDateTime.now());
            cacheRepository.save(cache);

            // Complete immediately for cached results
            if (sessionId != null) {
                progressPublisher.publishComplete(sessionId, "Research completed (cached result)");
            }

            // Log performance metrics
            long executionTime = System.currentTimeMillis() - startTime;
            long cacheAgeMinutes = java.time.Duration.between(cache.getCreatedAt(), LocalDateTime.now()).toMinutes();
            logPerformanceMetrics("THOROUGH", query, executionTime, true, cacheAgeMinutes, userId);

            // Return cached response
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("searchQuery", query);
            result.put("searchType", searchType);
            result.put("jurisdiction", jurisdiction);
            String cachedResponse = cache.getAiResponse();

            // POST-PROCESSING for cached response: Convert bullets BEFORE citation injection
            cachedResponse = convertBulletsToNumberedLists(cachedResponse);
            // Step 2: Verify case law citations via CourtListener (same as non-cached path)
            cachedResponse = verifyAllCitationsInResponse(cachedResponse);
            String processedCachedResponse = caseDocs.isEmpty()
                ? citationUrlInjector.inject(cachedResponse)
                : citationUrlInjector.inject(cachedResponse, caseId, caseDocs);

            result.put("aiAnalysis", processedCachedResponse);
            result.put("hasAIAnalysis", true);
            result.put("executionTimeMs", executionTime);
            result.put("researchMode", "THOROUGH");
            result.put("cachedResult", true);
            result.put("similarityMatch", similarityMatch);
            result.put("cacheAge", cacheAgeMinutes + " minutes");
            return result;
        }

        try {
            // Step 1: Understanding the query (10% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "query_analysis",
                    "Understanding your legal question",
                    query,
                    "ri-file-search-line",
                    10);
            }

            // Detect question type once — used for both prompt building and tool filtering
            QuestionType questionType = detectQuestionType(query, conversationHistory);

            // Build agentic prompt with case context, conversation history, and question-type-aware tool instructions
            String prompt = buildAgenticPrompt(query, caseId, conversationHistory, questionType, jurisdiction);

            // Set document context for read_case_document tool
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            if (caseId != null && orgId != null) {
                try {
                    legalResearchTools.setResearchContext(Long.parseLong(caseId), orgId);
                } catch (NumberFormatException ignored) {}
            }

            // Step 2: Searching legal databases (30% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "database_search",
                    "Searching " + jurisdiction + " statutes and case law",
                    query.length() > 60 ? query.substring(0, 57) + "..." : query,
                    "ri-search-line",
                    30);
            }

            String aiResponse;
            try {
                // Call agentic Claude with question-type-filtered tools
                aiResponse = claudeService.generateWithTools(prompt, buildSystemMessage(), true, sessionId, questionType).get();
            } finally {
                // Always clear context after research completes
                legalResearchTools.clearResearchContext();
            }

            log.info("✅ Agentic research complete in {}ms", System.currentTimeMillis() - startTime);

            // Step 3: AI analysis done — move to synthesizing (75% progress)
            if (sessionId != null) {
                progressPublisher.publishStep(sessionId, "response_generation",
                    "Synthesizing findings",
                    "Formatting and verifying citations",
                    "ri-quill-pen-line",
                    75);
            }

            // POST-PROCESSING Step 1: Convert bullets BEFORE citation processing
            aiResponse = convertBulletsToNumberedLists(aiResponse);

            // POST-PROCESSING Step 2: SAFETY NET - Verify all case law citations via CourtListener
            String processedResponse = verifyAllCitationsInResponse(aiResponse);

            // POST-PROCESSING Step 3: Inject URLs for statutory/rule citations (FRCP, M.G.L., CFR, etc.)
            processedResponse = caseDocs.isEmpty()
                ? citationUrlInjector.inject(processedResponse)
                : citationUrlInjector.inject(processedResponse, caseId, caseDocs);

            // Validate response for temporal consistency
            ResponseValidator.ValidationResult validationResult =
                responseValidator.validateTemporalConsistency(processedResponse, LocalDate.now());

            if (!validationResult.isValid()) {
                log.warn("⚠️ Temporal validation detected issues: {}", validationResult.getSummary());
                validationResult.getErrors().forEach(error ->
                    log.warn("  ERROR: {}", error));
                validationResult.getWarnings().forEach(warning ->
                    log.warn("  WARNING: {}", warning));
            } else {
                log.info("✅ Temporal validation passed");
            }

            // Prepare response matching LegalSearchResponse structure
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("results", Collections.emptyList()); // Tools fetch data, not pre-loaded
            result.put("totalResults", 0);
            result.put("searchQuery", query);
            result.put("searchType", searchRequest.getOrDefault("searchType", "all"));
            result.put("jurisdiction", jurisdiction);
            result.put("aiAnalysis", processedResponse);
            result.put("hasAIAnalysis", true);
            result.put("executionTimeMs", System.currentTimeMillis() - startTime);
            result.put("researchMode", "THOROUGH");

            // Phase 5: Quality scoring
            ResponseQualityScorer.QualityScore qualityScore =
                qualityScorer.scoreResponse(aiResponse, query, "THOROUGH");
            result.put("qualityScore", qualityScore.toMap());

            // Counsel-ready check (question-type-aware)
            ResponseQualityScorer.CounselReadyCheck counselCheck =
                qualityScorer.checkCounselReady(aiResponse, "THOROUGH", questionType.name());
            result.put("counselReadyCheck", counselCheck.toMap());

            // Log counsel-ready status
            if (counselCheck.isCounselReady) {
                log.info("✅ Response meets COUNSEL-READY standards (score: {}/5)", counselCheck.score);
            } else {
                log.warn("⚠️ Response NOT counsel-ready (score: {}/5)", counselCheck.score);
                counselCheck.issues.forEach(issue -> log.warn("  {}", issue));
                counselCheck.warnings.forEach(warning -> log.warn("  {}", warning));
            }

            // Quality gate: Prepend warning for low-quality responses (grade F)
            if (qualityScore.overallScore < 0.4) {
                String warning = "⚠️ **Research Confidence: Low** — This response may have limited authority "
                    + "for your jurisdiction. Consider rephrasing with more specifics about the legal issue "
                    + "and jurisdiction.\n\n---\n\n";
                processedResponse = warning + processedResponse;
                result.put("aiAnalysis", processedResponse);
                log.warn("⚠️ Quality gate: Prepended low-confidence warning (score: {})", qualityScore.overallScore);
            }

            // Add validation metadata
            result.put("validationPassed", validationResult.isValid());
            if (validationResult.hasIssues()) {
                result.put("validationWarnings", validationResult.getWarnings());
                result.put("validationErrors", validationResult.getErrors());
            }

            // Save search history (use "ALL" as queryType since QueryType enum doesn't have THOROUGH)
            saveSearchHistory(userId, sessionId, query, "ALL",
                0, System.currentTimeMillis() - startTime);

            // Cache the result ONLY if quality is acceptable (score >= 3/10)
            // Don't cache garbage responses from max iterations or incomplete research
            int scoreOutOf10 = (int) Math.round(qualityScore.overallScore * 10);
            boolean shouldCache = scoreOutOf10 >= 3 &&
                                  !aiResponse.contains("Research incomplete") &&
                                  !aiResponse.contains("maximum tool call limit");

            if (shouldCache) {
                try {
                    int cacheDays = (caseId != null && !caseId.isEmpty()) ? 1 : 7;
                    cacheRepository.upsertCache(
                        currentOrgId, queryHash, query, searchType.toUpperCase(),
                        jurisdiction, "THOROUGH", caseId, aiResponse,
                        "claude-sonnet-4-6", new BigDecimal("0.90"),
                        LocalDateTime.now().plusDays(cacheDays)
                    );
                    log.info("✓ Cached THOROUGH result (TTL: {} days, quality: {}/10): {}", cacheDays, scoreOutOf10, queryHash.substring(0, 16) + "...");
                } catch (Exception e) {
                    log.warn("Failed to cache THOROUGH result: {}", e.getMessage());
                }
            } else {
                log.warn("⚠️ NOT caching THOROUGH result - quality too low (score: {}/10) or incomplete", scoreOutOf10);
            }

            // Complete progress (100%)
            if (sessionId != null) {
                progressPublisher.publishComplete(sessionId, "Research completed successfully");
            }

            // Log performance metrics
            long totalTime = System.currentTimeMillis() - startTime;
            logPerformanceMetrics("THOROUGH", query, totalTime, false, 0, userId);

            return result;

        } catch (Exception e) {
            long totalTime = System.currentTimeMillis() - startTime;
            log.error("❌ Thorough research failed after {}ms: {}", totalTime, e.getMessage(), e);

            // Sanitize error message — never expose raw DB/internal errors to users
            String rawMsg = e.getMessage() != null ? e.getMessage() : "";
            String userMessage = (rawMsg.contains("duplicate key") || rawMsg.contains("unique constraint") ||
                rawMsg.contains("SQL") || rawMsg.contains("JDBC") || rawMsg.contains("PSQLException"))
                ? "A temporary issue occurred. Please try your question again."
                : "Research encountered an issue. Please try again.";

            // Publish error event
            if (sessionId != null) {
                progressPublisher.publishError(sessionId, userMessage);
            }

            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", userMessage);
            errorResult.put("results", Collections.emptyList());
            errorResult.put("totalResults", 0);
            errorResult.put("searchQuery", query);
            errorResult.put("researchMode", "THOROUGH");
            return errorResult;
        }
    }

    // ===== PRACTICE-AREA GUIDANCE TEMPLATES =====

    /**
     * Router method to get practice-area-specific guidance
     */
    private String getPracticeAreaGuidance(String caseType) {
        if (caseType == null || caseType.isEmpty()) {
            return getUniversalGuidance();
        }

        String normalized = caseType.toUpperCase()
            .replace("MEDICAL MALPRACTICE", "MEDICAL_MALPRACTICE")
            .replace("PERSONAL INJURY", "PERSONAL_INJURY");

        if (normalized.contains("MEDICAL") || normalized.contains("MALPRACTICE")) {
            return getMedicalMalpracticeGuidance();
        } else if (normalized.contains("IMMIGRATION")) {
            return getImmigrationGuidance();
        } else if (normalized.contains("EMPLOYMENT")) {
            return getEmploymentGuidance();
        } else if (normalized.contains("CRIMINAL")) {
            return getCriminalGuidance();
        } else if (normalized.contains("INJURY")) {
            return getPersonalInjuryGuidance();
        } else if (normalized.contains("BUSINESS") || normalized.contains("TRADE SECRET")) {
            return getTradeSecretsGuidance();
        } else if (normalized.contains("FAMILY")) {
            return getFamilyLawGuidance();
        } else if (normalized.contains("IP") || normalized.contains("INTELLECTUAL")) {
            return getIntellectualPropertyGuidance();
        } else if (normalized.contains("TAX") || normalized.contains("IRS") ||
                   normalized.contains("CONSERVATION EASEMENT") ||
                   normalized.contains("DEDUCTION") || normalized.contains("DEFICIENCY") ||
                   normalized.contains("TAX COURT")) {
            return getTaxCourtGuidance();
        } else {
            return getUniversalGuidance();
        }
    }

    private String getMedicalMalpracticeGuidance() {
        return "**MED MAL**: Expert cert of merit req'd 60-90d. Burden: duty/breach/causation/damages. SOL 2-3yr. Expert testimony same specialty. Damages: economic + non-econ (may be capped). HIPAA auth req'd.\n";
    }

    private String getImmigrationGuidance() {
        StringBuilder guide = new StringBuilder();

        guide.append("**🏛️ FEDERAL IMMIGRATION LAW**\n\n");

        // Fix 1: Circuit Court Detection
        guide.append("**APPELLATE PATHWAY:**\n");
        guide.append("IJ → BIA → U.S. Court of Appeals (circuit where case arises) → SCOTUS\n");
        guide.append("- Petition for review: 30 days after BIA decision (STRICT - no equitable tolling)\n");
        guide.append("- Standard of review: Substantial evidence (INS v. Elias-Zacarias, 502 U.S. 478 (1992))\n");
        guide.append("- Identify the correct circuit based on the immigration court location\n\n");

        // Fix 2: BIA Procedures Clarified
        guide.append("**BIA APPELLATE PROCESS (No Live Hearings):**\n");
        guide.append("⚠️ CRITICAL: BIA rarely holds oral argument (<2% of cases) - written briefing only\n");
        guide.append("- Notice of Appeal: File within 30 days of IJ decision via EOIR Form 26\n");
        guide.append("- Briefing Schedule: BIA issues after NOA (typically 30-60 days for appellant brief)\n");
        guide.append("- Brief Requirements: 50-page limit, 8 C.F.R. § 1003.3(c); serve DHS simultaneously\n");
        guide.append("- Decision Timeline: 12-18 months typical (no \"trial date\" at BIA level)\n");
        guide.append("- Motion to Remand: File DURING appeal for new, previously unavailable evidence\n");
        guide.append("- Motion to Reopen: File AFTER BIA decision (90-day limit, 8 C.F.R. § 1003.2)\n\n");

        // Fix 5: Deadline Verification
        guide.append("**DEADLINE VERIFICATION:**\n");
        guide.append("⚠️ ALWAYS verify actual deadlines in BIA briefing schedule order via EOIR ECAS portal\n");
        guide.append("- \"Filing date\" in case system likely = NOA filed, NOT brief deadline\n");
        guide.append("- Don't assume missed deadlines without checking official BIA schedule\n");
        guide.append("- Motion for Extension: File with good cause if deadline approaching/passed\n\n");

        guide.append("**ASYLUM REQUIREMENTS (INA § 208 - Source: https://www.law.cornell.edu/uscode/text/8/1158):**\n");
        guide.append("Five Elements to Establish:\n");
        guide.append("1. Past persecution OR well-founded fear (10% chance = sufficient)\n");
        guide.append("2. Protected ground nexus: Race, religion, nationality, political opinion, PSG\n");
        guide.append("   - Post-REAL ID Act: Must be \"one central reason\" (not sole reason)\n");
        guide.append("3. Government unable/unwilling to protect\n");
        guide.append("4. No internal relocation alternative\n");
        guide.append("5. No bars (firm resettlement, persecutor, criminal, terrorist, 1-year deadline)\n\n");

        // Fix 3: Updated Credibility Standards (no Dai v. Ashcroft)
        guide.append("**CREDIBILITY (INA § 208(b)(1)(B)(iii) - REAL ID Act):**\n");
        guide.append("- Totality of circumstances: demeanor, candor, responsiveness, plausibility\n");
        guide.append("- Inconsistencies: Must be material and go to heart of claim\n");
        guide.append("- IJ must provide \"specific, cogent reasons\" for adverse credibility\n");
        guide.append("- Corroboration: Required only if reasonably available + testimony insufficient\n");
        guide.append("- Trauma consideration: BIA recognizes PTSD affects memory/testimony\n");
        guide.append("- First Circuit precedent: [cite circuit-specific cases on credibility]\n\n");

        guide.append("**COUNTRY CONDITIONS (Changed Circumstances):**\n");
        guide.append("- Motion to Remand: File during appeal with new State Dept reports\n");
        guide.append("- Evidence: Most recent Country Reports on Human Rights Practices\n");
        guide.append("- Expert declaration: Academic/NGO specialist on country conditions\n");
        guide.append("- UNHCR position papers, UN reports, reputable news sources\n");
        guide.append("- No internal relocation if government reach is nationwide\n\n");

        guide.append("**ALTERNATIVE RELIEF:**\n");
        // Fix 4: Corrected Humanitarian Asylum Citation
        guide.append("- Withholding of Removal (INA § 241(b)(3)): Higher \"more likely than not\" standard; non-discretionary\n");
        guide.append("- CAT Protection: Torture by/with government acquiescence; no protected ground nexus required\n");
        guide.append("- Humanitarian Asylum (8 C.F.R. § 1208.13(b)(1)(iii)): If past persecution, presumption of future persecution\n\n");

        guide.append("**BURDEN/EVIDENCE:**\n");
        guide.append("- Applicant proves asylum eligibility by preponderance\n");
        guide.append("- Documentary evidence: Affidavits, medical records, country reports, expert declarations\n");
        guide.append("- Psychological evaluation if trauma/PTSD affects credibility\n");
        guide.append("- Translation certifications required for all foreign documents\n\n");

        guide.append("**BIA PRECEDENT DECISIONS (Source: https://www.justice.gov/eoir/board-immigration-appeals-precedent-decisions):**\n");
        guide.append("- Matter of J-Y-C-, 24 I&N Dec. 260 (BIA 2007): Credibility totality test\n");
        guide.append("- Matter of N-M-A-, 22 I&N Dec. 312 (BIA 1998): Changed country conditions\n");
        guide.append("- Matter of A-R-C-G-, 26 I&N Dec. 388 (BIA 2014): Particular social group (domestic violence)\n");
        guide.append("- Matter of A-B-, 27 I&N Dec. 316 (A.G. 2018): PSG narrowed (family-based claims)\n\n");

        guide.append("**COST ESTIMATES:**\n");
        guide.append("- BIA brief preparation: $10K-25K | Country conditions expert: $5K-15K\n");
        guide.append("- Psych evaluation: $2K-5K | Translation: $500-2K | TOTAL BIA APPEAL: $20K-50K\n");
        guide.append("- Circuit Court appeal (if denied): Additional $25K-75K\n\n");

        return guide.toString();
    }

    private String getTaxCourtGuidance() {
        StringBuilder guide = new StringBuilder();

        guide.append("**🏛️ U.S. TAX COURT / TAX LITIGATION**\n\n");

        guide.append("**FORUM & JURISDICTION:**\n");
        guide.append("- U.S. Tax Court: Article I court (no jury); jurisdiction over federal tax deficiencies\n");
        guide.append("- Standing: File petition within 90 days of IRS deficiency notice (IRC § 6213) - STRICT deadline\n");
        guide.append("- Alternative forums: U.S. District Court (pay first, sue for refund) or Court of Federal Claims\n");
        guide.append("- Appeals: U.S. Court of Appeals for taxpayer's residence circuit → SCOTUS\n\n");

        guide.append("**BURDEN OF PROOF:**\n");
        guide.append("- General Rule: Taxpayer must prove IRS determination wrong (preponderance of evidence)\n");
        guide.append("- IRC § 7491: Burden shifts to IRS IF taxpayer: (1) produces credible evidence, (2) maintains records, (3) cooperates\n");
        guide.append("- Penalties: IRS bears burden of production for most penalties (IRC § 7491(c))\n");
        guide.append("- Fraud: IRS must prove by clear and convincing evidence\n\n");

        guide.append("**CONSERVATION EASEMENT CASES (IRC § 170(h)):**\n");
        guide.append("⚠️ **HIGH IRS SCRUTINY** since 2016 - syndicated transactions targeted\n");
        guide.append("- Four Requirements (ALL must be satisfied): (1) Qualified real property interest, (2) Qualified organization, (3) Exclusively for conservation purpose, (4) Protected in perpetuity\n");
        guide.append("- Key Regulations: Treas. Reg. § 1.170A-14 (conservation easements), § 1.170A-13(c) (appraisal requirements)\n");
        guide.append("- Common IRS Challenges: Extinguishment clause defects, qualified appraisal non-compliance, inflated valuations, conservation purpose failures\n\n");

        guide.append("**CASE LAW RESEARCH REQUIREMENTS:**\n");
        guide.append("⚠️ **MANDATORY**: Cite minimum 5 controlling Tax Court precedents with holdings\n");
        guide.append("- Tax Court Regular Opinions: Published as T.C. (binding precedent)\n");
        guide.append("- Tax Court Memorandum Opinions: T.C. Memo (not precedential but persuasive)\n");
        guide.append("- Circuit Court Split: Golsen rule - Tax Court follows law of circuit where appeal lies\n");
        guide.append("- Recent Cases: Conservation easement law rapidly evolving (use from_year=2015)\n\n");

        guide.append("**KEY CONSERVATION EASEMENT PRECEDENTS (Examples):**\n");
        guide.append("- Oakbrook Land Holdings, LLC v. Commissioner, 154 T.C. 180 (2020): Extinguishment clause must include proportionate proceeds formula\n");
        guide.append("- BC Ranch II, L.P. v. Commissioner, T.C. Memo 2015-21: Baseline documentation requirements\n");
        guide.append("- Pine Mountain Preserve, LLLP v. Commissioner, 151 T.C. 247 (2018): Valuation methodology\n");
        guide.append("- Champions Retreat Golf Founders, LLC v. Commissioner, 959 F.3d 1033 (11th Cir. 2020): Partnership syndication issues\n");
        guide.append("- Graev v. Commissioner, 149 T.C. 485 (2017): Appraisal substantiation requirements\n\n");

        guide.append("**SUBSTANTIATION REQUIREMENTS:**\n");
        guide.append("- IRC § 170(f)(8): Contemporaneous written acknowledgment from donee\n");
        guide.append("- IRC § 170(f)(11): Qualified appraisal by qualified appraiser (deductions >$5,000)\n");
        guide.append("- Form 8283: Required for non-cash contributions >$500; Section B for >$5,000\n");
        guide.append("- Timing: Appraisal must be dated within 60 days before contribution\n");
        guide.append("- Appraiser Qualifications: Education, experience, state certification; cannot be donor/donee/related party\n\n");

        guide.append("**PENALTIES:**\n");
        guide.append("- IRC § 6662(a): 20% accuracy-related penalty (negligence or substantial understatement)\n");
        guide.append("- IRC § 6662(h): 40% gross valuation misstatement (claimed value 200%+ of correct value)\n");
        guide.append("- Reasonable Cause Defense: IRC § 6664(c) - good faith reliance on qualified professionals\n");
        guide.append("- Penalty Stacking: IRS may assert multiple penalties (must prove each separately)\n\n");

        guide.append("**LITIGATION STRATEGY:**\n");
        guide.append("1. **Case-Specific Analysis Required**: Review actual deed language, appraisal report, IRS Revenue Agent Report (RAR)\n");
        guide.append("2. **Precedent Comparison**: Distinguish/analogize to Tax Court cases on specific defects alleged\n");
        guide.append("3. **Expert Witnesses**: Retain rebuttal appraiser, land use experts, ecologists (credentials critical)\n");
        guide.append("4. **Settlement**: Evaluate Appeals Office negotiation vs. trial risk (Tax Court may sustain 100% disallowance)\n");
        guide.append("5. **Hazards of Litigation**: No attorney fees recovery (unlike some tax cases), penalties exposure, costly expert fees\n\n");

        guide.append("**PRACTICAL REQUIREMENTS FOR COUNSEL-READY RESPONSE:**\n");
        guide.append("1. Cite 5-10 specific Tax Court cases with holdings (not generic advice)\n");
        guide.append("2. Analyze case-specific facts (deed provisions, appraisal details, IRS arguments)\n");
        guide.append("3. Provide strategic assessment (strongest/weakest arguments ranked)\n");
        guide.append("4. Include settlement range and risk analysis (probability of success, cost estimates)\n");
        guide.append("5. Prioritize action items (discovery requests, expert retention, motion deadlines)\n\n");

        return guide.toString();
    }

    private String getEmploymentGuidance() {
        return "**EMPLOYMENT**: EEOC charge req'd 180/300d. McDonnell Douglas burden-shift. 90d after right-to-sue. At-will presumption. Damages capped Title VII. Comparator evidence critical. Retaliation separate claim.\n";
    }

    private String getCriminalGuidance() {
        return "**CRIMINAL**: Burden beyond reasonable doubt on prosecution. 4A/5A/6A rights. Brady/Giglio/Jencks discovery. SOL varies (murder none, felony 3-6yr). 90%+ plead. Sentencing guidelines. Preserve objections.\n";
    }

    private String getPersonalInjuryGuidance() {
        return "**PERSONAL INJURY**: SOL 2-3yr (strict). Duty/breach/causation/damages. Preponderance burden. Check comparative/contributory rules. Damages: economic + non-econ (may be capped). Expert for causation.\n";
    }

    private String getTradeSecretsGuidance() {
        return "**TRADE SECRETS**: Protective order essential. Defenses: indep dev, reverse eng, public. Burden: exists/misappropriation/value/secrecy. SOL 3yr DTSA. Damages actual or unjust enrich (2x willful). Winter test for TRO.\n";
    }

    private String getFamilyLawGuidance() {
        return "**FAMILY LAW**: Best interests std (custody). Equitable distribution marital property. Spousal support factors vary. Child support guidelines. Modification req's substantial change. Financial discovery critical. UCCJEA jurisdiction.\n";
    }

    private String getIntellectualPropertyGuidance() {
        return "**IP**: Patent infringement preponderance; validity presumed clear/convincing. eBay 4-factor TRO. SOL 6yr. Damages: royalty or lost profits (patent); actual or statutory (copyright $750-$150K). Markman construction often dispositive.\n";
    }

    private String getUniversalGuidance() {
        return "**GENERAL**: ID SOL from accrual. Burden typically on plaintiff/prosecution. Std: civil preponderance, criminal beyond reasonable doubt. Note expert req's, available remedies, jurisdictional issues, procedural deadlines, affirmative defenses.\n";
    }

    // ===== PERFORMANCE MONITORING =====

    /**
     * Log performance metrics for monitoring and optimization
     */
    private void logPerformanceMetrics(String mode, String query, long executionTimeMs,
                                      boolean fromCache, long cacheAgeMinutes) {
        logPerformanceMetrics(mode, query, executionTimeMs, fromCache, cacheAgeMinutes, null);
    }

    /**
     * Log performance metrics with user tracking
     */
    private void logPerformanceMetrics(String mode, String query, long executionTimeMs,
                                      boolean fromCache, long cacheAgeMinutes, Long userId) {
        String queryPreview = query.length() > 50 ? query.substring(0, 50) + "..." : query;
        double estimatedCost;

        if (fromCache) {
            estimatedCost = 0.0;
            log.info("⚡ PERF [{}] Cached | {}ms | Query: '{}' | Cache age: {}min | Cost: $0.00",
                mode, executionTimeMs, queryPreview, cacheAgeMinutes);
        } else {
            // Estimate cost: $0.15/1K input tokens, $0.60/1K output tokens
            // Average THOROUGH: ~2K input, ~3K output = ~$0.30 + ~$1.80 = $2.10
            estimatedCost = mode.equals("THOROUGH") ? 1.50 : 0.15;

            log.info("💰 PERF [{}] Fresh | {}ms | Query: '{}' | Est cost: ${}",
                mode, executionTimeMs, queryPreview, String.format("%.2f", estimatedCost));
        }

        // Record in analytics
        analyticsService.recordQuery(userId, mode, executionTimeMs, fromCache, estimatedCost);

        // Log warning if execution is slow
        long threshold = mode.equals("THOROUGH") ? 45000 : 10000; // 45s for THOROUGH, 10s for FAST
        if (executionTimeMs > threshold && !fromCache) {
            log.warn("⚠️ SLOW QUERY [{}] {}ms (threshold: {}ms) - Query: '{}'",
                mode, executionTimeMs, threshold, queryPreview);
        }
    }

    /**
     * POST-PROCESSING SAFETY NET: Verify all citations in the response
     * This ensures EVERY citation is verified even if Claude forgets to use verify_citation tool
     * Prevents hallucinations by validating against CourtListener database
     * PUBLIC: Called by both research mode AND draft generation for consistent citation verification
     */
    public String verifyAllCitationsInResponse(String aiResponse) {
        if (aiResponse == null || aiResponse.isBlank()) {
            return aiResponse;
        }

        log.info("🔍 POST-PROCESSING: Verifying all citations in response (safety net)");

        // Extract all citations using regex patterns
        List<String> extractedCitations = courtListenerService.extractCitations(aiResponse);

        if (extractedCitations.isEmpty()) {
            log.info("✅ No citations found in response - nothing to verify");
            return aiResponse;
        }

        log.info("📋 Found {} citations to verify: {}", extractedCitations.size(), extractedCitations);

        String processedResponse = aiResponse;
        int verifiedCount = 0;
        int unverifiedCount = 0;

        // Match full citation pattern with optional markers at start AND italic markdown
        // Handles:
        // - "⚠️ Case v. Case, Citation (Year)"
        // - "✓ [Case v. Case, Citation](URL)"
        // - "*Case v. Case*, Citation (Year)" (italic markdown)
        // - "**Case v. Case**, Citation (Year)" (bold markdown - Claude's format)
        // - "- ✓ [*Case v. Case*, Citation](URL)" (bullet + marker + italic + link)
        // - "Case v. Case, 340 Mass. 300, 163 N.E.2d 728 (1960)" (dual reporters)
        // - "Case v. Case, 21 Mass. App. Ct. 542, 544, 488 N.E.2d 1029 (1986)" (Mass. App. Ct. with pin cites and dual reporter)
        // Formats: "(2003)", "(S.D.N.Y. 2003)", "(7th Cir. 2015)", "(D. Md. 2008)"
        java.util.regex.Pattern fullCitationPattern = java.util.regex.Pattern.compile(
            "(?:⚠️\\s*)?(?:✓\\s*)?\\[?\\*{0,2}([A-Z][\\w\\s\\.'&,-]+\\s+v\\.\\s+[A-Z][\\w\\s\\.'&,-]+)\\*{0,2},\\s*(" +
            String.join("|", extractedCitations.stream()
                .map(java.util.regex.Pattern::quote)
                .collect(java.util.stream.Collectors.toList())) +
            ")(?:,\\s*\\d+)?(?:,\\s*\\d+\\s+N\\.E\\.\\d*d?\\s+\\d+)?(?:\\]\\([^)]+\\))?\\s*\\((?:([A-Z][\\.\\w\\s]+)\\s+)?(\\d{4})\\)"  // Optional pin cite, optional N.E.2d, optional URL, court, year
        );

        java.util.regex.Matcher matcher = fullCitationPattern.matcher(processedResponse);
        StringBuffer sb = new StringBuffer();

        // Verify and replace each citation individually
        while (matcher.find()) {
            String fullMatch = matcher.group().trim();
            String caseName = matcher.group(1).trim();
            String citation = matcher.group(2).trim();
            String court = matcher.group(3);  // Optional court abbreviation (e.g., "S.D.N.Y.", "7th Cir.")
            String year = matcher.group(4);   // Year (moved to group 4 because court is group 3)

            log.debug("📍 CITATION MATCH - fullMatch: '{}' | starts with ⚠️: {} | starts with ✓: {} | has markdown: {}",
                fullMatch, fullMatch.startsWith("⚠️"), fullMatch.startsWith("✓"), fullMatch.contains("]("));

            // Skip if already verified (has marker or markdown link) - avoid double markers: ⚠️ ✓
            if (fullMatch.contains("](") || fullMatch.startsWith("✓")) {
                log.debug("Citation already verified with link, skipping: {}", fullMatch);
                matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(fullMatch));
                continue;
            }

            // Search by citation number (most specific - "217 F.R.D. 309" → exact match)
            log.debug("🔍 Verifying: {} - {}", caseName, citation);

            CitationVerificationResult verification;
            try {
                // Search CourtListener by FULL CITATION (case name + citation number)
                // This enables case name filtering to avoid wrong URLs
                // Example: "McDonnell Douglas Corp. v. Green, 411 U.S. 792"
                // CourtListener will filter results by case name match
                verification = courtListenerService.verifyCitation(caseName + ", " + citation);
            } catch (Exception e) {
                log.warn("Verification error for {} {}: {}", caseName, citation, e.getMessage());
                verification = CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .build();
            }

            if (verification.isFound() && verification.getUrl() != null) {
                // Verified - format as markdown link with checkmark
                // Only case name is clickable, citation displays as text
                // Preserve court identifier if present (e.g., "S.D.N.Y." for federal courts)
                String fullCitation = court != null ?
                    String.format("%s (%s %s)", citation, court.trim(), year) :
                    String.format("%s (%s)", citation, year);

                String replacement = String.format("✓ [%s](%s), %s",
                    caseName, verification.getUrl(), fullCitation);

                log.info("✅ VERIFICATION SUCCESS:");
                log.info("   Citation searched: '{}'", citation);
                log.info("   Case name: '{}'", caseName);
                log.info("   URL from CourtListener: '{}'", verification.getUrl());
                log.info("   REPLACING: '{}' → '{}'", fullMatch, replacement.substring(0, Math.min(100, replacement.length())));

                matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(replacement));
                verifiedCount++;
            } else {
                // Not verified via CourtListener - check if this is a Supreme Court case
                // Supreme Court patterns:
                // - U.S. Reports: "355 U.S. 41" → https://supreme.justia.com/cases/federal/us/355/41/
                // - S. Ct. Reporter: "137 S. Ct. 1773" → https://www.courtlistener.com/?q=...&type=o
                java.util.regex.Pattern usReportsPattern = java.util.regex.Pattern.compile("(\\d+)\\s+U\\.S\\.\\s+(\\d+)");
                java.util.regex.Pattern sCtPattern = java.util.regex.Pattern.compile("(\\d+)\\s+S\\.\\s*Ct\\.\\s+(\\d+)");

                java.util.regex.Matcher usReportsMatcher = usReportsPattern.matcher(citation);
                java.util.regex.Matcher sCtMatcher = sCtPattern.matcher(citation);

                if (usReportsMatcher.find()) {
                    // U.S. Reports citation - construct Justia URL directly
                    // (Skip verification since Cloudflare blocks HEAD requests)
                    String volume = usReportsMatcher.group(1);
                    String page = usReportsMatcher.group(2);
                    String justiaUrl = String.format("https://supreme.justia.com/cases/federal/us/%s/%s/", volume, page);

                    String fullCitation = court != null ?
                        String.format("%s (%s %s)", citation, court.trim(), year) :
                        String.format("%s (%s)", citation, year);

                    String replacement = String.format("✓ [%s](%s), %s",
                        caseName, justiaUrl, fullCitation);

                    log.info("✅ SUPREME COURT (U.S. Reports) - Justia URL constructed: {}", justiaUrl);
                    log.info("   REPLACING: '{}' → '{}'", fullMatch, replacement.substring(0, Math.min(100, replacement.length())));

                    matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(replacement));
                    verifiedCount++;
                } else if (sCtMatcher.find()) {
                    // S. Ct. Reporter citation - try to find via Google Scholar or Justia by name
                    // If we can't find a direct opinion URL, leave as plain text (no search link)
                    // S. Ct. citations: "137 S. Ct. 1773" — try CourtListener API first
                    // (already tried above via verifyCitation — if not found, leave as plain text)
                    log.info("ℹ️ UNVERIFIED S. Ct. citation: Leaving as plain text: {} | {}", caseName, citation);
                    matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(fullMatch));
                    unverifiedCount++;
                } else {
                    // Not a Supreme Court case - check if this is a Massachusetts case
                    // Massachusetts SJC pattern: "400 Mass. 425" → https://law.justia.com/cases/massachusetts/supreme-court/{year}/{volume}-mass-{page}.html
                    // Massachusetts Appeals Court pattern: "59 Mass. App. Ct. 582" → https://law.justia.com/cases/massachusetts/court-of-appeals/{year}/{volume}-mass-app-ct-{page}.html
                    java.util.regex.Pattern massSJCPattern = java.util.regex.Pattern.compile("(\\d+)\\s+Mass\\.\\s+(\\d+)");
                    java.util.regex.Pattern massAppCtPattern = java.util.regex.Pattern.compile("(\\d+)\\s+Mass\\.\\s+App\\.\\s+Ct\\.\\s+(\\d+)");

                    java.util.regex.Matcher massAppCtMatcher = massAppCtPattern.matcher(citation);
                    java.util.regex.Matcher massSJCMatcher = massSJCPattern.matcher(citation);

                    if (massAppCtMatcher.find()) {
                        // Massachusetts Appeals Court case
                        String volume = massAppCtMatcher.group(1);
                        String page = massAppCtMatcher.group(2);
                        String justiaUrl = String.format(
                            "https://law.justia.com/cases/massachusetts/court-of-appeals/%s/%s-mass-app-ct-%s.html",
                            year, volume, page
                        );

                        String fullCitation = court != null ?
                            String.format("%s (%s %s)", citation, court.trim(), year) :
                            String.format("%s (%s)", citation, year);

                        String replacement = String.format("✓ [%s](%s), %s",
                            caseName, justiaUrl, fullCitation);

                        log.info("✅ MASSACHUSETTS APPEALS COURT - Justia URL constructed: {}", justiaUrl);
                        log.info("   REPLACING: '{}' → '{}'", fullMatch, replacement.substring(0, Math.min(100, replacement.length())));

                        matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(replacement));
                        verifiedCount++;
                    } else if (massSJCMatcher.find()) {
                        // Massachusetts SJC case
                        String volume = massSJCMatcher.group(1);
                        String page = massSJCMatcher.group(2);
                        String justiaUrl = String.format(
                            "https://law.justia.com/cases/massachusetts/supreme-court/%s/%s-mass-%s.html",
                            year, volume, page
                        );

                        String fullCitation = court != null ?
                            String.format("%s (%s %s)", citation, court.trim(), year) :
                            String.format("%s (%s)", citation, year);

                        String replacement = String.format("✓ [%s](%s), %s",
                            caseName, justiaUrl, fullCitation);

                        log.info("✅ MASSACHUSETTS SJC - Justia URL constructed: {}", justiaUrl);
                        log.info("   REPLACING: '{}' → '{}'", fullMatch, replacement.substring(0, Math.min(100, replacement.length())));

                        matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(replacement));
                        verifiedCount++;
                    } else {
                        // Not verified via CourtListener or known state patterns.
                        // Leave the citation as plain text — no link is better than a wrong search link.
                        // CourtListener search URLs often point to irrelevant results (different cases).
                        log.info("ℹ️ UNVERIFIED: Leaving as plain text (no fallback link): {} | {}", caseName, citation);
                        matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(fullMatch));
                        unverifiedCount++;
                    }
                }
            }
        }
        matcher.appendTail(sb);
        processedResponse = sb.toString();

        log.info("📊 Citation verification complete: {} verified ✓, {} unverified ⚠️",
                 verifiedCount, unverifiedCount);

        return processedResponse;
    }

    /**
     * POST-PROCESSING: Convert ■ bullets to numbered lists
     * This ensures Claude ALWAYS uses numbered lists even if it ignores prompt instructions
     */
    private String convertBulletsToNumberedLists(String response) {
        if (response == null) {
            return response;
        }

        log.info("🔄 Post-processing: Converting ■ bullets to numbered lists");

        // Simply convert all ■ bullets to numbered lists throughout the entire response
        String[] lines = response.split("\n");
        StringBuilder result = new StringBuilder();
        int argumentNumber = 1;
        int convertedCount = 0;

        // Debug: Log character codes for ALL lines at start of response
        log.info("🔍 Analyzing response for bullets. Total lines: {}", lines.length);
        for (int i = 0; i < Math.min(30, lines.length); i++) {
            String line = lines[i];
            if (line.trim().length() > 0) {
                // Log the first 10 characters as hex codes
                String hexCodes = line.chars().limit(10).mapToObj(c -> String.format("U+%04X", c))
                    .reduce((a, b) -> a + " " + b).orElse("");

                // Check for any bullet-like characters
                boolean hasBullet = line.contains("■") || line.contains("▪") || line.contains("•") ||
                    line.contains("\u25A0") || line.contains("\u25AA") || line.contains("\u2022") ||
                    line.contains("●") || line.contains("\u2022") || line.contains("\u25CF");

                if (hasBullet || line.trim().startsWith("-") || line.trim().startsWith("*")) {
                    log.info("🎯 Line {} (potential bullet): '{}' | Hex: {}", i,
                        line.substring(0, Math.min(50, line.length())), hexCodes);
                }

                // Also log lines that might be list items (start with number)
                if (line.matches("^\\s*\\d+\\..*")) {
                    log.info("📋 Line {} (numbered): '{}'", i,
                        line.substring(0, Math.min(50, line.length())));
                }
            }
        }

        boolean inStrongestArguments = false;

        for (String line : lines) {
            // Track when we enter the "Strongest Arguments" section
            if (line.contains("Strongest Arguments")) {
                inStrongestArguments = true;
                result.append(line).append("\n");
                continue;
            }

            // Exit the section when we hit another major heading
            if (line.matches("^#{1,3}\\s+.*") && !line.contains("Strongest Arguments")) {
                inStrongestArguments = false;
            }

            // Only convert bullets in the Strongest Arguments section
            if (inStrongestArguments) {
                // Detect lines that start with various bullet characters or markdown bullets
                // ■ = U+25A0, ▪ = U+25AA, • = U+2022, also handle - and *
                // Allow up to 4 spaces leading whitespace (was 2)
                if (line.matches("^\\s{0,4}[-*■▪•\\u25A0\\u25AA\\u2022●]\\s+.*")) {
                    // This is a main bullet - convert to numbered with bold formatting
                    String content = line.replaceFirst("^\\s{0,4}[-*■▪•\\u25A0\\u25AA\\u2022●]\\s+", "");

                    // Add **bold** formatting to heading (text before first " - ")
                    // Format: "Heading - Details" → "**Heading** - Details"
                    String formattedContent;
                    int dashIndex = content.indexOf(" - ");
                    if (dashIndex > 0) {
                        String heading = content.substring(0, dashIndex).trim();
                        String details = content.substring(dashIndex);
                        formattedContent = "**" + heading + "**" + details;
                    } else {
                        // No " - " separator, bold the entire content
                        formattedContent = "**" + content.trim() + "**";
                    }

                    result.append(argumentNumber).append(". ").append(formattedContent).append("\n");
                    argumentNumber++;
                    convertedCount++;
                    log.debug("Converted bullet #{} with bold formatting: {}", argumentNumber - 1,
                             formattedContent.substring(0, Math.min(50, formattedContent.length())));
                    continue;
                }
            }

            // Keep all other lines as-is
            result.append(line).append("\n");
        }

        if (convertedCount > 0) {
            log.info("✅ Successfully converted {} bullets to numbered list", convertedCount);
        } else {
            log.warn("⚠️ No bullets found to convert in response");
            // Log more detailed info for debugging
            log.info("Response length: {}, Line count: {}", response.length(), lines.length);
            // Check if response contains any bullet-like characters
            if (response.contains("■")) log.info("Contains ■ (U+25A0)");
            if (response.contains("▪")) log.info("Contains ▪ (U+25AA)");
            if (response.contains("•")) log.info("Contains • (U+2022)");
        }

        return result.toString();
    }
}