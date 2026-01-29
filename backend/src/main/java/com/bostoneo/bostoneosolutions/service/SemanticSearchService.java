package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.CollectionDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for semantic search across documents and collections.
 * Combines embedding-based search with keyword fallback.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SemanticSearchService {

    private final DocumentChunkingService chunkingService;
    private final EmbeddingService embeddingService;
    private final DocumentChunkRepository chunkRepository;
    private final CollectionDocumentRepository collectionDocumentRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final CollectionSearchCacheService cacheService;
    private final LegalSynonymService synonymService;
    private final SearchSuggestionService suggestionService;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Response wrapper for collection search with caching metadata.
     */
    @Data
    @Builder
    public static class CollectionSearchResponse {
        private List<SearchResult> results;
        private String expandedQuery;
        private boolean fromCache;
        private int totalResults;
        private long processingTimeMs;
    }

    /**
     * Search result with relevance score and context.
     */
    public static class SearchResult {
        public Long chunkId;
        public Long analysisId;
        public String content;
        public String sectionTitle;
        public int chunkIndex;
        public double score;
        public String highlightedContent;
        public String sourceDocument;
        public String sourceDocumentType;

        public SearchResult() {}
    }

    /**
     * Search within a single document.
     */
    public List<SearchResult> searchDocument(Long analysisId, String query, int maxResults) {
        log.info("Searching document: analysisId={}, query={}", analysisId, query);
        Long orgId = getRequiredOrganizationId();

        // Ensure document is chunked
        if (!chunkingService.isDocumentChunked(analysisId)) {
            chunkingService.chunkDocument(analysisId);
        }

        // SECURITY: Use tenant-filtered query
        List<DocumentChunk> chunks = chunkRepository.findByAnalysisIdAndOrganizationIdOrderByChunkIndexAsc(analysisId, orgId);
        return searchChunks(chunks, query, maxResults);
    }

    /**
     * Search across all documents in a collection (basic version).
     */
    public List<SearchResult> searchCollection(Long collectionId, String query, int maxResults) {
        log.info("Searching collection: collectionId={}, query={}", collectionId, query);
        Long orgId = getRequiredOrganizationId();

        // Get all analysis IDs in the collection - SECURITY: Use tenant-filtered query
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionIdAndOrganizationId(orgId, collectionId);
        if (analysisIds.isEmpty()) {
            return new ArrayList<>();
        }

        // Ensure all documents are chunked
        for (Long analysisId : analysisIds) {
            if (!chunkingService.isDocumentChunked(analysisId)) {
                chunkingService.chunkDocument(analysisId);

                // Update collection ID for new chunks
                chunkRepository.updateCollectionIdByAnalysisId(collectionId, analysisId);
            }
        }

        // SECURITY: Use tenant-filtered queries
        List<DocumentChunk> chunks = chunkRepository.findByCollectionIdAndOrganizationIdAndEmbeddingIsNotNull(collectionId, orgId);

        // If no chunks with embeddings, get all chunks
        if (chunks.isEmpty()) {
            chunks = chunkRepository.findByAnalysisIdInAndOrganizationId(analysisIds, orgId);
        }

        return searchChunks(chunks, query, maxResults);
    }

    /**
     * Enhanced collection search with caching and synonym expansion.
     * This is the primary method to use for collection Q&A.
     *
     * @param collectionId Collection to search
     * @param query User's search query
     * @param userId User performing the search (for personalized caching)
     * @param maxResults Maximum results to return
     * @return CollectionSearchResponse with results and metadata
     */
    public CollectionSearchResponse searchCollectionWithCache(Long collectionId, String query, Long userId, int maxResults) {
        long startTime = System.currentTimeMillis();
        log.info("Enhanced search: collectionId={}, query='{}', userId={}", collectionId, query, userId);

        // 1. Check cache first
        Optional<CollectionSearchCacheService.CachedSearchResult> cached =
                cacheService.getCachedResults(collectionId, query, userId);

        if (cached.isPresent()) {
            CollectionSearchCacheService.CachedSearchResult cacheHit = cached.get();

            // Convert cached results back to SearchResult objects
            List<SearchResult> results = convertCachedResults(cacheHit.results());

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("Cache HIT: {} results in {}ms", results.size(), elapsed);

            return CollectionSearchResponse.builder()
                    .results(results)
                    .expandedQuery(cacheHit.expandedQuery())
                    .fromCache(true)
                    .totalResults(results.size())
                    .processingTimeMs(elapsed)
                    .build();
        }

        // 2. Cache miss - expand query with legal synonyms
        String expandedQuery = synonymService.expandQueryWithSynonyms(query);
        log.info("Query expanded: '{}' -> '{}'", query, expandedQuery);

        // 3. Perform semantic search
        List<SearchResult> results = searchCollection(collectionId, expandedQuery, maxResults);

        // 4. Cache results for future use
        List<Map<String, Object>> resultsForCache = convertResultsForCache(results);
        cacheService.cacheResults(collectionId, query, userId, resultsForCache, expandedQuery);

        // 5. Record search in history for suggestions
        suggestionService.recordSearch(collectionId, userId, query, results.size());

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("Search completed: {} results in {}ms (cache miss)", results.size(), elapsed);

        return CollectionSearchResponse.builder()
                .results(results)
                .expandedQuery(expandedQuery)
                .fromCache(false)
                .totalResults(results.size())
                .processingTimeMs(elapsed)
                .build();
    }

    /**
     * Convert search results to cacheable map format.
     */
    private List<Map<String, Object>> convertResultsForCache(List<SearchResult> results) {
        List<Map<String, Object>> cacheable = new ArrayList<>();
        for (SearchResult result : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("chunkId", result.chunkId);
            map.put("analysisId", result.analysisId);
            map.put("content", result.content);
            map.put("sectionTitle", result.sectionTitle);
            map.put("chunkIndex", result.chunkIndex);
            map.put("score", result.score);
            map.put("highlightedContent", result.highlightedContent);
            map.put("sourceDocument", result.sourceDocument);
            map.put("sourceDocumentType", result.sourceDocumentType);
            cacheable.add(map);
        }
        return cacheable;
    }

    /**
     * Convert cached map format back to SearchResult objects.
     */
    private List<SearchResult> convertCachedResults(List<Map<String, Object>> cached) {
        List<SearchResult> results = new ArrayList<>();
        for (Map<String, Object> map : cached) {
            SearchResult result = new SearchResult();
            result.chunkId = map.get("chunkId") != null ? ((Number) map.get("chunkId")).longValue() : null;
            result.analysisId = map.get("analysisId") != null ? ((Number) map.get("analysisId")).longValue() : null;
            result.content = (String) map.get("content");
            result.sectionTitle = (String) map.get("sectionTitle");
            result.chunkIndex = map.get("chunkIndex") != null ? ((Number) map.get("chunkIndex")).intValue() : 0;
            result.score = map.get("score") != null ? ((Number) map.get("score")).doubleValue() : 0.0;
            result.highlightedContent = (String) map.get("highlightedContent");
            result.sourceDocument = (String) map.get("sourceDocument");
            result.sourceDocumentType = (String) map.get("sourceDocumentType");
            results.add(result);
        }
        return results;
    }

    /**
     * Search chunks using embeddings or keyword fallback.
     */
    private List<SearchResult> searchChunks(List<DocumentChunk> chunks, String query, int maxResults) {
        if (chunks.isEmpty()) {
            log.warn("searchChunks called with empty chunks list");
            return new ArrayList<>();
        }

        log.info("Searching {} chunks for query: '{}'", chunks.size(), query);
        List<SearchResult> results;

        // Try semantic search first if embeddings are available
        if (embeddingService.isAvailable()) {
            results = semanticSearch(chunks, query);
            log.info("Semantic search returned {} results", results.size());

            // Fallback to keyword search if semantic search returns no results
            if (results.isEmpty()) {
                log.info("Semantic search returned no results, falling back to keyword search");
                results = keywordSearch(chunks, query);
                log.info("Keyword search returned {} results", results.size());
            }
        } else {
            // Fallback to keyword search when embeddings not available
            log.info("Embeddings not available, using keyword search");
            results = keywordSearch(chunks, query);
            log.info("Keyword search returned {} results", results.size());
        }

        // Sort by score and limit results
        results.sort((a, b) -> Double.compare(b.score, a.score));

        if (results.size() > maxResults) {
            results = results.subList(0, maxResults);
        }

        // Enrich with source document info
        enrichWithSourceInfo(results);

        return results;
    }

    /**
     * Semantic search using embeddings.
     * Threshold lowered to 0.15 for better recall on legal documents.
     */
    private List<SearchResult> semanticSearch(List<DocumentChunk> chunks, String query) {
        float[] queryEmbedding = embeddingService.generateQueryEmbedding(query);
        if (queryEmbedding == null) {
            log.warn("Failed to generate query embedding, will use keyword search");
            return new ArrayList<>(); // Return empty to trigger fallback
        }

        List<SearchResult> results = new ArrayList<>();
        int chunksWithEmbeddings = 0;
        double maxScore = 0.0;

        for (DocumentChunk chunk : chunks) {
            float[] chunkEmbedding = embeddingService.parseEmbedding(chunk.getEmbedding());
            if (chunkEmbedding == null) {
                continue;
            }
            chunksWithEmbeddings++;

            double score = embeddingService.cosineSimilarity(queryEmbedding, chunkEmbedding);
            maxScore = Math.max(maxScore, score);

            // Lowered threshold from 0.3 to 0.15 for better recall
            if (score >= 0.15) {
                SearchResult result = new SearchResult();
                result.chunkId = chunk.getId();
                result.analysisId = chunk.getAnalysisId();
                result.content = chunk.getContent();
                result.sectionTitle = chunk.getSectionTitle();
                result.chunkIndex = chunk.getChunkIndex();
                result.score = score;
                result.highlightedContent = highlightMatches(chunk.getContent(), query);
                results.add(result);
            }
        }

        log.info("Semantic search: {} chunks with embeddings, max score: {}, results above threshold: {}",
                chunksWithEmbeddings, String.format("%.3f", maxScore), results.size());

        return results;
    }

    /**
     * Keyword-based search fallback.
     * Filters out stop words for better relevance.
     */
    private List<SearchResult> keywordSearch(List<DocumentChunk> chunks, String query) {
        // Clean query: remove punctuation and split into words
        String cleanedQuery = query.toLowerCase().replaceAll("[^a-z0-9\\s]", "");
        String[] allKeywords = cleanedQuery.split("\\s+");

        // Filter keywords to exclude stop words
        List<String> meaningfulKeywords = new ArrayList<>();
        for (String kw : allKeywords) {
            if (kw.length() >= 3 && !STOP_WORDS.contains(kw)) {
                meaningfulKeywords.add(kw);
            }
        }

        if (meaningfulKeywords.isEmpty()) {
            log.info("No meaningful keywords after stop word filtering for query: '{}'", query);
            return new ArrayList<>();
        }

        log.info("Keyword search using {} meaningful keywords: {}", meaningfulKeywords.size(), meaningfulKeywords);
        List<SearchResult> results = new ArrayList<>();

        for (DocumentChunk chunk : chunks) {
            String contentLower = chunk.getContent().toLowerCase();

            // Calculate keyword match score
            int matchCount = 0;
            for (String keyword : meaningfulKeywords) {
                if (contentLower.contains(keyword)) {
                    matchCount++;
                }
            }

            if (matchCount > 0) {
                double score = (double) matchCount / meaningfulKeywords.size();

                // Boost score if section title matches
                if (chunk.getSectionTitle() != null) {
                    String titleLower = chunk.getSectionTitle().toLowerCase();
                    for (String keyword : meaningfulKeywords) {
                        if (titleLower.contains(keyword)) {
                            score += 0.2;
                        }
                    }
                }

                SearchResult result = new SearchResult();
                result.chunkId = chunk.getId();
                result.analysisId = chunk.getAnalysisId();
                result.content = chunk.getContent();
                result.sectionTitle = chunk.getSectionTitle();
                result.chunkIndex = chunk.getChunkIndex();
                result.score = Math.min(score, 1.0);
                result.highlightedContent = highlightMatches(chunk.getContent(), query);
                results.add(result);
            }
        }

        return results;
    }

    // Common English stop words to exclude from highlighting
    private static final Set<String> STOP_WORDS = Set.of(
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our",
        "out", "has", "have", "had", "what", "when", "where", "who", "which", "this", "that",
        "with", "from", "they", "been", "would", "there", "their", "will", "each", "about",
        "how", "its", "may", "were", "some", "these", "than", "other", "into", "any", "only"
    );

    /**
     * Highlight matching terms in content (excluding stop words).
     */
    private String highlightMatches(String content, String query) {
        if (content == null || query == null) {
            return content;
        }

        String[] keywords = query.toLowerCase().split("\\s+");
        String highlighted = content;

        for (String keyword : keywords) {
            // Only highlight keywords that are >= 3 chars AND not stop words
            if (keyword.length() >= 3 && !STOP_WORDS.contains(keyword)) {
                // Case-insensitive replacement with highlighting
                highlighted = highlighted.replaceAll(
                        "(?i)(" + java.util.regex.Pattern.quote(keyword) + ")",
                        "<mark>$1</mark>"
                );
            }
        }

        // Truncate to reasonable length with context
        if (highlighted.length() > 500) {
            int firstMatch = highlighted.indexOf("<mark>");
            if (firstMatch > 100) {
                highlighted = "..." + highlighted.substring(firstMatch - 50);
            }
            if (highlighted.length() > 500) {
                highlighted = highlighted.substring(0, 500) + "...";
            }
        }

        return highlighted;
    }

    /**
     * Enrich results with source document information.
     */
    private void enrichWithSourceInfo(List<SearchResult> results) {
        // Get unique analysis IDs
        Set<Long> analysisIds = results.stream()
                .map(r -> r.analysisId)
                .collect(Collectors.toSet());

        // Fetch document info - SECURITY: Use tenant-filtered query
        Long orgId = getRequiredOrganizationId();
        Map<Long, String[]> docInfo = new HashMap<>();
        for (Long analysisId : analysisIds) {
            analysisRepository.findByIdAndOrganizationId(analysisId, orgId).ifPresent(analysis -> {
                docInfo.put(analysisId, new String[]{
                        analysis.getFileName(),
                        analysis.getDetectedType()
                });
            });
        }

        // Enrich results
        for (SearchResult result : results) {
            String[] info = docInfo.get(result.analysisId);
            if (info != null) {
                result.sourceDocument = info[0];
                result.sourceDocumentType = info[1];
            }
        }
    }

    /**
     * Index a document (chunk + generate embeddings).
     */
    public void indexDocument(Long analysisId) {
        log.info("Indexing document: analysisId={}", analysisId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to check existing chunks
        List<DocumentChunk> existingChunks = chunkRepository.findByAnalysisIdAndOrganizationIdOrderByChunkIndexAsc(analysisId, orgId);
        boolean hasEmbeddings = existingChunks.stream()
                .anyMatch(chunk -> chunk.getEmbedding() != null && !chunk.getEmbedding().isEmpty());

        if (!existingChunks.isEmpty() && hasEmbeddings) {
            log.info("Document {} already has {} chunks with embeddings - using cached version",
                    analysisId, existingChunks.size());
            return; // Use cached chunks and embeddings
        }

        // No cached embeddings - chunk and generate
        log.info("No cached embeddings for document {} - generating new ones", analysisId);
        chunkingService.chunkDocument(analysisId);

        // Generate embeddings if API is available
        if (embeddingService.isAvailable()) {
            embeddingService.generateEmbeddingsForDocument(analysisId);
        }
    }

    /**
     * Force re-index a document (delete cached chunks and regenerate).
     * Use this when document content has changed.
     */
    public void reindexDocument(Long analysisId) {
        log.info("Force re-indexing document: analysisId={}", analysisId);
        Long orgId = getRequiredOrganizationId();

        // Delete existing chunks
        // SECURITY: Use tenant-filtered delete to prevent cross-org deletion
        chunkRepository.deleteByAnalysisIdAndOrganizationId(analysisId, orgId);

        // Chunk and generate fresh embeddings
        chunkingService.chunkDocument(analysisId);

        if (embeddingService.isAvailable()) {
            embeddingService.generateEmbeddingsForDocument(analysisId);
        }
    }

    /**
     * Index all documents in a collection.
     */
    public void indexCollection(Long collectionId) {
        log.info("Indexing collection: collectionId={}", collectionId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionIdAndOrganizationId(orgId, collectionId);
        for (Long analysisId : analysisIds) {
            indexDocument(analysisId);

            // Update collection ID for chunks
            chunkRepository.updateCollectionIdByAnalysisId(collectionId, analysisId);
        }
    }

    /**
     * Update collection ID for document chunks.
     */
    public void updateChunksCollectionId(Long collectionId, Long analysisId) {
        log.info("Updating collectionId={} for all chunks of analysisId={}", collectionId, analysisId);
        chunkRepository.updateCollectionIdByAnalysisId(collectionId, analysisId);
        log.info("Collection ID update complete for analysisId={}", analysisId);
    }
}
