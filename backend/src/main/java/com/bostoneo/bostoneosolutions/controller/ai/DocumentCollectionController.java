package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.CollectionDocument;
import com.bostoneo.bostoneosolutions.model.DocumentCollection;
import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.repository.CollectionDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentCollectionRepository;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import com.bostoneo.bostoneosolutions.service.SemanticSearchService;
import com.bostoneo.bostoneosolutions.service.CollectionQAService;
import com.bostoneo.bostoneosolutions.service.CollectionSearchCacheService;
import com.bostoneo.bostoneosolutions.service.SearchSuggestionService;
import com.bostoneo.bostoneosolutions.service.DocumentRelationshipService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai/collections")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class DocumentCollectionController {

    private final DocumentCollectionRepository collectionRepository;
    private final CollectionDocumentRepository collectionDocumentRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final ActionItemRepository actionItemRepository;
    private final DocumentChunkRepository documentChunkRepository;
    private final SemanticSearchService semanticSearchService;
    private final CollectionQAService collectionQAService;
    private final CollectionSearchCacheService searchCacheService;
    private final SearchSuggestionService searchSuggestionService;
    private final DocumentRelationshipService relationshipService;

    /**
     * Get all collections for a user
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getCollections(
            @RequestParam(value = "userId", required = false) Long userId) {

        Long effectiveUserId = userId != null ? userId : 1L;
        log.info("Fetching collections for user {}", effectiveUserId);

        List<DocumentCollection> collections = collectionRepository
                .findByUserIdAndIsArchivedFalseOrderByUpdatedAtDesc(effectiveUserId);

        // Map to response format with document counts
        List<Map<String, Object>> collectionList = collections.stream()
                .map(this::mapCollectionToResponse)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("collections", collectionList);
        response.put("count", collectionList.size());

        return ResponseEntity.ok(response);
    }

    /**
     * Create a new collection
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createCollection(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        String description = (String) request.get("description");
        Long userId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;
        Long caseId = request.get("caseId") != null ? ((Number) request.get("caseId")).longValue() : null;
        String color = (String) request.getOrDefault("color", "#405189");
        String icon = (String) request.getOrDefault("icon", "ri-folder-line");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Collection name is required"));
        }

        log.info("Creating collection '{}' for user {}", name, userId);

        DocumentCollection collection = new DocumentCollection();
        collection.setName(name.trim());
        collection.setDescription(description);
        collection.setUserId(userId);
        collection.setCaseId(caseId);
        collection.setColor(color);
        collection.setIcon(icon);
        collection.setIsArchived(false);

        DocumentCollection saved = collectionRepository.save(collection);
        log.info("Created collection with ID: {}", saved.getId());

        return ResponseEntity.ok(mapCollectionToResponse(saved));
    }

    /**
     * Get a specific collection with its documents
     */
    @GetMapping("/{collectionId}")
    public ResponseEntity<Map<String, Object>> getCollection(@PathVariable Long collectionId) {
        log.info("Fetching collection {}", collectionId);

        return collectionRepository.findById(collectionId)
                .map(collection -> {
                    Map<String, Object> response = mapCollectionToResponse(collection);

                    // Add document details
                    List<CollectionDocument> collectionDocs = collectionDocumentRepository
                            .findByCollectionIdOrderByAddedAtDesc(collectionId);

                    List<Map<String, Object>> documents = collectionDocs.stream()
                            .map(cd -> {
                                Map<String, Object> docInfo = new HashMap<>();
                                docInfo.put("id", cd.getId());
                                docInfo.put("analysisId", cd.getAnalysisId());
                                docInfo.put("addedAt", cd.getAddedAt() != null ? cd.getAddedAt().toString() : null);
                                docInfo.put("notes", cd.getNotes());

                                // Fetch analysis details
                                analysisRepository.findById(cd.getAnalysisId()).ifPresent(analysis -> {
                                    docInfo.put("fileName", analysis.getFileName());
                                    docInfo.put("fileType", analysis.getFileType());
                                    docInfo.put("detectedType", analysis.getDetectedType());
                                    docInfo.put("status", analysis.getStatus());
                                    docInfo.put("createdAt", analysis.getCreatedAt() != null ? analysis.getCreatedAt().toString() : null);
                                });

                                return docInfo;
                            })
                            .collect(Collectors.toList());

                    response.put("documents", documents);
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Update a collection
     */
    @PutMapping("/{collectionId}")
    public ResponseEntity<Map<String, Object>> updateCollection(
            @PathVariable Long collectionId,
            @RequestBody Map<String, Object> request) {

        log.info("Updating collection {}", collectionId);

        return collectionRepository.findById(collectionId)
                .map(collection -> {
                    if (request.containsKey("name")) {
                        collection.setName((String) request.get("name"));
                    }
                    if (request.containsKey("description")) {
                        collection.setDescription((String) request.get("description"));
                    }
                    if (request.containsKey("caseId")) {
                        collection.setCaseId(request.get("caseId") != null ?
                                ((Number) request.get("caseId")).longValue() : null);
                    }
                    if (request.containsKey("color")) {
                        collection.setColor((String) request.get("color"));
                    }
                    if (request.containsKey("icon")) {
                        collection.setIcon((String) request.get("icon"));
                    }

                    DocumentCollection saved = collectionRepository.save(collection);
                    return ResponseEntity.ok(mapCollectionToResponse(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Delete a collection (soft delete - archive)
     */
    @DeleteMapping("/{collectionId}")
    public ResponseEntity<Map<String, Object>> deleteCollection(@PathVariable Long collectionId) {
        log.info("Archiving collection {}", collectionId);

        return collectionRepository.findById(collectionId)
                .map(collection -> {
                    collection.setIsArchived(true);
                    collectionRepository.save(collection);

                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("message", "Collection archived");
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Add a document to a collection
     */
    @PostMapping("/{collectionId}/documents")
    public ResponseEntity<Map<String, Object>> addDocumentToCollection(
            @PathVariable Long collectionId,
            @RequestBody Map<String, Object> request) {

        Long analysisId = ((Number) request.get("analysisId")).longValue();
        String notes = (String) request.get("notes");
        Long addedBy = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;

        log.info("Adding document {} to collection {}", analysisId, collectionId);

        // Check if collection exists
        DocumentCollection collection = collectionRepository.findById(collectionId).orElse(null);
        if (collection == null) {
            return ResponseEntity.notFound().build();
        }

        // Check if document is already in collection
        if (collectionDocumentRepository.existsByCollectionIdAndAnalysisId(collectionId, analysisId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Document already in collection"));
        }

        CollectionDocument collectionDoc = new CollectionDocument();
        collectionDoc.setCollection(collection);
        collectionDoc.setAnalysisId(analysisId);
        collectionDoc.setNotes(notes);
        collectionDoc.setAddedBy(addedBy);

        CollectionDocument saved = collectionDocumentRepository.save(collectionDoc);

        // Invalidate search cache since documents changed
        searchCacheService.invalidateCollectionCache(collectionId);

        // Trigger async indexing for semantic search
        final Long finalCollectionId = collectionId;
        final Long finalAnalysisId = analysisId;
        CompletableFuture.runAsync(() -> {
            try {
                log.info("Auto-indexing document {} for collection {}", finalAnalysisId, finalCollectionId);
                semanticSearchService.indexDocument(finalAnalysisId);
                // Update collection ID for the chunks
                semanticSearchService.updateChunksCollectionId(finalCollectionId, finalAnalysisId);
                log.info("Auto-indexing complete for document {}", finalAnalysisId);
            } catch (Exception e) {
                log.error("Failed to auto-index document {}: {}", finalAnalysisId, e.getMessage());
            }
        });

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("id", saved.getId());
        response.put("collectionId", collectionId);
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Remove a document from a collection
     */
    @DeleteMapping("/{collectionId}/documents/{analysisId}")
    public ResponseEntity<Map<String, Object>> removeDocumentFromCollection(
            @PathVariable Long collectionId,
            @PathVariable Long analysisId) {

        log.info("Removing document {} from collection {}", analysisId, collectionId);

        if (!collectionDocumentRepository.existsByCollectionIdAndAnalysisId(collectionId, analysisId)) {
            return ResponseEntity.notFound().build();
        }

        collectionDocumentRepository.deleteByCollectionIdAndAnalysisId(collectionId, analysisId);

        // Invalidate search cache since documents changed
        searchCacheService.invalidateCollectionCache(collectionId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("collectionId", collectionId);
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Get all collections containing a specific document
     */
    @GetMapping("/by-document/{analysisId}")
    public ResponseEntity<Map<String, Object>> getCollectionsForDocument(@PathVariable Long analysisId) {
        log.info("Finding collections containing document {}", analysisId);

        List<Long> collectionIds = collectionDocumentRepository.findCollectionIdsByAnalysisId(analysisId);
        List<DocumentCollection> collections = collectionRepository.findAllById(collectionIds);

        List<Map<String, Object>> collectionList = collections.stream()
                .filter(c -> !c.getIsArchived())
                .map(this::mapCollectionToResponse)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("collections", collectionList);
        response.put("count", collectionList.size());

        return ResponseEntity.ok(response);
    }

    /**
     * Get aggregated timeline events for all documents in a collection
     */
    @GetMapping("/{collectionId}/timeline")
    public ResponseEntity<Map<String, Object>> getAggregatedTimeline(@PathVariable Long collectionId) {
        log.info("Fetching aggregated timeline for collection {}", collectionId);

        // Get all document analysis IDs in this collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);

        if (analysisIds.isEmpty()) {
            return ResponseEntity.ok(Map.of("events", List.of(), "count", 0));
        }

        List<TimelineEvent> events = timelineEventRepository.findByAnalysisIdInOrderByEventDateAsc(analysisIds);

        // Map to response format with document source info
        List<Map<String, Object>> eventList = events.stream()
                .map(event -> {
                    Map<String, Object> eventMap = new HashMap<>();
                    eventMap.put("id", event.getId());
                    eventMap.put("analysisId", event.getAnalysisId());
                    eventMap.put("eventDate", event.getEventDate() != null ? event.getEventDate().toString() : null);
                    eventMap.put("eventType", event.getEventType());
                    eventMap.put("title", event.getTitle());
                    eventMap.put("description", event.getDescription());
                    eventMap.put("priority", event.getPriority());
                    eventMap.put("relatedSection", event.getRelatedSection());

                    // Add source document info
                    analysisRepository.findById(event.getAnalysisId()).ifPresent(analysis -> {
                        eventMap.put("sourceDocument", analysis.getFileName());
                        eventMap.put("sourceDocumentType", analysis.getDetectedType());
                    });

                    return eventMap;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("events", eventList);
        response.put("count", eventList.size());
        response.put("collectionId", collectionId);

        return ResponseEntity.ok(response);
    }

    /**
     * Get aggregated action items for all documents in a collection
     */
    @GetMapping("/{collectionId}/action-items")
    public ResponseEntity<Map<String, Object>> getAggregatedActionItems(@PathVariable Long collectionId) {
        log.info("Fetching aggregated action items for collection {}", collectionId);

        // Get all document analysis IDs in this collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);

        if (analysisIds.isEmpty()) {
            return ResponseEntity.ok(Map.of("actionItems", List.of(), "count", 0));
        }

        List<ActionItem> items = actionItemRepository.findByAnalysisIdInOrderByDeadlineAsc(analysisIds);

        // Map to response format with document source info
        List<Map<String, Object>> itemList = items.stream()
                .map(item -> {
                    Map<String, Object> itemMap = new HashMap<>();
                    itemMap.put("id", item.getId());
                    itemMap.put("analysisId", item.getAnalysisId());
                    itemMap.put("description", item.getDescription());
                    itemMap.put("priority", item.getPriority());
                    itemMap.put("status", item.getStatus());
                    itemMap.put("deadline", item.getDeadline() != null ? item.getDeadline().toString() : null);
                    itemMap.put("relatedSection", item.getRelatedSection());

                    // Add source document info
                    analysisRepository.findById(item.getAnalysisId()).ifPresent(analysis -> {
                        itemMap.put("sourceDocument", analysis.getFileName());
                        itemMap.put("sourceDocumentType", analysis.getDetectedType());
                    });

                    return itemMap;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("actionItems", itemList);
        response.put("count", itemList.size());
        response.put("collectionId", collectionId);

        return ResponseEntity.ok(response);
    }

    /**
     * Search across all documents in a collection (enhanced semantic search with caching)
     */
    @GetMapping("/{collectionId}/search")
    public ResponseEntity<Map<String, Object>> searchCollection(
            @PathVariable Long collectionId,
            @RequestParam String query,
            @RequestParam(defaultValue = "10") int maxResults,
            @RequestParam(value = "userId", required = false) Long userId) {

        Long effectiveUserId = userId != null ? userId : 1L;
        log.info("Searching collection {}: query='{}', maxResults={}, userId={}",
                collectionId, query, maxResults, effectiveUserId);

        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
        }

        try {
            // Use enhanced search with caching and synonym expansion
            SemanticSearchService.CollectionSearchResponse searchResponse =
                    semanticSearchService.searchCollectionWithCache(collectionId, query.trim(), effectiveUserId, maxResults);

            List<Map<String, Object>> resultList = searchResponse.getResults().stream()
                    .map(result -> {
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
                        return map;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> response = new HashMap<>();
            response.put("results", resultList);
            response.put("count", resultList.size());
            response.put("query", query);
            response.put("expandedQuery", searchResponse.getExpandedQuery());
            response.put("fromCache", searchResponse.isFromCache());
            response.put("processingTimeMs", searchResponse.getProcessingTimeMs());
            response.put("collectionId", collectionId);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Search failed for collection {}", collectionId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Search failed: " + e.getMessage()));
        }
    }

    /**
     * Get search suggestions for autocomplete
     */
    @GetMapping("/{collectionId}/search/suggestions")
    public ResponseEntity<List<Map<String, Object>>> getSearchSuggestions(
            @PathVariable Long collectionId,
            @RequestParam(value = "query", required = false, defaultValue = "") String query,
            @RequestParam(value = "userId", required = false) Long userId) {

        Long effectiveUserId = userId != null ? userId : 1L;
        log.debug("Getting search suggestions for collection {}, query='{}', userId={}",
                collectionId, query, effectiveUserId);

        List<Map<String, Object>> suggestions = searchSuggestionService.getSuggestions(
                collectionId, effectiveUserId, query);

        return ResponseEntity.ok(suggestions);
    }

    /**
     * Get document content for preview modal
     */
    @GetMapping("/documents/{analysisId}/content")
    public ResponseEntity<Map<String, Object>> getDocumentContent(@PathVariable Long analysisId) {
        log.info("Fetching document content for preview: analysisId={}", analysisId);

        return analysisRepository.findById(analysisId)
                .map(analysis -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("analysisId", analysisId);
                    response.put("fileName", analysis.getFileName());
                    response.put("fileType", analysis.getFileType());
                    response.put("detectedType", analysis.getDetectedType());
                    response.put("content", analysis.getDocumentContent());

                    // Add file URL for direct file access (for PDFs, images, etc.)
                    if (analysis.getFileName() != null) {
                        String fileUrl = "/api/files/serve/" + analysis.getFileName();
                        response.put("fileUrl", fileUrl);
                    }

                    // Get chunks for navigation
                    List<DocumentChunk> chunks = documentChunkRepository
                            .findByAnalysisIdOrderByChunkIndexAsc(analysisId);

                    List<Map<String, Object>> chunkList = chunks.stream()
                            .map(chunk -> {
                                Map<String, Object> chunkMap = new HashMap<>();
                                chunkMap.put("id", chunk.getId());
                                chunkMap.put("chunkIndex", chunk.getChunkIndex());
                                chunkMap.put("content", chunk.getContent());
                                chunkMap.put("sectionTitle", chunk.getSectionTitle());
                                return chunkMap;
                            })
                            .collect(Collectors.toList());

                    response.put("chunks", chunkList);
                    response.put("totalChunks", chunkList.size());

                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Index a collection for search (chunk and generate embeddings)
     */
    @PostMapping("/{collectionId}/index")
    public ResponseEntity<Map<String, Object>> indexCollection(@PathVariable Long collectionId) {
        log.info("Indexing collection {}", collectionId);

        try {
            semanticSearchService.indexCollection(collectionId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "collectionId", collectionId,
                    "message", "Collection indexed successfully"
            ));

        } catch (Exception e) {
            log.error("Failed to index collection {}", collectionId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Indexing failed: " + e.getMessage()));
        }
    }

    /**
     * Ask a question about all documents in a collection (Collection Q&A)
     * Uses RAG to retrieve relevant context and generate AI-powered answers
     */
    @PostMapping("/{collectionId}/ask")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> askCollection(
            @PathVariable Long collectionId,
            @RequestBody Map<String, Object> request) {

        String query = (String) request.get("query");
        Integer maxSources = request.get("maxSources") != null ?
                ((Number) request.get("maxSources")).intValue() : 10;

        log.info("Collection Q&A: collectionId={}, query='{}', maxSources={}", collectionId, query, maxSources);

        if (query == null || query.trim().isEmpty()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.badRequest().body(Map.of("error", "Query is required"))
            );
        }

        // Verify collection exists
        if (!collectionRepository.existsById(collectionId)) {
            return CompletableFuture.completedFuture(
                ResponseEntity.notFound().build()
            );
        }

        return collectionQAService.askQuestion(collectionId, query.trim(), maxSources)
            .thenApply(qaResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("answer", qaResponse.answer);
                response.put("sources", qaResponse.sources.stream()
                    .map(source -> {
                        Map<String, Object> sourceMap = new HashMap<>();
                        sourceMap.put("documentId", source.documentId);
                        sourceMap.put("documentName", source.documentName);
                        sourceMap.put("documentType", source.documentType);
                        sourceMap.put("sectionTitle", source.sectionTitle);
                        sourceMap.put("excerpt", source.excerpt);
                        sourceMap.put("chunkId", source.chunkId);
                        sourceMap.put("relevanceScore", source.relevanceScore);
                        return sourceMap;
                    })
                    .collect(Collectors.toList()));
                response.put("processingTimeMs", qaResponse.processingTimeMs);
                response.put("query", query);
                response.put("collectionId", collectionId);

                return ResponseEntity.ok(response);
            })
            .exceptionally(e -> {
                log.error("Collection Q&A failed for collection {}", collectionId, e);
                return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Q&A failed: " + e.getMessage()));
            });
    }

    /**
     * Compare two documents in a collection
     */
    @PostMapping("/{collectionId}/compare")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> compareDocuments(
            @PathVariable Long collectionId,
            @RequestBody Map<String, Object> request) {

        Long doc1Id = ((Number) request.get("document1Id")).longValue();
        Long doc2Id = ((Number) request.get("document2Id")).longValue();
        String aspect = (String) request.get("aspect");

        log.info("Document comparison: collectionId={}, doc1={}, doc2={}, aspect={}",
                collectionId, doc1Id, doc2Id, aspect);

        return collectionQAService.compareDocuments(collectionId, doc1Id, doc2Id, aspect)
            .thenApply(qaResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("comparison", qaResponse.answer);
                response.put("sources", qaResponse.sources.stream()
                    .map(source -> {
                        Map<String, Object> sourceMap = new HashMap<>();
                        sourceMap.put("documentId", source.documentId);
                        sourceMap.put("documentName", source.documentName);
                        sourceMap.put("sectionTitle", source.sectionTitle);
                        sourceMap.put("excerpt", source.excerpt);
                        return sourceMap;
                    })
                    .collect(Collectors.toList()));
                response.put("processingTimeMs", qaResponse.processingTimeMs);

                return ResponseEntity.ok(response);
            })
            .exceptionally(e -> {
                log.error("Document comparison failed", e);
                return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Comparison failed: " + e.getMessage()));
            });
    }

    /**
     * Helper method to map collection entity to response format
     */
    private Map<String, Object> mapCollectionToResponse(DocumentCollection collection) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", collection.getId());
        map.put("name", collection.getName());
        map.put("description", collection.getDescription());
        map.put("userId", collection.getUserId());
        map.put("caseId", collection.getCaseId());
        map.put("color", collection.getColor());
        map.put("icon", collection.getIcon());
        map.put("createdAt", collection.getCreatedAt() != null ? collection.getCreatedAt().toString() : null);
        map.put("updatedAt", collection.getUpdatedAt() != null ? collection.getUpdatedAt().toString() : null);
        map.put("documentCount", collectionDocumentRepository.countByCollectionId(collection.getId()));
        return map;
    }

    // ==========================================
    // Document Relationship Endpoints
    // ==========================================

    /**
     * Get all relationships for a document
     */
    @GetMapping("/documents/{analysisId}/relationships")
    public ResponseEntity<Map<String, Object>> getDocumentRelationships(
            @PathVariable Long analysisId) {

        log.info("Fetching relationships for document {}", analysisId);

        try {
            List<Map<String, Object>> relationships = relationshipService.getRelationshipsWithDetails(analysisId);

            Map<String, Object> response = new HashMap<>();
            response.put("analysisId", analysisId);
            response.put("relationships", relationships);
            response.put("count", relationships.size());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to fetch relationships", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to fetch relationships: " + e.getMessage()));
        }
    }

    /**
     * Create a relationship between two documents
     */
    @PostMapping("/documents/{sourceId}/relationships")
    public ResponseEntity<Map<String, Object>> createRelationship(
            @PathVariable Long sourceId,
            @RequestBody Map<String, Object> request) {

        Long targetId = ((Number) request.get("targetAnalysisId")).longValue();
        String relationshipType = (String) request.get("relationshipType");
        String description = (String) request.get("description");
        Long userId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;

        log.info("Creating relationship: {} {} -> {}", relationshipType, sourceId, targetId);

        try {
            var relationship = relationshipService.createRelationship(
                    sourceId, targetId, relationshipType, description, userId);

            Map<String, Object> response = new HashMap<>();
            response.put("id", relationship.getId());
            response.put("sourceAnalysisId", relationship.getSourceAnalysisId());
            response.put("targetAnalysisId", relationship.getTargetAnalysisId());
            response.put("relationshipType", relationship.getRelationshipType());
            response.put("description", relationship.getDescription());
            response.put("createdAt", relationship.getCreatedAt().toString());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to create relationship", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to create relationship: " + e.getMessage()));
        }
    }

    /**
     * Delete a relationship
     */
    @DeleteMapping("/documents/{analysisId}/relationships/{relationshipId}")
    public ResponseEntity<Map<String, Object>> deleteRelationship(
            @PathVariable Long analysisId,
            @PathVariable Long relationshipId) {

        log.info("Deleting relationship {} for document {}", relationshipId, analysisId);

        try {
            relationshipService.deleteRelationship(relationshipId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Relationship deleted"));
        } catch (Exception e) {
            log.error("Failed to delete relationship", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to delete relationship: " + e.getMessage()));
        }
    }

    /**
     * Get relationship types
     */
    @GetMapping("/relationship-types")
    public ResponseEntity<List<Map<String, String>>> getRelationshipTypes() {
        List<Map<String, String>> types = List.of(
                Map.of("id", "RESPONDS_TO", "label", "Responds To", "description", "This document responds to another (e.g., Answer to Complaint)"),
                Map.of("id", "AMENDS", "label", "Amends", "description", "This document modifies another (e.g., Amendment to Contract)"),
                Map.of("id", "SUPERSEDES", "label", "Supersedes", "description", "This document replaces another (e.g., New Agreement replaces Old)"),
                Map.of("id", "REFERENCES", "label", "References", "description", "This document cites or mentions another"),
                Map.of("id", "EXHIBITS", "label", "Is Exhibit To", "description", "This document is attached as an exhibit to another")
        );
        return ResponseEntity.ok(types);
    }
}
