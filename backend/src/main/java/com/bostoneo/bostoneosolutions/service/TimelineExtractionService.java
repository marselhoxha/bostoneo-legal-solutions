package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.CollectionDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Service for extracting timeline events from documents in a collection.
 * Uses AI to identify dates, events, deadlines across all documents and creates
 * a unified chronological timeline.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TimelineExtractionService {

    private final DocumentChunkRepository chunkRepository;
    private final CollectionDocumentRepository collectionDocumentRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    // Thread pool for parallel document processing (max 4 concurrent)
    private static final ExecutorService parallelExecutor = Executors.newFixedThreadPool(
            Math.min(4, Runtime.getRuntime().availableProcessors()));

    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("MMMM d, yyyy"),
            DateTimeFormatter.ofPattern("MMM d, yyyy"),
            DateTimeFormatter.ofPattern("d MMMM yyyy"),
            DateTimeFormatter.ofPattern("yyyy")
    );

    /**
     * Represents a timeline event extracted from documents.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelineEvent {
        private String date;              // ISO format date or "approximate" date
        private LocalDate parsedDate;     // Parsed date for sorting
        private String eventType;         // CONTRACT_SIGNED, DEADLINE, HEARING, FILING, etc.
        private String title;             // Short title
        private String description;       // Detailed description
        private Long documentId;
        private String documentName;
        private Integer pageNumber;       // If available
        private Integer chunkIndex;
        private String parties;           // Involved parties
        private boolean isApproximate;    // True if date is approximate
        private String importance;        // HIGH, MEDIUM, LOW
    }

    /**
     * Response object for timeline extraction.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelineExtractionResult {
        private List<TimelineEvent> events;
        private int totalDocuments;
        private int totalChunksAnalyzed;
        private long processingTimeMs;
        private String summary;
        private String dateRange;         // e.g., "Jan 2024 - Dec 2024"
    }

    /**
     * Extract timeline with caching support.
     * Results are cached for 4 hours to avoid redundant API calls.
     * Use invalidateTimelineCache() when collection documents change.
     *
     * @param collectionId The collection to analyze
     * @param eventTypes Optional list of specific event types to focus on (null = all types)
     * @return TimelineExtractionResult with extracted events
     */
    @Cacheable(value = "timeline_results",
            key = "#collectionId + '-' + (#eventTypes != null ? #eventTypes.hashCode() : 'all')",
            unless = "#result.events.isEmpty() && #result.summary.contains('Error')")
    public TimelineExtractionResult extractTimelineCached(Long collectionId, List<String> eventTypes) {
        log.info("Cache MISS for timeline extraction - running analysis for collection {}", collectionId);
        return extractTimeline(collectionId, eventTypes).join();
    }

    /**
     * Invalidate timeline cache for a collection.
     * Call this when documents are added/removed from the collection.
     */
    @CacheEvict(value = "timeline_results", allEntries = true)
    public void invalidateTimelineCache(Long collectionId) {
        log.info("Invalidated timeline cache for collection {}", collectionId);
    }

    /**
     * Extract timeline events from all documents in a collection.
     *
     * @param collectionId The collection to analyze
     * @param eventTypes Optional list of specific event types to focus on (null = all types)
     * @return TimelineExtractionResult with extracted events
     */
    public CompletableFuture<TimelineExtractionResult> extractTimeline(Long collectionId, List<String> eventTypes) {
        long startTime = System.currentTimeMillis();
        log.info("Starting timeline extraction for collection {}, eventTypes: {}", collectionId, eventTypes);

        // Get all analysis IDs in the collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);
        if (analysisIds.isEmpty()) {
            log.warn("Collection {} has no documents", collectionId);
            return CompletableFuture.completedFuture(TimelineExtractionResult.builder()
                    .events(new ArrayList<>())
                    .totalDocuments(0)
                    .totalChunksAnalyzed(0)
                    .processingTimeMs(System.currentTimeMillis() - startTime)
                    .summary("No documents in collection.")
                    .build());
        }

        // Get all chunks for the collection
        List<DocumentChunk> allChunks = chunkRepository.findByAnalysisIdIn(analysisIds);
        log.info("Found {} chunks across {} documents", allChunks.size(), analysisIds.size());

        // Build document name map for citations
        Map<Long, String> documentNames = new HashMap<>();
        for (Long analysisId : analysisIds) {
            analysisRepository.findById(analysisId).ifPresent(analysis ->
                    documentNames.put(analysisId, analysis.getFileName()));
        }

        // Build context for AI analysis
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("DOCUMENTS IN COLLECTION:\n\n");

        for (Long analysisId : analysisIds) {
            String docName = documentNames.getOrDefault(analysisId, "Document " + analysisId);
            List<DocumentChunk> docChunks = allChunks.stream()
                    .filter(c -> c.getAnalysisId().equals(analysisId))
                    .sorted(Comparator.comparing(DocumentChunk::getChunkIndex))
                    .collect(Collectors.toList());

            contextBuilder.append("=== ").append(docName).append(" (ID: ").append(analysisId).append(") ===\n");
            for (DocumentChunk chunk : docChunks) {
                String sectionInfo = chunk.getSectionTitle() != null ?
                        " [Section: " + chunk.getSectionTitle() + "]" : "";
                contextBuilder.append("[Chunk ").append(chunk.getChunkIndex()).append(sectionInfo).append("]\n");
                contextBuilder.append(chunk.getContent()).append("\n\n");
            }
            contextBuilder.append("\n");
        }

        // Build the prompt
        String systemMessage = buildTimelineSystemMessage(eventTypes);
        String userPrompt = buildTimelineUserPrompt(contextBuilder.toString(), eventTypes);

        // Call AI to extract timeline
        return claudeService.generateCompletion(userPrompt, systemMessage, false)
                .thenApply(response -> {
                    List<TimelineEvent> events = parseTimelineFromResponse(response, documentNames);

                    // Sort by date
                    events.sort((a, b) -> {
                        if (a.getParsedDate() == null && b.getParsedDate() == null) return 0;
                        if (a.getParsedDate() == null) return 1;
                        if (b.getParsedDate() == null) return -1;
                        return a.getParsedDate().compareTo(b.getParsedDate());
                    });

                    long elapsed = System.currentTimeMillis() - startTime;

                    log.info("Timeline extraction complete: {} events found in {}ms",
                            events.size(), elapsed);

                    // Generate summary and date range
                    String summary = generateSummary(events, analysisIds.size());
                    String dateRange = calculateDateRange(events);

                    return TimelineExtractionResult.builder()
                            .events(events)
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(allChunks.size())
                            .processingTimeMs(elapsed)
                            .summary(summary)
                            .dateRange(dateRange)
                            .build();
                })
                .exceptionally(e -> {
                    log.error("Timeline extraction failed for collection {}", collectionId, e);
                    return TimelineExtractionResult.builder()
                            .events(new ArrayList<>())
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(allChunks.size())
                            .processingTimeMs(System.currentTimeMillis() - startTime)
                            .summary("Error extracting timeline: " + e.getMessage())
                            .build();
                });
    }

    /**
     * Extract timeline events from documents in parallel.
     * Each document is processed separately, then results are merged.
     * Better for large collections with many documents.
     *
     * @param collectionId The collection to analyze
     * @param eventTypes Optional list of specific event types to focus on (null = all types)
     * @return TimelineExtractionResult with extracted events
     */
    public CompletableFuture<TimelineExtractionResult> extractTimelineParallel(Long collectionId, List<String> eventTypes) {
        long startTime = System.currentTimeMillis();
        log.info("Starting PARALLEL timeline extraction for collection {}, eventTypes: {}", collectionId, eventTypes);

        // Get all analysis IDs in the collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);
        if (analysisIds.isEmpty()) {
            log.warn("Collection {} has no documents", collectionId);
            return CompletableFuture.completedFuture(TimelineExtractionResult.builder()
                    .events(new ArrayList<>())
                    .totalDocuments(0)
                    .totalChunksAnalyzed(0)
                    .processingTimeMs(System.currentTimeMillis() - startTime)
                    .summary("No documents in collection.")
                    .build());
        }

        // Build document name map
        Map<Long, String> documentNames = new HashMap<>();
        for (Long analysisId : analysisIds) {
            analysisRepository.findById(analysisId).ifPresent(analysis ->
                    documentNames.put(analysisId, analysis.getFileName()));
        }

        // Get all chunks for counting
        List<DocumentChunk> allChunks = chunkRepository.findByAnalysisIdIn(analysisIds);
        int totalChunks = allChunks.size();

        log.info("Processing {} documents in parallel", analysisIds.size());

        // Process each document in parallel
        List<CompletableFuture<List<TimelineEvent>>> documentFutures = new ArrayList<>();

        for (Long analysisId : analysisIds) {
            CompletableFuture<List<TimelineEvent>> docFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return extractTimelineFromDocument(analysisId, documentNames.get(analysisId), eventTypes);
                } catch (Exception e) {
                    log.error("Failed to extract timeline from document {}", analysisId, e);
                    return new ArrayList<TimelineEvent>();
                }
            }, parallelExecutor);

            documentFutures.add(docFuture);
        }

        // Combine all results
        return CompletableFuture.allOf(documentFutures.toArray(new CompletableFuture[0]))
                .thenApply(v -> {
                    List<TimelineEvent> allEvents = new ArrayList<>();

                    for (CompletableFuture<List<TimelineEvent>> future : documentFutures) {
                        try {
                            allEvents.addAll(future.join());
                        } catch (Exception e) {
                            log.warn("Failed to get events from document future", e);
                        }
                    }

                    // Sort by date
                    allEvents.sort((a, b) -> {
                        if (a.getParsedDate() == null && b.getParsedDate() == null) return 0;
                        if (a.getParsedDate() == null) return 1;
                        if (b.getParsedDate() == null) return -1;
                        return a.getParsedDate().compareTo(b.getParsedDate());
                    });

                    // Deduplicate similar events (same date + similar title)
                    List<TimelineEvent> deduplicatedEvents = deduplicateEvents(allEvents);

                    long elapsed = System.currentTimeMillis() - startTime;
                    log.info("Parallel timeline extraction complete: {} events (deduped from {}) in {}ms",
                            deduplicatedEvents.size(), allEvents.size(), elapsed);

                    String summary = generateSummary(deduplicatedEvents, analysisIds.size());
                    String dateRange = calculateDateRange(deduplicatedEvents);

                    return TimelineExtractionResult.builder()
                            .events(deduplicatedEvents)
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(totalChunks)
                            .processingTimeMs(elapsed)
                            .summary(summary)
                            .dateRange(dateRange)
                            .build();
                })
                .exceptionally(e -> {
                    log.error("Parallel timeline extraction failed for collection {}", collectionId, e);
                    return TimelineExtractionResult.builder()
                            .events(new ArrayList<>())
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(totalChunks)
                            .processingTimeMs(System.currentTimeMillis() - startTime)
                            .summary("Error extracting timeline: " + e.getMessage())
                            .build();
                });
    }

    /**
     * Extract timeline events from a single document.
     */
    private List<TimelineEvent> extractTimelineFromDocument(Long analysisId, String documentName, List<String> eventTypes) {
        List<DocumentChunk> chunks = chunkRepository.findByAnalysisIdOrderByChunkIndexAsc(analysisId);
        if (chunks.isEmpty()) {
            return new ArrayList<>();
        }

        // Build context for this document
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("DOCUMENT: ").append(documentName != null ? documentName : "Document " + analysisId)
                .append(" (ID: ").append(analysisId).append(")\n\n");

        for (DocumentChunk chunk : chunks) {
            String sectionInfo = chunk.getSectionTitle() != null ?
                    " [Section: " + chunk.getSectionTitle() + "]" : "";
            contextBuilder.append("[Chunk ").append(chunk.getChunkIndex()).append(sectionInfo).append("]\n");
            contextBuilder.append(chunk.getContent()).append("\n\n");
        }

        String systemMessage = buildTimelineSystemMessage(eventTypes);
        String userPrompt = buildTimelineUserPrompt(contextBuilder.toString(), eventTypes);

        try {
            String response = claudeService.generateCompletion(userPrompt, systemMessage, false).join();
            Map<Long, String> docNames = new HashMap<>();
            docNames.put(analysisId, documentName);
            return parseTimelineFromResponse(response, docNames);
        } catch (Exception e) {
            log.error("Failed to extract timeline from document {}", analysisId, e);
            return new ArrayList<>();
        }
    }

    /**
     * Deduplicate similar timeline events.
     * Events with same date and similar titles are merged.
     */
    private List<TimelineEvent> deduplicateEvents(List<TimelineEvent> events) {
        if (events.size() <= 1) {
            return events;
        }

        List<TimelineEvent> deduped = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();

        for (TimelineEvent event : events) {
            // Create a key based on date + normalized title
            String dateKey = event.getParsedDate() != null ? event.getParsedDate().toString() : event.getDate();
            String titleKey = event.getTitle() != null ? event.getTitle().toLowerCase().replaceAll("\\s+", " ").trim() : "";
            String key = dateKey + "|" + titleKey;

            if (!seenKeys.contains(key)) {
                seenKeys.add(key);
                deduped.add(event);
            } else {
                log.debug("Deduplicating event: {} on {}", event.getTitle(), event.getDate());
            }
        }

        return deduped;
    }

    /**
     * Build system message for timeline extraction.
     * Enhanced with legal document expertise and precise extraction guidance.
     */
    private String buildTimelineSystemMessage(List<String> eventTypes) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            You are an expert legal chronologist specializing in reconstructing case timelines from legal documents.
            Your task is to extract every date, deadline, and time-bound event with precision.

            ## EXTRACTION PRINCIPLES:

            1. **Comprehensive**: Extract ALL dates mentioned, no matter how minor they seem
            2. **Precise**: Use exact dates when available (YYYY-MM-DD format)
            3. **Contextual**: Include context explaining why each date matters
            4. **Source-linked**: Always reference the document and chunk where found

            ## EVENT CATEGORIES:

            **Legal Proceedings (Usually HIGH importance)**
            - HEARING: Court appearances, hearings, trials, depositions
            - FILING: Complaints, motions, briefs, pleadings
            - DISCOVERY: Discovery deadlines, interrogatory responses
            - JUDGMENT: Orders, decisions, verdicts, rulings

            **Contract Events**
            - CONTRACT_SIGNED: Execution dates of agreements
            - EFFECTIVE_DATE: When terms become operative
            - AMENDMENT: Modifications, addenda, supplements
            - TERMINATION: End dates, notice periods, expiration
            - RENEWAL: Renewal dates, extension periods

            **Obligations & Deadlines (Usually HIGH importance)**
            - DEADLINE: Any deadline for action
            - PAYMENT: Payment due dates, installment dates
            - PERFORMANCE: Performance milestones, delivery dates
            - NOTICE: Notice requirements, cure periods

            **Events & Incidents**
            - BREACH: Alleged or actual breach events
            - INCIDENT: Accidents, injuries, occurrences at issue
            - COMMUNICATION: Important letters, emails, calls
            - MEETING: Meetings, negotiations, discussions

            **Other**
            - MILESTONE: Project or case milestones
            - BACKGROUND: Historical dates providing context
            - OTHER: Any other significant dated event

            ## IMPORTANCE ASSESSMENT:

            **HIGH** - Critical to case outcome:
            - Statute of limitations dates
            - Court-imposed deadlines
            - Payment/performance deadlines
            - Dates of alleged misconduct
            - Upcoming hearings or trials

            **MEDIUM** - Significant but not critical:
            - Notice dates
            - Amendment effective dates
            - Meeting dates
            - Milestone completions

            **LOW** - Background/reference:
            - Historical dates
            - Document creation dates
            - Reference dates in examples

            ## OUTPUT FORMAT:

            Return a JSON array. Each event:
            {
                "date": "YYYY-MM-DD" or "approximately YYYY" or "Q1 2024" or "early/mid/late YYYY",
                "eventType": "TYPE from categories above",
                "title": "Brief, clear title (max 60 chars)",
                "description": "Full context: what happened, why it matters, who was involved",
                "documentId": <document ID from context>,
                "chunkIndex": <chunk index from context>,
                "parties": "Parties involved if mentioned",
                "isApproximate": true/false,
                "importance": "HIGH|MEDIUM|LOW"
            }

            ## SPECIAL INSTRUCTIONS:

            - For recurring events (monthly payments), extract the pattern as one event
            - For date ranges, extract both start and end as separate events
            - If a date is referenced multiple times, use the most detailed reference
            - Flag any conflicting dates with a note in the description
            - Include future dates (upcoming deadlines, scheduled events)
            - For approximate dates, set isApproximate: true

            Return empty array [] if no events found.
            """);

        if (eventTypes != null && !eventTypes.isEmpty()) {
            sb.append("\n\nFOCUS ON THESE EVENT TYPES: ").append(String.join(", ", eventTypes));
        }

        return sb.toString();
    }

    /**
     * Build user prompt for timeline extraction.
     */
    private String buildTimelineUserPrompt(String context, List<String> eventTypes) {
        StringBuilder sb = new StringBuilder();
        sb.append("Please extract all dates and events from the following documents");

        if (eventTypes != null && !eventTypes.isEmpty()) {
            sb.append(", focusing on: ").append(String.join(", ", eventTypes));
        }

        sb.append(".\n\n");
        sb.append(context);
        sb.append("\n\nRespond with a JSON array of timeline events. If none found, respond with [].");

        return sb.toString();
    }

    /**
     * Parse AI response to extract timeline events.
     */
    private List<TimelineEvent> parseTimelineFromResponse(String response, Map<Long, String> documentNames) {
        List<TimelineEvent> events = new ArrayList<>();

        try {
            // Extract JSON from response
            String jsonStr = extractJsonFromResponse(response);

            List<Map<String, Object>> parsed = objectMapper.readValue(
                    jsonStr, new TypeReference<List<Map<String, Object>>>() {});

            for (Map<String, Object> item : parsed) {
                try {
                    Long docId = item.get("documentId") != null ?
                            ((Number) item.get("documentId")).longValue() : null;

                    String dateStr = (String) item.get("date");
                    LocalDate parsedDate = parseDate(dateStr);
                    boolean isApproximate = item.get("isApproximate") != null ?
                            (Boolean) item.get("isApproximate") :
                            (dateStr != null && dateStr.toLowerCase().contains("approx"));

                    TimelineEvent event = TimelineEvent.builder()
                            .date(dateStr)
                            .parsedDate(parsedDate)
                            .eventType((String) item.get("eventType"))
                            .title((String) item.get("title"))
                            .description((String) item.get("description"))
                            .documentId(docId)
                            .documentName(docId != null ? documentNames.get(docId) : null)
                            .chunkIndex(item.get("chunkIndex") != null ?
                                    ((Number) item.get("chunkIndex")).intValue() : null)
                            .parties((String) item.get("parties"))
                            .isApproximate(isApproximate)
                            .importance((String) item.get("importance"))
                            .build();

                    events.add(event);
                } catch (Exception e) {
                    log.warn("Failed to parse timeline event: {}", item, e);
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse timeline from AI response: {}", response, e);
        }

        return events;
    }

    /**
     * Parse date string to LocalDate.
     */
    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return null;
        }

        // Clean up the date string
        String cleaned = dateStr.trim()
                .replaceAll("(?i)approximately\\s*", "")
                .replaceAll("(?i)early\\s*", "")
                .replaceAll("(?i)mid\\s*", "")
                .replaceAll("(?i)late\\s*", "")
                .replaceAll("(?i)around\\s*", "")
                .trim();

        // Try each formatter
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(cleaned, formatter);
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }

        // Try to extract just the year
        if (cleaned.matches(".*\\d{4}.*")) {
            String yearStr = cleaned.replaceAll(".*?(\\d{4}).*", "$1");
            try {
                int year = Integer.parseInt(yearStr);
                return LocalDate.of(year, 1, 1);
            } catch (NumberFormatException e) {
                // Ignore
            }
        }

        log.debug("Could not parse date: {}", dateStr);
        return null;
    }

    /**
     * Extract JSON from AI response (handles markdown code blocks).
     */
    private String extractJsonFromResponse(String response) {
        // Try to extract from markdown code block
        if (response.contains("```json")) {
            int start = response.indexOf("```json") + 7;
            int end = response.indexOf("```", start);
            if (end > start) {
                return response.substring(start, end).trim();
            }
        }

        if (response.contains("```")) {
            int start = response.indexOf("```") + 3;
            int end = response.indexOf("```", start);
            if (end > start) {
                return response.substring(start, end).trim();
            }
        }

        // Try to find JSON array directly
        int arrStart = response.indexOf('[');
        int arrEnd = response.lastIndexOf(']');
        if (arrStart >= 0 && arrEnd > arrStart) {
            return response.substring(arrStart, arrEnd + 1);
        }

        return response.trim();
    }

    /**
     * Generate summary of extracted timeline.
     */
    private String generateSummary(List<TimelineEvent> events, int totalDocuments) {
        if (events.isEmpty()) {
            return "No timeline events extracted from " + totalDocuments + " documents.";
        }

        long highCount = events.stream().filter(e -> "HIGH".equalsIgnoreCase(e.getImportance())).count();
        long deadlineCount = events.stream().filter(e -> "DEADLINE".equalsIgnoreCase(e.getEventType())).count();
        long hearingCount = events.stream().filter(e -> "HEARING".equalsIgnoreCase(e.getEventType())).count();

        StringBuilder sb = new StringBuilder();
        sb.append("Extracted ").append(events.size()).append(" event(s) from ")
                .append(totalDocuments).append(" documents");

        List<String> highlights = new ArrayList<>();
        if (highCount > 0) highlights.add(highCount + " high importance");
        if (deadlineCount > 0) highlights.add(deadlineCount + " deadlines");
        if (hearingCount > 0) highlights.add(hearingCount + " hearings");

        if (!highlights.isEmpty()) {
            sb.append(" including ").append(String.join(", ", highlights));
        }

        sb.append(".");

        return sb.toString();
    }

    /**
     * Calculate the date range covered by events.
     */
    private String calculateDateRange(List<TimelineEvent> events) {
        List<LocalDate> dates = events.stream()
                .map(TimelineEvent::getParsedDate)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());

        if (dates.isEmpty()) {
            return "No dates available";
        }

        LocalDate earliest = dates.get(0);
        LocalDate latest = dates.get(dates.size() - 1);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM yyyy");
        return earliest.format(formatter) + " - " + latest.format(formatter);
    }
}
