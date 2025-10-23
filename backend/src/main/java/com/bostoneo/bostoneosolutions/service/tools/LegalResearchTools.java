package com.bostoneo.bostoneosolutions.service.tools;

import com.bostoneo.bostoneosolutions.dto.DeadlineInfo;
import com.bostoneo.bostoneosolutions.dto.ai.ToolDefinition;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.service.external.CourtListenerService;
import com.bostoneo.bostoneosolutions.service.external.ECFRService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Defines and executes legal research tools for agentic Claude
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LegalResearchTools {

    private final CourtListenerService courtListenerService;
    private final ECFRService ecfrService;
    private final MotionTemplateService motionTemplateService;

    // In-memory cache for tool results (reduces external API costs)
    private static class CachedToolResult {
        final Object result;
        final LocalDateTime expiresAt;
        int hitCount = 0;

        CachedToolResult(Object result, int ttlDays) {
            this.result = result;
            this.expiresAt = LocalDateTime.now().plusDays(ttlDays);
        }

        boolean isValid() {
            return LocalDateTime.now().isBefore(expiresAt);
        }
    }

    private final Map<String, CachedToolResult> toolResultCache = new ConcurrentHashMap<>();

    // Lazy injection to avoid circular dependency (ClaudeSonnet4Service -> LegalResearchTools -> ClaudeSonnet4Service)
    @Autowired
    @Lazy
    private ClaudeSonnet4Service claudeSonnet4Service;

    /**
     * Get all available tool definitions for Claude
     */
    public List<ToolDefinition> getToolDefinitions() {
        return List.of(
            // Legal research tools
            searchCaseLawTool(),
            getCFRTextTool(),
            verifyCitationTool(),
            // webSearchTool(),  // DISABLED - too slow (30-60s nested Claude API calls), causes hanging and wasted costs
            // Temporal validation tools
            getCurrentDateTool(),
            checkDeadlineStatusTool(),
            validateCaseTimelineTool(),
            // Timeline generation
            generateCaseTimelineTool(),
            // Motion templates
            generateMotionTemplateTool()
        );
    }

    /**
     * Execute a tool by name with given inputs
     */
    public Object executeTool(String toolName, Map<String, Object> input) {
        log.info("Executing tool: {} with input: {}", toolName, input);

        try {
            return switch (toolName) {
                // Legal research tools
                case "search_case_law" -> searchCaseLaw(input);
                case "get_cfr_text" -> getCFRText(input);
                case "verify_citation" -> verifyCitation(input);
                // case "web_search" -> executeWebSearch(input);  // DISABLED - too slow and expensive
                // Temporal validation tools
                case "get_current_date" -> getCurrentDate(input);
                case "check_deadline_status" -> checkDeadlineStatus(input);
                case "validate_case_timeline" -> validateCaseTimeline(input);
                // Timeline generation
                case "generate_case_timeline" -> generateCaseTimeline(input);
                // Motion templates
                case "generate_motion_template" -> generateMotionTemplate(input);
                default -> "Error: Unknown tool '" + toolName + "'";
            };
        } catch (Exception e) {
            log.error("Tool execution error: {}", e.getMessage(), e);
            return "Error executing tool: " + e.getMessage();
        }
    }

    // ===== TOOL DEFINITIONS =====

    private ToolDefinition searchCaseLawTool() {
        return ToolDefinition.builder()
            .name("search_case_law")
            .description("⚠️ REQUIRED for counsel-ready responses: Search for controlling case law precedents. MUST find minimum 5-10 cases with specific holdings. Returns court decisions with citations, holdings, and procedural history. TIP: Use from_year parameter to search recent precedents (2023+) for evolving standards. Multiple searches recommended to meet minimum citation requirements.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "query", Map.of(
                        "type", "string",
                        "description", "Search query (case name, legal issue, keywords)"
                    ),
                    "jurisdiction", Map.of(
                        "type", "string",
                        "description", "Court jurisdiction (e.g., '1st-cir', 'mad', 'scotus')"
                    ),
                    "from_year", Map.of(
                        "type", "integer",
                        "description", "Start year for search (optional). Use 2023 or later to find recent developments."
                    )
                ),
                "required", List.of("query")
            ))
            .build();
    }

    private ToolDefinition getCFRTextTool() {
        return ToolDefinition.builder()
            .name("get_cfr_text")
            .description("Retrieve full text of a federal regulation from the Code of Federal Regulations (CFR). Use this to get exact regulation text.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "title", Map.of(
                        "type", "string",
                        "description", "CFR title number (e.g., '8' for immigration, '29' for labor)"
                    ),
                    "part", Map.of(
                        "type", "string",
                        "description", "Part number (e.g., '1003' for BIA procedures)"
                    ),
                    "section", Map.of(
                        "type", "string",
                        "description", "Section number (e.g., '23' for motions)"
                    )
                ),
                "required", List.of("title", "part", "section")
            ))
            .build();
    }

    private ToolDefinition verifyCitationTool() {
        return ToolDefinition.builder()
            .name("verify_citation")
            .description("Verify if a case citation exists and is valid. Returns case details if found.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "citation", Map.of(
                        "type", "string",
                        "description", "Case citation to verify (e.g., '550 U.S. 544' or 'Twombly')"
                    )
                ),
                "required", List.of("citation")
            ))
            .build();
    }

    private ToolDefinition webSearchTool() {
        return ToolDefinition.builder()
            .name("web_search")
            .description("""
                Search the web for real-time legal information. **USE SPARINGLY - EXPENSIVE OPERATION.**

                **USE ONLY FOR:**
                - Real-time court dockets (PACER, ECF, EOIR case status)
                - Recent news/developments (last 30 days)
                - Country conditions reports (State Dept, UNHCR)
                - Regulatory agency updates (not yet in eCFR)
                - BIA or immigration case status checks

                **DO NOT USE FOR:**
                - Case law (use search_case_law instead)
                - Federal regulations (use get_cfr_text instead)
                - Citation verification (use verify_citation instead)

                **COST WARNING:** This tool is expensive. Only use when specialized legal research tools are insufficient.
                Think carefully: Can this information be found using search_case_law or get_cfr_text? If yes, use those instead.
                """)
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "query", Map.of(
                        "type", "string",
                        "description", "Search query for real-time legal information"
                    ),
                    "context", Map.of(
                        "type", "string",
                        "description", "Optional context about why web search is needed (helps focus results)"
                    )
                ),
                "required", List.of("query")
            ))
            .build();
    }

    // ===== CACHE HELPERS =====

    /**
     * Generate cache key from tool name and input parameters
     */
    private String generateCacheKey(String toolName, Map<String, Object> input) {
        return toolName + ":" + input.toString().hashCode();
    }

    /**
     * Check cache for tool result
     */
    private Object checkCache(String cacheKey) {
        CachedToolResult cached = toolResultCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            cached.hitCount++;
            log.info("✓ TOOL CACHE HIT: {} (hits: {})", cacheKey, cached.hitCount);
            return cached.result;
        }
        if (cached != null && !cached.isValid()) {
            toolResultCache.remove(cacheKey);
        }
        return null;
    }

    /**
     * Save result to cache
     */
    private void saveToCache(String cacheKey, Object result, int ttlDays) {
        toolResultCache.put(cacheKey, new CachedToolResult(result, ttlDays));
        log.info("✓ Cached tool result: {} (TTL: {} days)", cacheKey, ttlDays);
    }

    // ===== TOOL IMPLEMENTATIONS =====

    private Object searchCaseLaw(Map<String, Object> input) {
        // Check cache first (TTL: 30 days - case law is static)
        String cacheKey = generateCacheKey("search_case_law", input);
        Object cachedResult = checkCache(cacheKey);
        if (cachedResult != null) {
            return cachedResult;
        }

        String query = (String) input.get("query");
        String jurisdiction = (String) input.getOrDefault("jurisdiction", "");
        Integer fromYear = (Integer) input.get("from_year");

        LocalDate fromDate = fromYear != null
            ? LocalDate.of(fromYear, 1, 1)
            : LocalDate.now().minusYears(10);

        List<Map<String, Object>> results = courtListenerService.searchOpinions(
            query, jurisdiction, fromDate, null
        );

        if (results.isEmpty()) {
            String noResults = "No cases found for query: " + query;
            saveToCache(cacheKey, noResults, 7); // Cache "no results" for 7 days
            return noResults;
        }

        // Format results for Claude (show up to 10 cases for counsel-ready citations)
        StringBuilder formatted = new StringBuilder();
        formatted.append(String.format("Found %d cases:\n", results.size()));

        // Warn if insufficient cases found
        if (results.size() < 5) {
            formatted.append("⚠️ WARNING: Only ").append(results.size())
                     .append(" cases found. Counsel-ready responses require 5-10 precedents. ")
                     .append("Conduct additional searches with different keywords/jurisdictions.\n");
        }
        formatted.append("\n");

        for (int i = 0; i < Math.min(10, results.size()); i++) {
            Map<String, Object> result = results.get(i);
            formatted.append(String.format("%d. %s\n", i + 1, result.get("title")));
            formatted.append(String.format("   Citation: %s\n", result.get("citation")));
            formatted.append(String.format("   Court: %s | Date: %s\n",
                result.get("court"), result.get("date")));
            formatted.append(String.format("   Holding/Summary: %s\n",
                truncate((String) result.get("summary"), 300)));

            // Add procedural posture if available
            if (result.containsKey("posture") && result.get("posture") != null) {
                formatted.append(String.format("   Posture: %s\n",
                    truncate((String) result.get("posture"), 150)));
            }
            formatted.append("\n");
        }

        // Add reminder about citation requirements
        formatted.append("💡 TIP: Extract holdings and analyze how each case applies to your query. ");
        formatted.append("If you have fewer than 5 cases with relevant holdings, conduct additional searches.\n");

        String formattedResult = formatted.toString();
        saveToCache(cacheKey, formattedResult, 30); // Cache for 30 days
        return formattedResult;
    }

    private Object getCFRText(Map<String, Object> input) {
        // Check cache first (TTL: 90 days - regulations change infrequently)
        String cacheKey = generateCacheKey("get_cfr_text", input);
        Object cachedResult = checkCache(cacheKey);
        if (cachedResult != null) {
            return cachedResult;
        }

        String title = (String) input.get("title");
        String part = (String) input.get("part");
        String section = (String) input.get("section");

        Object result = ecfrService.getCFRText(title, part, section);
        saveToCache(cacheKey, result, 90); // Cache for 90 days
        return result;
    }

    private Object verifyCitation(Map<String, Object> input) {
        // Check cache first (TTL: 30 days - citations are static)
        String cacheKey = generateCacheKey("verify_citation", input);
        Object cachedResult = checkCache(cacheKey);
        if (cachedResult != null) {
            return cachedResult;
        }

        String citation = (String) input.get("citation");

        // Search CourtListener for this citation
        List<Map<String, Object>> results = courtListenerService.searchOpinions(
            citation, "", LocalDate.now().minusYears(50), null
        );

        String result;
        if (results.isEmpty()) {
            result = "Citation not found or cannot be verified: " + citation;
            saveToCache(cacheKey, result, 7); // Cache "not found" for 7 days
        } else {
            Map<String, Object> case0 = results.get(0);
            result = String.format("✓ VERIFIED: %s\nCourt: %s\nDate: %s\nURL: %s",
                case0.get("title"),
                case0.get("court"),
                case0.get("date"),
                case0.get("url"));
            saveToCache(cacheKey, result, 30); // Cache verified citations for 30 days
        }

        return result;
    }

    private Object executeWebSearch(Map<String, Object> input) {
        String query = (String) input.get("query");
        String context = (String) input.getOrDefault("context", "");

        log.info("🌐 Web search requested: query='{}', context='{}'", query, context);

        try {
            // Call ClaudeSonnet4Service's web search with empty jurisdiction and empty results
            // This will trigger autonomous web research
            Map<String, Object> searchResult = claudeSonnet4Service
                .performAutonomousWebSearch(query, context, List.of())
                .join();

            // Format the result for Claude
            if (searchResult == null || searchResult.isEmpty()) {
                return "Web search completed but no results found for: " + query;
            }

            // Extract key fields from the search result
            StringBuilder formatted = new StringBuilder();
            formatted.append("🌐 WEB SEARCH RESULTS:\n\n");

            // Add comprehensive analysis if available
            if (searchResult.containsKey("comprehensiveAnalysis")) {
                formatted.append(searchResult.get("comprehensiveAnalysis")).append("\n\n");
            }

            // Add legal authorities if available
            if (searchResult.containsKey("legalAuthorities")) {
                formatted.append("**Legal Authorities:**\n");
                formatted.append(searchResult.get("legalAuthorities")).append("\n\n");
            }

            // Add sources consulted
            if (searchResult.containsKey("sourcesConsulted")) {
                formatted.append("**Sources:**\n");
                formatted.append(searchResult.get("sourcesConsulted")).append("\n");
            }

            return formatted.toString();

        } catch (Exception e) {
            log.error("Web search error: {}", e.getMessage(), e);
            return "Error performing web search: " + e.getMessage() +
                   "\nTry using specialized tools (search_case_law, get_cfr_text) instead.";
        }
    }

    private String truncate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    // ===== TEMPORAL VALIDATION TOOLS =====

    /**
     * Tool: Get current date
     * Returns the accurate system date to prevent temporal logic errors
     */
    private ToolDefinition getCurrentDateTool() {
        return ToolDefinition.builder()
            .name("get_current_date")
            .description("Get the current system date in ISO format (YYYY-MM-DD). ALWAYS call this FIRST before analyzing deadlines to ensure accurate date calculations.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(),
                "required", List.of()
            ))
            .build();
    }

    /**
     * Tool: Check deadline status
     * Validates if a deadline has passed, is today, or is upcoming
     */
    private ToolDefinition checkDeadlineStatusTool() {
        return ToolDefinition.builder()
            .name("check_deadline_status")
            .description("Check if a deadline has passed, is today, or is upcoming. Returns detailed status including days until/since deadline. MANDATORY for every deadline mentioned in your response.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "deadline_date", Map.of(
                        "type", "string",
                        "description", "Deadline date in YYYY-MM-DD format"
                    ),
                    "event_name", Map.of(
                        "type", "string",
                        "description", "Name of the event (e.g., 'Preliminary Injunction Hearing', 'Discovery Cutoff')"
                    )
                ),
                "required", List.of("deadline_date", "event_name")
            ))
            .build();
    }

    /**
     * Tool: Validate case timeline
     * Checks temporal consistency of multiple events
     */
    private ToolDefinition validateCaseTimelineTool() {
        return ToolDefinition.builder()
            .name("validate_case_timeline")
            .description("Validate temporal consistency of case events. Checks if events are in logical order and identifies any deadlines that have already passed. Use when analyzing multiple deadlines.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "events", Map.of(
                        "type", "array",
                        "description", "List of events with dates",
                        "items", Map.of(
                            "type", "object",
                            "properties", Map.of(
                                "event_name", Map.of("type", "string"),
                                "event_date", Map.of("type", "string", "description", "Date in YYYY-MM-DD format")
                            )
                        )
                    )
                ),
                "required", List.of("events")
            ))
            .build();
    }

    // ===== TEMPORAL VALIDATION IMPLEMENTATIONS =====

    /**
     * Get current system date
     */
    private Object getCurrentDate(Map<String, Object> input) {
        LocalDate today = LocalDate.now();
        String formatted = today.format(DateTimeFormatter.ISO_LOCAL_DATE);

        log.info("Current date requested: {}", formatted);

        return String.format("Current date: %s (%s)",
            formatted,
            today.format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy")));
    }

    /**
     * Check deadline status
     */
    private Object checkDeadlineStatus(Map<String, Object> input) {
        String deadlineDateStr = (String) input.get("deadline_date");
        String eventName = (String) input.get("event_name");

        try {
            LocalDate deadlineDate = LocalDate.parse(deadlineDateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            DeadlineInfo info = DeadlineInfo.fromDate(deadlineDate, eventName, DeadlineInfo.DeadlineType.OTHER);

            StringBuilder result = new StringBuilder();
            result.append(String.format("Deadline Status for '%s':\n", eventName));
            result.append(String.format("  Date: %s\n", deadlineDate.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))));
            result.append(String.format("  Status: %s\n", info.getStatusMessage()));
            result.append(String.format("  Days: %d %s\n",
                Math.abs(info.getDaysUntil()),
                info.getStatus() == DeadlineInfo.DeadlineStatus.PASSED ? "ago" : "from now"));

            if (info.getStatus() == DeadlineInfo.DeadlineStatus.PASSED) {
                result.append("\n⚠️ WARNING: This deadline has ALREADY PASSED.\n");
                result.append("DO NOT provide advice on preparing for this event.\n");
                result.append("INSTEAD: Advise on post-deadline remedies or ask about the outcome.\n");
            } else if (info.getUrgency() == DeadlineInfo.UrgencyLevel.CRITICAL) {
                result.append("\n🚨 CRITICAL: This deadline is within 48 hours!\n");
            } else if (info.getUrgency() == DeadlineInfo.UrgencyLevel.HIGH) {
                result.append("\n⚡ HIGH URGENCY: This deadline is within 1 week.\n");
            }

            log.info("Deadline check: {} - {}", eventName, info.getStatusMessage());

            return result.toString();

        } catch (DateTimeParseException e) {
            return String.format("Error: Invalid date format '%s'. Use YYYY-MM-DD format.", deadlineDateStr);
        }
    }

    /**
     * Validate case timeline
     */
    @SuppressWarnings("unchecked")
    private Object validateCaseTimeline(Map<String, Object> input) {
        List<Map<String, Object>> events = (List<Map<String, Object>>) input.get("events");

        if (events == null || events.isEmpty()) {
            return "No events provided for timeline validation.";
        }

        List<DeadlineInfo> deadlines = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (Map<String, Object> event : events) {
            String eventName = (String) event.get("event_name");
            String eventDateStr = (String) event.get("event_date");

            try {
                LocalDate eventDate = LocalDate.parse(eventDateStr, DateTimeFormatter.ISO_LOCAL_DATE);
                DeadlineInfo info = DeadlineInfo.fromDate(eventDate, eventName, DeadlineInfo.DeadlineType.OTHER);
                deadlines.add(info);
            } catch (DateTimeParseException e) {
                errors.add(String.format("Invalid date format for '%s': %s", eventName, eventDateStr));
            }
        }

        // Build validation report
        StringBuilder report = new StringBuilder();
        report.append("📅 CASE TIMELINE VALIDATION:\n\n");

        // Show current date
        report.append(String.format("Current Date: %s\n\n",
            LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))));

        // Categorize events
        List<DeadlineInfo> passed = new ArrayList<>();
        List<DeadlineInfo> upcoming = new ArrayList<>();
        List<DeadlineInfo> today = new ArrayList<>();

        for (DeadlineInfo info : deadlines) {
            switch (info.getStatus()) {
                case PASSED -> passed.add(info);
                case TODAY -> today.add(info);
                case UPCOMING -> upcoming.add(info);
            }
        }

        // Report passed deadlines (CRITICAL)
        if (!passed.isEmpty()) {
            report.append("❌ PASSED DEADLINES (Already Occurred):\n");
            for (DeadlineInfo info : passed) {
                report.append(String.format("  - %s: %s (%d days ago)\n",
                    info.getEventName(),
                    info.getDate().format(DateTimeFormatter.ofPattern("MMM d, yyyy")),
                    Math.abs(info.getDaysUntil())));
            }
            report.append("\n⚠️ CRITICAL: Do NOT provide preparation advice for these events.\n");
            report.append("Instead: Ask about outcomes or provide post-deadline guidance.\n\n");
        }

        // Report today's deadlines
        if (!today.isEmpty()) {
            report.append("🔔 DEADLINES TODAY:\n");
            for (DeadlineInfo info : today) {
                report.append(String.format("  - %s\n", info.getEventName()));
            }
            report.append("\n");
        }

        // Report upcoming deadlines
        if (!upcoming.isEmpty()) {
            report.append("✅ UPCOMING DEADLINES:\n");
            upcoming.sort((a, b) -> Long.compare(a.getDaysUntil(), b.getDaysUntil()));
            for (DeadlineInfo info : upcoming) {
                String urgencyMarker = switch (info.getUrgency()) {
                    case CRITICAL -> "🚨";
                    case HIGH -> "⚡";
                    case MEDIUM -> "⚠️";
                    default -> "  ";
                };
                report.append(String.format("  %s %s: %s (in %d days)\n",
                    urgencyMarker,
                    info.getEventName(),
                    info.getDate().format(DateTimeFormatter.ofPattern("MMM d, yyyy")),
                    info.getDaysUntil()));
            }
            report.append("\n");
        }

        // Report errors
        if (!errors.isEmpty()) {
            report.append("⚠️ ERRORS:\n");
            for (String error : errors) {
                report.append("  - ").append(error).append("\n");
            }
        }

        log.info("Timeline validation: {} passed, {} upcoming, {} errors",
            passed.size(), upcoming.size(), errors.size());

        return report.toString();
    }

    // ===== TIMELINE GENERATION TOOL =====

    /**
     * Tool: Generate case timeline
     * Creates a formatted markdown timeline of case events with urgency indicators
     */
    private ToolDefinition generateCaseTimelineTool() {
        return ToolDefinition.builder()
            .name("generate_case_timeline")
            .description("Generate a formatted timeline of case events with deadlines. Use this to create a visual representation of critical dates for the attorney. Returns markdown-formatted timeline with urgency indicators.")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "events", Map.of(
                        "type", "array",
                        "description", "List of events with dates",
                        "items", Map.of(
                            "type", "object",
                            "properties", Map.of(
                                "event_name", Map.of("type", "string"),
                                "event_date", Map.of("type", "string", "description", "Date in YYYY-MM-DD format")
                            )
                        )
                    )
                ),
                "required", List.of("events")
            ))
            .build();
    }

    /**
     * Generate case timeline
     * Creates markdown-formatted timeline with urgency indicators
     */
    @SuppressWarnings("unchecked")
    private Object generateCaseTimeline(Map<String, Object> input) {
        List<Map<String, Object>> events = (List<Map<String, Object>>) input.get("events");

        if (events == null || events.isEmpty()) {
            return "## Timeline\n\nNo events provided for timeline generation.";
        }

        List<DeadlineInfo> deadlines = new ArrayList<>();

        // Parse all events
        for (Map<String, Object> event : events) {
            String eventName = (String) event.get("event_name");
            String eventDateStr = (String) event.get("event_date");

            try {
                LocalDate eventDate = LocalDate.parse(eventDateStr, DateTimeFormatter.ISO_LOCAL_DATE);
                DeadlineInfo info = DeadlineInfo.fromDate(eventDate, eventName, DeadlineInfo.DeadlineType.OTHER);
                deadlines.add(info);
            } catch (DateTimeParseException e) {
                log.warn("Invalid date format for event '{}': {}", eventName, eventDateStr);
            }
        }

        if (deadlines.isEmpty()) {
            return "## Timeline\n\nNo valid events to display.";
        }

        // Sort by date
        deadlines.sort((a, b) -> a.getDate().compareTo(b.getDate()));

        // Build markdown timeline
        StringBuilder timeline = new StringBuilder();
        timeline.append("## Timeline\n\n");

        for (DeadlineInfo info : deadlines) {
            String urgencyIcon;
            String urgencyText = "";

            if (info.getStatus() == DeadlineInfo.DeadlineStatus.PASSED) {
                urgencyIcon = "✓";
                urgencyText = String.format(" (%d days ago)", Math.abs(info.getDaysUntil()));
            } else if (info.getStatus() == DeadlineInfo.DeadlineStatus.TODAY) {
                urgencyIcon = "🔔";
                urgencyText = " (TODAY)";
            } else {
                switch (info.getUrgency()) {
                    case CRITICAL:
                        urgencyIcon = "⚠️";
                        urgencyText = String.format(" (URGENT - %d days)", info.getDaysUntil());
                        break;
                    case HIGH:
                        urgencyIcon = "⚡";
                        urgencyText = String.format(" (%d days)", info.getDaysUntil());
                        break;
                    case MEDIUM:
                        urgencyIcon = "📅";
                        urgencyText = String.format(" (%d days)", info.getDaysUntil());
                        break;
                    default:
                        urgencyIcon = "📅";
                        urgencyText = String.format(" (%d days)", info.getDaysUntil());
                }
            }

            timeline.append(String.format("- %s **%s** - %s%s\n",
                urgencyIcon,
                info.getDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")),
                info.getEventName(),
                urgencyText));
        }

        log.info("Generated timeline with {} events", deadlines.size());

        return timeline.toString();
    }

    // ===== MOTION TEMPLATE TOOL =====

    /**
     * Tool: Generate motion template
     * Creates sample legal motion language based on motion type
     */
    private ToolDefinition generateMotionTemplateTool() {
        return ToolDefinition.builder()
            .name("generate_motion_template")
            .description("Generate sample motion template with proper legal formatting. Use this when recommending a motion filing to provide attorney with starting template language. Supports: suppress, dismiss, continue, discovery, exclude (motion in limine).")
            .input_schema(Map.of(
                "type", "object",
                "properties", Map.of(
                    "motion_type", Map.of(
                        "type", "string",
                        "description", "Type of motion (suppress, dismiss, continue, discovery, exclude)"
                    ),
                    "defendant", Map.of(
                        "type", "string",
                        "description", "Defendant name (for personalization)"
                    ),
                    "grounds", Map.of(
                        "type", "string",
                        "description", "Legal grounds for the motion (e.g., 'Fourth Amendment violation', 'lack of jurisdiction')"
                    ),
                    "incident_date", Map.of(
                        "type", "string",
                        "description", "Date of incident (if applicable)"
                    )
                ),
                "required", List.of("motion_type")
            ))
            .build();
    }

    /**
     * Generate motion template
     * Delegates to MotionTemplateService for template generation
     */
    private Object generateMotionTemplate(Map<String, Object> input) {
        String motionType = (String) input.get("motion_type");

        if (motionType == null || motionType.isEmpty()) {
            return "Error: motion_type is required";
        }

        log.info("Generating motion template for type: {}", motionType);

        return motionTemplateService.generateMotionTemplate(motionType, input);
    }
}
