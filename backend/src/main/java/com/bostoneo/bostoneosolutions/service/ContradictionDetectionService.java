package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.CollectionDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
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

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Service for detecting contradictions across documents in a collection.
 * Uses AI to identify conflicting statements between different documents.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ContradictionDetectionService {

    private final DocumentChunkRepository chunkRepository;
    private final CollectionDocumentRepository collectionDocumentRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final ClaudeSonnet4Service claudeService;
    private final SemanticSearchService semanticSearchService;
    private final ObjectMapper objectMapper;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // Executor for parallel document processing
    private static final ExecutorService parallelExecutor = Executors.newFixedThreadPool(
            Math.min(4, Runtime.getRuntime().availableProcessors())
    );

    // Threshold for switching to parallel processing
    private static final int PARALLEL_THRESHOLD_CHUNKS = 20;

    /**
     * Represents a detected contradiction between two documents.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Contradiction {
        private String topic;
        private String statement1;
        private String statement2;
        private Long document1Id;
        private String document1Name;
        private Long document2Id;
        private String document2Name;
        private String severity; // HIGH, MEDIUM, LOW
        private String category; // FACTUAL, TIMELINE, PARTY_ROLE, LEGAL, TESTIMONY, MINOR
        private String explanation;
        private String suggestedQuestion; // For deposition prep
        private Integer chunk1Index;
        private Integer chunk2Index;
    }

    /**
     * Response object for contradiction detection.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContradictionDetectionResult {
        private List<Contradiction> contradictions;
        private int totalDocuments;
        private int totalChunksAnalyzed;
        private long processingTimeMs;
        private String summary;
    }

    /**
     * Detect contradictions with caching support.
     * Results are cached for 4 hours to avoid redundant API calls.
     * Use invalidateContradictionCache() when collection documents change.
     *
     * @param collectionId The collection to analyze
     * @param topics Optional list of specific topics to focus on (null = analyze all)
     * @return ContradictionDetectionResult with found contradictions
     */
    @Cacheable(value = "contradiction_results",
            key = "T(com.bostoneo.bostoneosolutions.multitenancy.TenantContext).getCurrentTenant() + '-' + #collectionId + '-' + (#topics != null ? #topics.hashCode() : 'all')",
            unless = "#result.contradictions.isEmpty() && #result.summary.contains('Error')")
    public ContradictionDetectionResult detectContradictionsCached(Long collectionId, List<String> topics) {
        // SECURITY: Include organization ID in cache key to prevent cross-tenant cache leakage
        log.info("Cache MISS for contradiction detection - running analysis for collection {}", collectionId);
        return detectContradictions(collectionId, topics).join();
    }

    /**
     * Invalidate contradiction cache for a collection.
     * Call this when documents are added/removed from the collection.
     */
    @CacheEvict(value = "contradiction_results", allEntries = true)
    public void invalidateContradictionCache(Long collectionId) {
        log.info("Invalidated contradiction cache for collection {}", collectionId);
    }

    /**
     * Detect contradictions across all documents in a collection.
     *
     * @param collectionId The collection to analyze
     * @param topics Optional list of specific topics to focus on (null = analyze all)
     * @return ContradictionDetectionResult with found contradictions
     */
    public CompletableFuture<ContradictionDetectionResult> detectContradictions(Long collectionId, List<String> topics) {
        long startTime = System.currentTimeMillis();
        // SECURITY: Get org context BEFORE fetching data
        Long orgId = getRequiredOrganizationId();
        log.info("Starting contradiction detection for collection {}, topics: {}", collectionId, topics);

        // Get all analysis IDs in the collection - SECURITY: Use tenant-filtered query
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionIdAndOrganizationId(orgId, collectionId);
        if (analysisIds.size() < 2) {
            log.warn("Collection {} has fewer than 2 documents - cannot detect contradictions", collectionId);
            return CompletableFuture.completedFuture(ContradictionDetectionResult.builder()
                    .contradictions(new ArrayList<>())
                    .totalDocuments(analysisIds.size())
                    .totalChunksAnalyzed(0)
                    .processingTimeMs(System.currentTimeMillis() - startTime)
                    .summary("At least 2 documents are required to detect contradictions.")
                    .build());
        }

        // Get all chunks for the collection - SECURITY: Use tenant-filtered query
        List<DocumentChunk> allChunks = chunkRepository.findByAnalysisIdInAndOrganizationId(analysisIds, orgId);
        log.info("Found {} chunks across {} documents", allChunks.size(), analysisIds.size());

        // Build document name map for citations
        Map<Long, String> documentNames = new HashMap<>();
        for (Long analysisId : analysisIds) {
            analysisRepository.findByIdAndOrganizationId(analysisId, orgId).ifPresent(analysis ->
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
        String systemMessage = buildContradictionSystemMessage(topics);
        String userPrompt = buildContradictionUserPrompt(contextBuilder.toString(), topics);

        // Call AI to detect contradictions
        return claudeService.generateCompletion(userPrompt, systemMessage, false)
                .thenApply(response -> {
                    List<Contradiction> contradictions = parseContradictionsFromResponse(response, documentNames);
                    long elapsed = System.currentTimeMillis() - startTime;

                    log.info("Contradiction detection complete: {} contradictions found in {}ms",
                            contradictions.size(), elapsed);

                    // Generate summary
                    String summary = generateSummary(contradictions, analysisIds.size());

                    return ContradictionDetectionResult.builder()
                            .contradictions(contradictions)
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(allChunks.size())
                            .processingTimeMs(elapsed)
                            .summary(summary)
                            .build();
                })
                .exceptionally(e -> {
                    log.error("Contradiction detection failed for collection {}", collectionId, e);
                    return ContradictionDetectionResult.builder()
                            .contradictions(new ArrayList<>())
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(allChunks.size())
                            .processingTimeMs(System.currentTimeMillis() - startTime)
                            .summary("Error detecting contradictions: " + e.getMessage())
                            .build();
                });
    }

    /**
     * Build system message for contradiction detection.
     * Enhanced with legal document expertise and structured analysis.
     */
    private String buildContradictionSystemMessage(List<String> topics) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            You are an expert legal document analyst with extensive experience in litigation support,
            specializing in identifying contradictions and inconsistencies between legal documents.

            ## Analysis Strategy
            Use a systematic two-phase approach:

            PHASE 1 - Identify Potential Contradictions:
            - Scan for factual assertions about dates, times, amounts, parties, events
            - Note all claims about the same subject matter across documents
            - Flag any statements that could potentially conflict

            PHASE 2 - Validate and Classify:
            - Verify each potential contradiction is actually inconsistent (not just different wording)
            - Consider context - apparent contradictions may be about different things
            - Classify by type and severity
            - Craft deposition questions that could expose the truth

            ## CONTRADICTION CATEGORIES:

            1. FACTUAL CONTRADICTIONS (Usually HIGH severity)
               - Conflicting dates for the same event
               - Different amounts, durations, or quantities
               - Contradictory descriptions of the same incident
               - Opposing claims about who did what

            2. TIMELINE INCONSISTENCIES (HIGH to MEDIUM)
               - Events described in conflicting order
               - Impossible timing (event B before event A when A caused B)
               - Different accounts of sequence of events

            3. PARTY/ROLE CONFLICTS (MEDIUM to HIGH)
               - Inconsistent identification of parties
               - Conflicting descriptions of someone's role or authority
               - Different accounts of who was present/involved

            4. LEGAL/CONTRACTUAL CONFLICTS (HIGH)
               - Contradictory terms or conditions
               - Conflicting obligations or rights
               - Inconsistent definitions of the same term

            5. TESTIMONY INCONSISTENCIES (HIGH)
               - Same witness saying different things
               - Direct conflicts between witness accounts
               - Statements that contradict documentary evidence

            6. MINOR DISCREPANCIES (LOW)
               - Spelling variations that don't affect meaning
               - Minor date/time approximations
               - Stylistic differences

            ## SEVERITY ASSESSMENT:
            - HIGH: Would significantly impact case outcome. Direct factual conflict. Clear dishonesty indicator.
            - MEDIUM: Requires clarification. Could have innocent explanation but needs investigation.
            - LOW: Minor discrepancy. Likely clerical or memory error. Doesn't affect core issues.

            ## OUTPUT FORMAT:
            You MUST respond with valid JSON array. Each contradiction should be:
            {
                "topic": "Brief topic name (e.g., 'Meeting Date', 'Contract Price', 'Incident Description')",
                "statement1": "Exact quote or close paraphrase from first document",
                "document1Id": <numeric ID from context>,
                "chunk1Index": <chunk number from context>,
                "statement2": "Exact quote or close paraphrase from second document",
                "document2Id": <numeric ID from context>,
                "chunk2Index": <chunk number from context>,
                "severity": "HIGH|MEDIUM|LOW",
                "category": "FACTUAL|TIMELINE|PARTY_ROLE|LEGAL|TESTIMONY|MINOR",
                "explanation": "Clear explanation of why this is a contradiction and its legal significance",
                "suggestedQuestion": "Strategic deposition question to probe this contradiction"
            }

            ## DEPOSITION QUESTION GUIDELINES:
            - Be specific and reference the conflicting facts
            - Use open-ended questions when possible
            - Consider follow-up questions to pin down the witness
            - Frame questions to prevent evasion

            If no contradictions found, return empty array: []
            """);

        if (topics != null && !topics.isEmpty()) {
            sb.append("\n\nPRIORITY FOCUS AREAS: ").append(String.join(", ", topics));
            sb.append("\nPay special attention to these topics when identifying contradictions.");
        }

        return sb.toString();
    }

    /**
     * Build user prompt for contradiction detection.
     */
    private String buildContradictionUserPrompt(String context, List<String> topics) {
        StringBuilder sb = new StringBuilder();
        sb.append("Please analyze the following documents for contradictions");

        if (topics != null && !topics.isEmpty()) {
            sb.append(", focusing on: ").append(String.join(", ", topics));
        }

        sb.append(".\n\n");
        sb.append(context);
        sb.append("\n\nRespond with a JSON array of contradictions found. If none found, respond with [].");

        return sb.toString();
    }

    /**
     * Parse AI response to extract contradictions.
     */
    private List<Contradiction> parseContradictionsFromResponse(String response, Map<Long, String> documentNames) {
        List<Contradiction> contradictions = new ArrayList<>();

        try {
            // Extract JSON from response (it might be wrapped in markdown code blocks)
            String jsonStr = extractJsonFromResponse(response);

            List<Map<String, Object>> parsed = objectMapper.readValue(
                    jsonStr, new TypeReference<List<Map<String, Object>>>() {});

            for (Map<String, Object> item : parsed) {
                try {
                    Long doc1Id = item.get("document1Id") != null ?
                            ((Number) item.get("document1Id")).longValue() : null;
                    Long doc2Id = item.get("document2Id") != null ?
                            ((Number) item.get("document2Id")).longValue() : null;

                    Contradiction c = Contradiction.builder()
                            .topic((String) item.get("topic"))
                            .statement1((String) item.get("statement1"))
                            .statement2((String) item.get("statement2"))
                            .document1Id(doc1Id)
                            .document1Name(doc1Id != null ? documentNames.get(doc1Id) : null)
                            .document2Id(doc2Id)
                            .document2Name(doc2Id != null ? documentNames.get(doc2Id) : null)
                            .severity((String) item.get("severity"))
                            .category((String) item.get("category"))
                            .explanation((String) item.get("explanation"))
                            .suggestedQuestion((String) item.get("suggestedQuestion"))
                            .chunk1Index(item.get("chunk1Index") != null ?
                                    ((Number) item.get("chunk1Index")).intValue() : null)
                            .chunk2Index(item.get("chunk2Index") != null ?
                                    ((Number) item.get("chunk2Index")).intValue() : null)
                            .build();

                    contradictions.add(c);
                } catch (Exception e) {
                    log.warn("Failed to parse contradiction item: {}", item, e);
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse contradictions from AI response: {}", response, e);
        }

        // Sort by severity (HIGH first)
        contradictions.sort((a, b) -> {
            int severityOrder = getSeverityOrder(a.getSeverity()) - getSeverityOrder(b.getSeverity());
            return severityOrder;
        });

        return contradictions;
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
     * Get numeric order for severity (for sorting).
     */
    private int getSeverityOrder(String severity) {
        if (severity == null) return 99;
        return switch (severity.toUpperCase()) {
            case "HIGH" -> 1;
            case "MEDIUM" -> 2;
            case "LOW" -> 3;
            default -> 99;
        };
    }

    /**
     * Detect contradictions using parallel processing for large collections.
     * Compares documents in pairs concurrently for faster processing.
     *
     * @param collectionId The collection to analyze
     * @param topics Optional list of specific topics to focus on
     * @return ContradictionDetectionResult with found contradictions
     */
    public CompletableFuture<ContradictionDetectionResult> detectContradictionsParallel(Long collectionId, List<String> topics) {
        long startTime = System.currentTimeMillis();
        // SECURITY: Get org context BEFORE fetching data
        Long orgIdForNames = getRequiredOrganizationId();
        log.info("Starting PARALLEL contradiction detection for collection {}", collectionId);

        // Get all analysis IDs in the collection - SECURITY: Use tenant-filtered query
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionIdAndOrganizationId(orgIdForNames, collectionId);
        if (analysisIds.size() < 2) {
            return CompletableFuture.completedFuture(ContradictionDetectionResult.builder()
                    .contradictions(new ArrayList<>())
                    .totalDocuments(analysisIds.size())
                    .totalChunksAnalyzed(0)
                    .processingTimeMs(System.currentTimeMillis() - startTime)
                    .summary("At least 2 documents are required to detect contradictions.")
                    .build());
        }

        // Build document name map - SECURITY: Use tenant-filtered query
        Map<Long, String> documentNames = new HashMap<>();
        for (Long analysisId : analysisIds) {
            analysisRepository.findByIdAndOrganizationId(analysisId, orgIdForNames).ifPresent(analysis ->
                    documentNames.put(analysisId, analysis.getFileName()));
        }

        // Get chunks grouped by document - SECURITY: Use tenant-filtered query
        Map<Long, List<DocumentChunk>> chunksByDocument = new HashMap<>();
        int totalChunks = 0;
        for (Long analysisId : analysisIds) {
            List<DocumentChunk> chunks = chunkRepository.findByAnalysisIdAndOrganizationIdOrderByChunkIndexAsc(analysisId, orgIdForNames);
            chunksByDocument.put(analysisId, chunks);
            totalChunks += chunks.size();
        }

        log.info("Processing {} documents with {} total chunks in parallel", analysisIds.size(), totalChunks);

        // Generate all unique document pairs
        List<long[]> documentPairs = new ArrayList<>();
        for (int i = 0; i < analysisIds.size(); i++) {
            for (int j = i + 1; j < analysisIds.size(); j++) {
                documentPairs.add(new long[]{analysisIds.get(i), analysisIds.get(j)});
            }
        }

        log.info("Generated {} document pairs for parallel comparison", documentPairs.size());

        // Process pairs in parallel (max 3 concurrent to avoid rate limiting)
        // SECURITY: Capture org ID to pass to async tasks (ThreadLocal context is lost in executor)
        final Long capturedOrgId = orgIdForNames;
        List<CompletableFuture<List<Contradiction>>> pairFutures = new ArrayList<>();
        int batchSize = 3;

        for (int i = 0; i < documentPairs.size(); i += batchSize) {
            List<long[]> batch = documentPairs.subList(i, Math.min(i + batchSize, documentPairs.size()));

            for (long[] pair : batch) {
                CompletableFuture<List<Contradiction>> pairFuture = CompletableFuture.supplyAsync(() -> {
                    try {
                        // SECURITY: Set tenant context in async thread
                        TenantContext.setCurrentTenant(capturedOrgId);
                        return compareDocumentPair(
                                pair[0], pair[1],
                                chunksByDocument.get(pair[0]),
                                chunksByDocument.get(pair[1]),
                                documentNames,
                                topics
                        ).join();
                    } catch (Exception e) {
                        log.error("Failed to compare documents {} and {}", pair[0], pair[1], e);
                        return new ArrayList<Contradiction>();
                    } finally {
                        // SECURITY: Clear tenant context after async execution
                        TenantContext.clear();
                    }
                }, parallelExecutor);

                pairFutures.add(pairFuture);
            }
        }

        // Wait for all pairs and collect results
        final int finalTotalChunks = totalChunks;
        return CompletableFuture.allOf(pairFutures.toArray(new CompletableFuture[0]))
                .thenApply(v -> {
                    List<Contradiction> allContradictions = new ArrayList<>();

                    for (CompletableFuture<List<Contradiction>> future : pairFutures) {
                        try {
                            allContradictions.addAll(future.get());
                        } catch (Exception e) {
                            log.error("Error collecting contradiction results", e);
                        }
                    }

                    // Sort by severity
                    allContradictions.sort((a, b) ->
                            getSeverityOrder(a.getSeverity()) - getSeverityOrder(b.getSeverity()));

                    long elapsed = System.currentTimeMillis() - startTime;
                    log.info("Parallel contradiction detection complete: {} contradictions in {}ms",
                            allContradictions.size(), elapsed);

                    return ContradictionDetectionResult.builder()
                            .contradictions(allContradictions)
                            .totalDocuments(analysisIds.size())
                            .totalChunksAnalyzed(finalTotalChunks)
                            .processingTimeMs(elapsed)
                            .summary(generateSummary(allContradictions, analysisIds.size()))
                            .build();
                });
    }

    /**
     * Compare a specific pair of documents for contradictions.
     */
    private CompletableFuture<List<Contradiction>> compareDocumentPair(
            Long doc1Id, Long doc2Id,
            List<DocumentChunk> doc1Chunks, List<DocumentChunk> doc2Chunks,
            Map<Long, String> documentNames,
            List<String> topics) {

        String doc1Name = documentNames.getOrDefault(doc1Id, "Document " + doc1Id);
        String doc2Name = documentNames.getOrDefault(doc2Id, "Document " + doc2Id);

        log.debug("Comparing {} vs {}", doc1Name, doc2Name);

        // Build focused context for just these two documents
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("=== ").append(doc1Name).append(" (ID: ").append(doc1Id).append(") ===\n");
        for (DocumentChunk chunk : doc1Chunks) {
            String sectionInfo = chunk.getSectionTitle() != null ?
                    " [Section: " + chunk.getSectionTitle() + "]" : "";
            contextBuilder.append("[Chunk ").append(chunk.getChunkIndex()).append(sectionInfo).append("]\n");
            contextBuilder.append(chunk.getContent()).append("\n\n");
        }

        contextBuilder.append("\n=== ").append(doc2Name).append(" (ID: ").append(doc2Id).append(") ===\n");
        for (DocumentChunk chunk : doc2Chunks) {
            String sectionInfo = chunk.getSectionTitle() != null ?
                    " [Section: " + chunk.getSectionTitle() + "]" : "";
            contextBuilder.append("[Chunk ").append(chunk.getChunkIndex()).append(sectionInfo).append("]\n");
            contextBuilder.append(chunk.getContent()).append("\n\n");
        }

        String systemMessage = buildContradictionSystemMessage(topics);
        String userPrompt = "Compare these two documents and identify any contradictions:\n\n" +
                contextBuilder.toString() +
                "\n\nRespond with a JSON array of contradictions. If none found, respond with [].";

        return claudeService.generateCompletion(userPrompt, systemMessage, false)
                .thenApply(response -> parseContradictionsFromResponse(response, documentNames));
    }

    /**
     * Generate summary of contradictions found.
     */
    private String generateSummary(List<Contradiction> contradictions, int totalDocuments) {
        if (contradictions.isEmpty()) {
            return "No contradictions detected across " + totalDocuments + " documents.";
        }

        long highCount = contradictions.stream().filter(c -> "HIGH".equalsIgnoreCase(c.getSeverity())).count();
        long mediumCount = contradictions.stream().filter(c -> "MEDIUM".equalsIgnoreCase(c.getSeverity())).count();
        long lowCount = contradictions.stream().filter(c -> "LOW".equalsIgnoreCase(c.getSeverity())).count();

        StringBuilder sb = new StringBuilder();
        sb.append("Found ").append(contradictions.size()).append(" contradiction(s) across ")
                .append(totalDocuments).append(" documents: ");

        List<String> parts = new ArrayList<>();
        if (highCount > 0) parts.add(highCount + " HIGH severity");
        if (mediumCount > 0) parts.add(mediumCount + " MEDIUM severity");
        if (lowCount > 0) parts.add(lowCount + " LOW severity");

        sb.append(String.join(", ", parts));

        if (highCount > 0) {
            sb.append(". ⚠️ High severity contradictions require immediate attention.");
        }

        return sb.toString();
    }
}
