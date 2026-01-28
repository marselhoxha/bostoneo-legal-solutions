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
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Create a new relationship between two documents
     */
    @Transactional
    public DocumentRelationship createRelationship(Long sourceAnalysisId, Long targetAnalysisId,
                                                    String relationshipType, String description, Long userId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Validate documents exist AND belong to current organization
        if (!analysisRepository.existsByIdAndOrganizationId(sourceAnalysisId, orgId)) {
            throw new IllegalArgumentException("Source document not found or access denied: " + sourceAnalysisId);
        }
        if (!analysisRepository.existsByIdAndOrganizationId(targetAnalysisId, orgId)) {
            throw new IllegalArgumentException("Target document not found or access denied: " + targetAnalysisId);
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
        Long orgId = getRequiredOrganizationId();
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

            // Get the related document details - SECURITY: Use tenant-filtered query
            Long relatedId = isSource ? rel.getTargetAnalysisId() : rel.getSourceAnalysisId();
            Optional<AIDocumentAnalysis> relatedDoc = analysisRepository.findByIdAndOrganizationId(relatedId, orgId);

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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify analysis belongs to current organization
        if (!analysisRepository.existsByIdAndOrganizationId(analysisId, orgId)) {
            throw new IllegalArgumentException("Document not found or access denied: " + analysisId);
        }
        // SECURITY: Use tenant-filtered repository method
        return relationshipRepository.findBySourceAnalysisIdAndOrganizationId(analysisId, orgId);
    }

    /**
     * Get relationships where document is the target (incoming)
     */
    public List<DocumentRelationship> getIncomingRelationships(Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify analysis belongs to current organization
        if (!analysisRepository.existsByIdAndOrganizationId(analysisId, orgId)) {
            throw new IllegalArgumentException("Document not found or access denied: " + analysisId);
        }
        // SECURITY: Use tenant-filtered repository method
        return relationshipRepository.findByTargetAnalysisIdAndOrganizationId(analysisId, orgId);
    }

    /**
     * Delete a relationship
     */
    @Transactional
    public void deleteRelationship(Long relationshipId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting document relationship: {}", relationshipId);

        // SECURITY: Use tenant-filtered query directly
        DocumentRelationship relationship = relationshipRepository.findByIdAndOrganizationId(relationshipId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Relationship not found or access denied: " + relationshipId));

        relationshipRepository.deleteById(relationshipId);
    }

    /**
     * Delete all relationships for a document
     */
    @Transactional
    public void deleteAllRelationshipsForDocument(Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting all relationships for document: {} in org: {}", analysisId, orgId);
        // SECURITY: Use tenant-filtered delete
        relationshipRepository.deleteBySourceOrTargetAndOrganizationId(analysisId, analysisId, orgId);
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
