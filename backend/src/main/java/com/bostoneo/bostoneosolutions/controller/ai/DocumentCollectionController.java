package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.CollectionDocument;
import com.bostoneo.bostoneosolutions.model.DocumentCollection;
import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.repository.CollectionDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentCollectionRepository;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
}
