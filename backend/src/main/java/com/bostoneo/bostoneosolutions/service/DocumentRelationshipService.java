package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.model.DocumentRelationship;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentRelationshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentRelationshipService {

    private final DocumentRelationshipRepository relationshipRepository;
    private final AIDocumentAnalysisRepository analysisRepository;

    /**
     * Create a new relationship between two documents
     */
    @Transactional
    public DocumentRelationship createRelationship(Long sourceAnalysisId, Long targetAnalysisId,
                                                    String relationshipType, String description, Long userId) {
        // Validate documents exist
        if (!analysisRepository.existsById(sourceAnalysisId)) {
            throw new IllegalArgumentException("Source document not found: " + sourceAnalysisId);
        }
        if (!analysisRepository.existsById(targetAnalysisId)) {
            throw new IllegalArgumentException("Target document not found: " + targetAnalysisId);
        }

        // Check for duplicate
        if (relationshipRepository.existsBySourceAnalysisIdAndTargetAnalysisIdAndRelationshipType(
                sourceAnalysisId, targetAnalysisId, relationshipType)) {
            throw new IllegalStateException("Relationship already exists");
        }

        DocumentRelationship relationship = new DocumentRelationship();
        relationship.setSourceAnalysisId(sourceAnalysisId);
        relationship.setTargetAnalysisId(targetAnalysisId);
        relationship.setRelationshipType(relationshipType);
        relationship.setDescription(description);
        relationship.setCreatedBy(userId);

        log.info("Creating document relationship: {} {} -> {}", relationshipType, sourceAnalysisId, targetAnalysisId);
        return relationshipRepository.save(relationship);
    }

    /**
     * Get all relationships for a document with document details
     */
    public List<Map<String, Object>> getRelationshipsWithDetails(Long analysisId) {
        List<DocumentRelationship> relationships = relationshipRepository.findAllByAnalysisId(analysisId);

        return relationships.stream().map(rel -> {
            Map<String, Object> result = new HashMap<>();
            result.put("id", rel.getId());
            result.put("relationshipType", rel.getRelationshipType());
            result.put("description", rel.getDescription());
            result.put("createdAt", rel.getCreatedAt());

            // Determine if this document is source or target
            boolean isSource = rel.getSourceAnalysisId().equals(analysisId);
            result.put("direction", isSource ? "outgoing" : "incoming");

            // Get the related document details
            Long relatedId = isSource ? rel.getTargetAnalysisId() : rel.getSourceAnalysisId();
            Optional<AIDocumentAnalysis> relatedDoc = analysisRepository.findById(relatedId);

            if (relatedDoc.isPresent()) {
                AIDocumentAnalysis doc = relatedDoc.get();
                Map<String, Object> docInfo = new HashMap<>();
                docInfo.put("id", doc.getId());
                docInfo.put("analysisId", doc.getAnalysisId());
                docInfo.put("fileName", doc.getFileName());
                docInfo.put("detectedType", doc.getDetectedType());
                docInfo.put("createdAt", doc.getCreatedAt());
                result.put("relatedDocument", docInfo);
            }

            return result;
        }).collect(Collectors.toList());
    }

    /**
     * Get relationships where document is the source (outgoing)
     */
    public List<DocumentRelationship> getOutgoingRelationships(Long analysisId) {
        return relationshipRepository.findBySourceAnalysisId(analysisId);
    }

    /**
     * Get relationships where document is the target (incoming)
     */
    public List<DocumentRelationship> getIncomingRelationships(Long analysisId) {
        return relationshipRepository.findByTargetAnalysisId(analysisId);
    }

    /**
     * Delete a relationship
     */
    @Transactional
    public void deleteRelationship(Long relationshipId) {
        log.info("Deleting document relationship: {}", relationshipId);
        relationshipRepository.deleteById(relationshipId);
    }

    /**
     * Delete all relationships for a document
     */
    @Transactional
    public void deleteAllRelationshipsForDocument(Long analysisId) {
        log.info("Deleting all relationships for document: {}", analysisId);
        relationshipRepository.deleteBySourceAnalysisIdOrTargetAnalysisId(analysisId, analysisId);
    }

    /**
     * Get relationship type display name
     */
    public static String getRelationshipDisplayName(String type) {
        return switch (type) {
            case DocumentRelationship.RESPONDS_TO -> "Responds To";
            case DocumentRelationship.AMENDS -> "Amends";
            case DocumentRelationship.SUPERSEDES -> "Supersedes";
            case DocumentRelationship.REFERENCES -> "References";
            case DocumentRelationship.EXHIBITS -> "Is Exhibit To";
            default -> type;
        };
    }
}
