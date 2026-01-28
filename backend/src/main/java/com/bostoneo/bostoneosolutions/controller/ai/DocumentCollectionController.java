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
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * SECURITY: Get current authenticated user's ID - never use hardcoded defaults
     */
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                return ((UserDTO) principal).getId();
            } else if (principal instanceof UserPrincipal) {
                return ((UserPrincipal) principal).getUser().getId();
            }
        }
        throw new RuntimeException("Authentication required - could not determine current user");
    }

    /**
     * Get all collections for a user
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getCollections(
            @RequestParam(value = "userId", required = false) Long userId) {

        Long orgId = getRequiredOrganizationId();
        log.info("Fetching collections for organization {}", orgId);

        // SECURITY: Use tenant-filtered query
        List<DocumentCollection> collections = collectionRepository
                .findByOrganizationIdAndIsArchivedFalseOrderByUpdatedAtDesc(orgId);

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

        Long orgId = getRequiredOrganizationId();
        log.info("Creating collection '{}' for user {} in org {}", name, userId, orgId);

        DocumentCollection collection = new DocumentCollection();
        collection.setName(name.trim());
        collection.setDescription(description);
        collection.setUserId(userId);
        collection.setOrganizationId(orgId); // SECURITY: Set organization ID for tenant isolation
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
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching collection {} for org {}", collectionId, orgId);

        // SECURITY: Use tenant-filtered query
        return collectionRepository.findByIdAndOrganizationId(collectionId, orgId)
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

                                // SECURITY: Fetch analysis details with tenant filter
                                analysisRepository.findByIdAndOrganizationId(cd.getAnalysisId(), orgId).ifPresent(analysis -> {
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

        Long orgId = getRequiredOrganizationId();
        log.info("Updating collection {} for org {}", collectionId, orgId);

        // SECURITY: Use tenant-filtered query
        return collectionRepository.findByIdAndOrganizationId(collectionId, orgId)
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
        Long orgId = getRequiredOrganizationId();
        log.info("Archiving collection {} for org {}", collectionId, orgId);

        // SECURITY: Use tenant-filtered query
        return collectionRepository.findByIdAndOrganizationId(collectionId, orgId)
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

        Long orgId = getRequiredOrganizationId();
        log.info("Adding document {} to collection {} in org {}", analysisId, collectionId, orgId);

        // SECURITY: Check if collection exists and belongs to this organization
        DocumentCollection collection = collectionRepository.findByIdAndOrganizationId(collectionId, orgId).orElse(null);
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

        Long orgId = getRequiredOrganizationId();
        log.info("Removing document {} from collection {} in org {}", analysisId, collectionId, orgId);

        // SECURITY: Verify collection belongs to this organization before deletion
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
            return ResponseEntity.notFound().build();
        }

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
        Long orgId = getRequiredOrganizationId();
        log.info("Finding collections containing document {} for org {}", analysisId, orgId);

        List<Long> collectionIds = collectionDocumentRepository.findCollectionIdsByAnalysisId(analysisId);

        // SECURITY: Filter collections by organization to prevent cross-tenant data leakage
        // Instead of findAllById (which ignores org), fetch each with org filter
        List<DocumentCollection> collections = collectionIds.stream()
                .map(id -> collectionRepository.findByIdAndOrganizationId(id, orgId).orElse(null))
                .filter(c -> c != null && !c.getIsArchived())
                .collect(Collectors.toList());

        List<Map<String, Object>> collectionList = collections.stream()
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
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching aggregated timeline for collection {} in org {}", collectionId, orgId);

        // SECURITY: Verify collection belongs to this organization
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
            return ResponseEntity.notFound().build();
        }

        // Get all document analysis IDs in this collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);

        if (analysisIds.isEmpty()) {
            return ResponseEntity.ok(Map.of("events", List.of(), "count", 0));
        }

        // Note: Timeline events are already filtered by analysisId which belongs to verified collection
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

                    // SECURITY: Add source document info with tenant filter
                    analysisRepository.findByIdAndOrganizationId(event.getAnalysisId(), orgId).ifPresent(analysis -> {
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
        Long orgId = getRequiredOrganizationId();

        // Get all document analysis IDs in this collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);

        if (analysisIds.isEmpty()) {
            return ResponseEntity.ok(Map.of("actionItems", List.of(), "count", 0));
        }

        // SECURITY: Use org-filtered query
        List<ActionItem> items = actionItemRepository.findByOrganizationIdAndAnalysisIdInOrderByDeadlineAsc(orgId, analysisIds);

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

                    // SECURITY: Add source document info with tenant filter
                    analysisRepository.findByIdAndOrganizationId(item.getAnalysisId(), orgId).ifPresent(analysis -> {
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
            @RequestParam(defaultValue = "10") int maxResults) {

        Long orgId = getRequiredOrganizationId();
        // SECURITY: Always use authenticated user - never allow userId parameter override
        Long effectiveUserId = getCurrentUserId();
        log.info("Searching collection {} in org {}: query='{}', maxResults={}, userId={}",
                collectionId, orgId, query, maxResults, effectiveUserId);

        // SECURITY: Verify collection belongs to this organization before searching
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
            return ResponseEntity.notFound().build();
        }

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
            @RequestParam(value = "query", required = false, defaultValue = "") String query) {

        Long orgId = getRequiredOrganizationId();
        // SECURITY: Always use authenticated user - never allow userId parameter override
        Long effectiveUserId = getCurrentUserId();
        log.debug("Getting search suggestions for collection {} in org {}, query='{}', userId={}",
                collectionId, orgId, query, effectiveUserId);

        // SECURITY: Verify collection belongs to this organization
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
            return ResponseEntity.ok(List.of()); // Return empty for not found
        }

        List<Map<String, Object>> suggestions = searchSuggestionService.getSuggestions(
                collectionId, effectiveUserId, query);

        return ResponseEntity.ok(suggestions);
    }

    /**
     * Get document content for preview modal
     */
    @GetMapping("/documents/{analysisId}/content")
    public ResponseEntity<Map<String, Object>> getDocumentContent(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching document content for preview: analysisId={}, org={}", analysisId, orgId);

        // SECURITY: Use tenant-filtered query
        return analysisRepository.findByIdAndOrganizationId(analysisId, orgId)
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
        Long orgId = getRequiredOrganizationId();
        log.info("Indexing collection {} for org {}", collectionId, orgId);

        // SECURITY: Verify collection belongs to this organization before indexing
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
            return ResponseEntity.notFound().build();
        }

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

        // SECURITY: Verify collection exists and belongs to this organization
        Long orgId = getRequiredOrganizationId();
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
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

        Long orgId = getRequiredOrganizationId();
        log.info("Document comparison: collectionId={}, doc1={}, doc2={}, aspect={}, org={}",
                collectionId, doc1Id, doc2Id, aspect, orgId);

        // SECURITY: Verify collection belongs to this organization
        if (!collectionRepository.findByIdAndOrganizationId(collectionId, orgId).isPresent()) {
            return CompletableFuture.completedFuture(ResponseEntity.notFound().build());
        }

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

        Long orgId = getRequiredOrganizationId();
        log.info("Fetching relationships for document {} in org {}", analysisId, orgId);

        // SECURITY: Verify document belongs to this organization
        if (!analysisRepository.findByIdAndOrganizationId(analysisId, orgId).isPresent()) {
            return ResponseEntity.notFound().build();
        }

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

        Long orgId = getRequiredOrganizationId();
        log.info("Creating relationship: {} {} -> {} in org {}", relationshipType, sourceId, targetId, orgId);

        // SECURITY: Verify both documents belong to this organization
        if (!analysisRepository.findByIdAndOrganizationId(sourceId, orgId).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Source document not found or access denied"));
        }
        if (!analysisRepository.findByIdAndOrganizationId(targetId, orgId).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Target document not found or access denied"));
        }

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

        Long orgId = getRequiredOrganizationId();
        log.info("Deleting relationship {} for document {} in org {}", relationshipId, analysisId, orgId);

        // SECURITY: Verify document belongs to this organization before allowing relationship deletion
        if (!analysisRepository.findByIdAndOrganizationId(analysisId, orgId).isPresent()) {
            return ResponseEntity.notFound().build();
        }

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
