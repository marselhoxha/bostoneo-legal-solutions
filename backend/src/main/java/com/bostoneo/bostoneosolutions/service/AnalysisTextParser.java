package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses Claude's analysis text to extract action items and timeline events
 * using regex patterns - NO additional AI calls required.
 *
 * This approach saves tokens and provides instant extraction from the existing
 * analysis response.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AnalysisTextParser {

    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final ObjectMapper objectMapper;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // Date patterns for various formats
    private static final List<DateTimeFormatter> DATE_FORMATTERS = Arrays.asList(
        DateTimeFormatter.ofPattern("MMMM d, yyyy"),      // November 9, 2025
        DateTimeFormatter.ofPattern("MMMM dd, yyyy"),     // November 09, 2025
        DateTimeFormatter.ofPattern("MMM d, yyyy"),       // Nov 9, 2025
        DateTimeFormatter.ofPattern("MMM dd, yyyy"),      // Nov 09, 2025
        DateTimeFormatter.ofPattern("M/d/yyyy"),          // 11/9/2025
        DateTimeFormatter.ofPattern("MM/dd/yyyy"),        // 11/09/2025
        DateTimeFormatter.ofPattern("yyyy-MM-dd")         // 2025-11-09
    );

    // Regex patterns for action items
    private static final Pattern[] ACTION_PATTERNS = {
        // Checkbox patterns: ☐, □, [ ], - [ ]
        Pattern.compile("(?:☐|□|\\[\\s*\\]|\\-\\s*\\[\\s*\\])\\s*(.+?)(?=(?:☐|□|\\[\\s*\\]|\\-\\s*\\[\\s*\\])|\\n\\n|$)", Pattern.DOTALL),

        // Day-based patterns: DAY 1:, DAY 1-3:, DAYS 1-7:
        Pattern.compile("(?:DAY|DAYS?)\\s*(\\d+(?:-\\d+)?)[:\\s]+(.+?)(?=(?:DAY|DAYS?)\\s*\\d|##|\\n\\n|$)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL),

        // Bullet points with action verbs
        Pattern.compile("[-*]\\s*((?:File|Submit|Review|Prepare|Draft|Respond|Send|Gather|Request|Schedule|Contact|Verify|Document|Obtain|Serve|Complete|Identify|Research)[^\\n]+)", Pattern.CASE_INSENSITIVE),

        // Numbered action items
        Pattern.compile("\\d+[.)\\s]+\\*\\*([^*]+)\\*\\*[:\\s]*(.+?)(?=\\d+[.)\\s]+\\*\\*|##|$)", Pattern.DOTALL)
    };

    // Regex patterns for timeline/deadline detection
    private static final Pattern DATE_PATTERN = Pattern.compile(
        "(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|" +
        "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\.?\\s+\\d{1,2},?\\s+\\d{4})|" +
        "(?:\\d{1,2}/\\d{1,2}/\\d{4})|(?:\\d{4}-\\d{2}-\\d{2})",
        Pattern.CASE_INSENSITIVE
    );

    // Priority keywords
    private static final Map<String, String> PRIORITY_KEYWORDS;
    static {
        PRIORITY_KEYWORDS = new HashMap<>();
        PRIORITY_KEYWORDS.put("immediate", "CRITICAL");
        PRIORITY_KEYWORDS.put("urgent", "CRITICAL");
        PRIORITY_KEYWORDS.put("critical", "CRITICAL");
        PRIORITY_KEYWORDS.put("asap", "CRITICAL");
        PRIORITY_KEYWORDS.put("important", "HIGH");
        PRIORITY_KEYWORDS.put("high priority", "HIGH");
        PRIORITY_KEYWORDS.put("soon", "HIGH");
        PRIORITY_KEYWORDS.put("standard", "MEDIUM");
        PRIORITY_KEYWORDS.put("routine", "MEDIUM");
        PRIORITY_KEYWORDS.put("optional", "LOW");
        PRIORITY_KEYWORDS.put("when possible", "LOW");
    }

    /**
     * Main entry point: Parse analysis text and save extracted items
     * HYBRID APPROACH: Try embedded JSON first, then fall back to regex patterns
     * @deprecated Use parseAndSaveStructuredData(Long, String, Long) to pass orgId for async safety
     */
    @Deprecated
    public void parseAndSaveStructuredData(Long analysisId, String analysisText) {
        parseAndSaveStructuredData(analysisId, analysisText, getRequiredOrganizationId());
    }

    /**
     * Main entry point: Parse analysis text and save extracted items (async-safe version)
     * HYBRID APPROACH: Try embedded JSON first, then fall back to regex patterns
     * @param orgId Organization ID - must be passed explicitly for async operations
     */
    public void parseAndSaveStructuredData(Long analysisId, String analysisText, Long orgId) {
        if (analysisText == null || analysisText.isEmpty()) {
            log.warn("Empty analysis text for analysis ID: {}", analysisId);
            return;
        }

        log.info("Parsing analysis text for structured data: analysisId={}, orgId={}, length={}",
                 analysisId, orgId, analysisText.length());

        // Clear existing items for this analysis (in case of re-processing)
        // SECURITY: Use tenant-filtered delete to prevent cross-org deletion
        actionItemRepository.deleteByOrganizationIdAndAnalysisId(orgId, analysisId);
        timelineEventRepository.deleteByOrganizationIdAndAnalysisId(orgId, analysisId);

        // STEP 1: Try to parse embedded JSON first (most accurate)
        boolean jsonParsed = tryParseEmbeddedJson(analysisId, analysisText, orgId);

        if (jsonParsed) {
            log.info("Successfully extracted structured data from embedded JSON for analysis {}", analysisId);
            return;
        }

        // STEP 2: Fall back to regex patterns
        log.info("No embedded JSON found, falling back to regex extraction for analysis {}", analysisId);

        // Extract and save action items using regex
        List<ActionItem> actionItems = extractActionItems(analysisId, analysisText, orgId);
        if (!actionItems.isEmpty()) {
            actionItemRepository.saveAll(actionItems);
            log.info("Saved {} action items (regex) for analysis {}", actionItems.size(), analysisId);
        }

        // Extract and save timeline events using regex
        List<TimelineEvent> timelineEvents = extractTimelineEvents(analysisId, analysisText, orgId);
        if (!timelineEvents.isEmpty()) {
            timelineEventRepository.saveAll(timelineEvents);
            log.info("Saved {} timeline events (regex) for analysis {}", timelineEvents.size(), analysisId);
        }
    }

    /**
     * Try to parse embedded JSON from Claude's response
     * Returns true if JSON was found and parsed successfully
     * @param orgId Organization ID for tenant isolation
     */
    private boolean tryParseEmbeddedJson(Long analysisId, String text, Long orgId) {
        try {
            // Look for ```json code block
            String jsonBlock = null;
            int jsonStart = text.indexOf("```json");
            if (jsonStart != -1) {
                int contentStart = text.indexOf('\n', jsonStart) + 1;
                int jsonEnd = text.indexOf("```", contentStart);
                if (jsonEnd != -1) {
                    jsonBlock = text.substring(contentStart, jsonEnd).trim();
                }
            }

            // Try to find raw JSON object if no code block
            if (jsonBlock == null) {
                int objectStart = text.lastIndexOf('{');
                int objectEnd = text.lastIndexOf('}');
                if (objectStart != -1 && objectEnd != -1 && objectEnd > objectStart) {
                    String potential = text.substring(objectStart, objectEnd + 1);
                    if (potential.contains("actionItems") || potential.contains("timelineEvents")) {
                        jsonBlock = potential;
                    }
                }
            }

            if (jsonBlock == null) {
                return false;
            }

            // Parse the JSON
            Map<String, Object> data = objectMapper.readValue(jsonBlock, new TypeReference<>() {});

            boolean hasData = false;

            // Extract action items from JSON
            Object actionItemsObj = data.get("actionItems");
            if (actionItemsObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> items = (List<Map<String, Object>>) actionItemsObj;
                List<ActionItem> actionItems = new ArrayList<>();

                for (Map<String, Object> item : items) {
                    ActionItem actionItem = new ActionItem();
                    actionItem.setOrganizationId(orgId);
                    actionItem.setAnalysisId(analysisId);
                    actionItem.setDescription((String) item.get("description"));
                    actionItem.setPriority((String) item.getOrDefault("priority", "MEDIUM"));
                    actionItem.setStatus("PENDING");
                    actionItem.setRelatedSection((String) item.get("relatedSection"));

                    // Parse deadline
                    Object deadlineObj = item.get("deadline");
                    if (deadlineObj != null && !deadlineObj.toString().equals("null")) {
                        try {
                            actionItem.setDeadline(LocalDate.parse(deadlineObj.toString()));
                        } catch (DateTimeParseException e) {
                            log.debug("Failed to parse deadline: {}", deadlineObj);
                        }
                    }

                    actionItems.add(actionItem);
                }

                if (!actionItems.isEmpty()) {
                    actionItemRepository.saveAll(actionItems);
                    log.info("Saved {} action items (JSON) for analysis {}", actionItems.size(), analysisId);
                    hasData = true;
                }
            }

            // Extract timeline events from JSON
            Object timelineEventsObj = data.get("timelineEvents");
            if (timelineEventsObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> events = (List<Map<String, Object>>) timelineEventsObj;
                List<TimelineEvent> timelineEvents = new ArrayList<>();

                for (Map<String, Object> event : events) {
                    TimelineEvent timelineEvent = new TimelineEvent();
                    timelineEvent.setOrganizationId(orgId);
                    timelineEvent.setAnalysisId(analysisId);
                    timelineEvent.setTitle((String) event.get("title"));
                    timelineEvent.setEventType((String) event.getOrDefault("eventType", "DEADLINE"));
                    timelineEvent.setPriority((String) event.getOrDefault("priority", "MEDIUM"));
                    timelineEvent.setDescription((String) event.get("description"));
                    timelineEvent.setRelatedSection((String) event.get("relatedSection"));

                    // Parse event date
                    Object dateObj = event.get("eventDate");
                    if (dateObj != null) {
                        try {
                            timelineEvent.setEventDate(LocalDate.parse(dateObj.toString()));
                            timelineEvents.add(timelineEvent);
                        } catch (DateTimeParseException e) {
                            log.debug("Failed to parse event date: {}", dateObj);
                        }
                    }
                }

                if (!timelineEvents.isEmpty()) {
                    timelineEventRepository.saveAll(timelineEvents);
                    log.info("Saved {} timeline events (JSON) for analysis {}", timelineEvents.size(), analysisId);
                    hasData = true;
                }
            }

            return hasData;

        } catch (Exception e) {
            log.debug("Failed to parse embedded JSON: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Extract action items from analysis text
     * @param orgId Organization ID for tenant isolation
     */
    private List<ActionItem> extractActionItems(Long analysisId, String text, Long orgId) {
        List<ActionItem> items = new ArrayList<>();
        Set<String> seenDescriptions = new HashSet<>();

        // Look for ACTION TIMELINE sections first
        String actionSection = extractSection(text,
            "(?:ACTION\\s*TIMELINE|IMMEDIATE\\s*ACTIONS|ACTION\\s*ITEMS|RECOMMENDED\\s*ACTIONS|NEXT\\s*STEPS)");
        String textToSearch = actionSection != null ? actionSection : text;

        // Try checkbox patterns
        items.addAll(extractCheckboxItems(analysisId, textToSearch, seenDescriptions, orgId));

        // Try day-based patterns
        items.addAll(extractDayBasedItems(analysisId, textToSearch, seenDescriptions, orgId));

        // Try action verb patterns
        items.addAll(extractActionVerbItems(analysisId, textToSearch, seenDescriptions, orgId));

        // Deduplicate and limit
        return items.stream()
            .limit(20) // Max 20 action items
            .toList();
    }

    private List<ActionItem> extractCheckboxItems(Long analysisId, String text, Set<String> seen, Long orgId) {
        List<ActionItem> items = new ArrayList<>();
        Pattern pattern = ACTION_PATTERNS[0];
        Matcher matcher = pattern.matcher(text);

        while (matcher.find()) {
            String description = cleanDescription(matcher.group(1));
            if (description.length() > 10 && !seen.contains(description.toLowerCase())) {
                seen.add(description.toLowerCase());

                ActionItem item = new ActionItem();
                item.setOrganizationId(orgId);
                item.setAnalysisId(analysisId);
                item.setDescription(description);
                item.setPriority(detectPriority(description));
                item.setDeadline(extractDeadlineFromText(description));
                item.setStatus("PENDING");
                items.add(item);
            }
        }
        return items;
    }

    private List<ActionItem> extractDayBasedItems(Long analysisId, String text, Set<String> seen, Long orgId) {
        List<ActionItem> items = new ArrayList<>();
        Pattern pattern = ACTION_PATTERNS[1];
        Matcher matcher = pattern.matcher(text);

        LocalDate today = LocalDate.now();

        while (matcher.find()) {
            String dayRange = matcher.group(1);
            String description = cleanDescription(matcher.group(2));

            if (description.length() > 10 && !seen.contains(description.toLowerCase())) {
                seen.add(description.toLowerCase());

                ActionItem item = new ActionItem();
                item.setOrganizationId(orgId);
                item.setAnalysisId(analysisId);
                item.setDescription("Day " + dayRange + ": " + description);
                item.setRelatedSection("Action Timeline");
                item.setStatus("PENDING");

                // Calculate deadline based on day number
                try {
                    int firstDay = Integer.parseInt(dayRange.split("-")[0]);
                    item.setDeadline(today.plusDays(firstDay));
                    item.setPriority(firstDay <= 3 ? "HIGH" : (firstDay <= 7 ? "MEDIUM" : "LOW"));
                } catch (NumberFormatException e) {
                    item.setPriority("MEDIUM");
                }

                items.add(item);
            }
        }
        return items;
    }

    private List<ActionItem> extractActionVerbItems(Long analysisId, String text, Set<String> seen, Long orgId) {
        List<ActionItem> items = new ArrayList<>();
        Pattern pattern = ACTION_PATTERNS[2];
        Matcher matcher = pattern.matcher(text);

        while (matcher.find()) {
            String description = cleanDescription(matcher.group(1));
            if (description.length() > 15 && !seen.contains(description.toLowerCase())) {
                seen.add(description.toLowerCase());

                ActionItem item = new ActionItem();
                item.setOrganizationId(orgId);
                item.setAnalysisId(analysisId);
                item.setDescription(description);
                item.setPriority(detectPriority(description));
                item.setDeadline(extractDeadlineFromText(description));
                item.setStatus("PENDING");
                items.add(item);
            }
        }
        return items;
    }

    /**
     * Extract timeline events from analysis text
     * @param orgId Organization ID for tenant isolation
     */
    private List<TimelineEvent> extractTimelineEvents(Long analysisId, String text, Long orgId) {
        List<TimelineEvent> events = new ArrayList<>();
        Set<String> seenDates = new HashSet<>();

        // Look for timeline sections
        String timelineSection = extractSection(text,
            "(?:TIMELINE|KEY\\s*DATES|IMPORTANT\\s*DATES|DEADLINES|SCHEDULE|ACTION\\s*TIMELINE)");
        String textToSearch = timelineSection != null ? timelineSection : text;

        // Find all date mentions with context
        Pattern dateContextPattern = Pattern.compile(
            "([^.\\n]{0,100}?)(" + DATE_PATTERN.pattern() + ")([^.\\n]{0,150})",
            Pattern.CASE_INSENSITIVE
        );

        Matcher matcher = dateContextPattern.matcher(textToSearch);
        while (matcher.find()) {
            String before = matcher.group(1).trim();
            String dateStr = matcher.group(2);
            String after = matcher.group(3).trim();

            LocalDate date = parseDate(dateStr);
            if (date != null && !seenDates.contains(dateStr)) {
                seenDates.add(dateStr);

                TimelineEvent event = new TimelineEvent();
                event.setOrganizationId(orgId);
                event.setAnalysisId(analysisId);
                event.setEventDate(date);

                // Determine title and description from context
                String context = (before + " " + after).trim();
                event.setTitle(extractEventTitle(context, dateStr));
                event.setDescription(cleanDescription(context));
                event.setEventType(detectEventType(context));
                event.setPriority(detectPriority(context));

                events.add(event);
            }
        }

        // Also look for relative dates like "within 30 days"
        events.addAll(extractRelativeDateEvents(analysisId, textToSearch, seenDates, orgId));

        return events.stream()
            .limit(15) // Max 15 timeline events
            .sorted(Comparator.comparing(TimelineEvent::getEventDate))
            .toList();
    }

    private List<TimelineEvent> extractRelativeDateEvents(Long analysisId, String text, Set<String> seen, Long orgId) {
        List<TimelineEvent> events = new ArrayList<>();
        LocalDate today = LocalDate.now();

        // Pattern for "within X days" type expressions
        Pattern relativeDatePattern = Pattern.compile(
            "(?:within|in|after|before)\\s+(\\d+)\\s*(?:days?|weeks?|months?)\\s*(?:of|from)?[^.\\n]{0,100}",
            Pattern.CASE_INSENSITIVE
        );

        Matcher matcher = relativeDatePattern.matcher(text);
        while (matcher.find()) {
            String match = matcher.group();
            int amount = Integer.parseInt(matcher.group(1));

            LocalDate deadline;
            if (match.toLowerCase().contains("week")) {
                deadline = today.plusWeeks(amount);
            } else if (match.toLowerCase().contains("month")) {
                deadline = today.plusMonths(amount);
            } else {
                deadline = today.plusDays(amount);
            }

            String dateKey = deadline.toString();
            if (!seen.contains(dateKey)) {
                seen.add(dateKey);

                TimelineEvent event = new TimelineEvent();
                event.setOrganizationId(orgId);
                event.setAnalysisId(analysisId);
                event.setEventDate(deadline);
                event.setTitle("Deadline: " + match.substring(0, Math.min(50, match.length())));
                event.setDescription(cleanDescription(match));
                event.setEventType("DEADLINE");
                event.setPriority(amount <= 7 ? "HIGH" : "MEDIUM");
                events.add(event);
            }
        }

        return events;
    }

    /**
     * Extract a specific section from the analysis text
     */
    private String extractSection(String text, String sectionPattern) {
        Pattern pattern = Pattern.compile(
            "(?:##\\s*)?[^\\n]*?" + sectionPattern + "[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)",
            Pattern.CASE_INSENSITIVE
        );
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    /**
     * Parse a date string into LocalDate
     */
    private LocalDate parseDate(String dateStr) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(dateStr, formatter);
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }
        return null;
    }

    /**
     * Extract deadline date from description text
     */
    private LocalDate extractDeadlineFromText(String text) {
        Matcher dateMatcher = DATE_PATTERN.matcher(text);
        if (dateMatcher.find()) {
            return parseDate(dateMatcher.group());
        }
        return null;
    }

    /**
     * Detect priority from keywords in text
     */
    private String detectPriority(String text) {
        String lowerText = text.toLowerCase();
        for (Map.Entry<String, String> entry : PRIORITY_KEYWORDS.entrySet()) {
            if (lowerText.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return "MEDIUM";
    }

    /**
     * Detect event type from context
     */
    private String detectEventType(String context) {
        String lower = context.toLowerCase();
        if (lower.contains("hearing") || lower.contains("court") || lower.contains("trial")) {
            return "HEARING";
        }
        if (lower.contains("file") || lower.contains("submit") || lower.contains("filing")) {
            return "FILING";
        }
        if (lower.contains("deadline") || lower.contains("due") || lower.contains("respond")) {
            return "DEADLINE";
        }
        return "MILESTONE";
    }

    /**
     * Extract a short title from context
     */
    private String extractEventTitle(String context, String dateStr) {
        // Try to find action verbs or key phrases
        Pattern titlePattern = Pattern.compile(
            "(?:File|Submit|Response|Hearing|Deadline|Due|Motion|Discovery|Trial|Meeting|Review)\\s*[^,\\.]{0,40}",
            Pattern.CASE_INSENSITIVE
        );
        Matcher matcher = titlePattern.matcher(context);
        if (matcher.find()) {
            return matcher.group().trim();
        }

        // Fallback: use first 50 chars of context
        String title = context.length() > 50 ? context.substring(0, 50) + "..." : context;
        return title.isEmpty() ? "Event on " + dateStr : title;
    }

    /**
     * Clean and normalize description text
     */
    private String cleanDescription(String text) {
        return text
            .replaceAll("\\*\\*", "")  // Remove bold markers
            .replaceAll("\\*", "")     // Remove italic markers
            .replaceAll("\\s+", " ")   // Normalize whitespace
            .replaceAll("^[-*•]\\s*", "") // Remove leading bullets
            .trim();
    }
}
