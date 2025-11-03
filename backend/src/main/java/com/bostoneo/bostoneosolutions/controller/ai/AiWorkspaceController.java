package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.DocumentTransformRequest;
import com.bostoneo.bostoneosolutions.dto.DocumentTransformResponse;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocument;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceDocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/legal/ai-workspace")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class AiWorkspaceController {

    private final AiWorkspaceDocumentService documentService;

    /**
     * Transform document (full document or selection)
     * POST /api/legal/ai-workspace/transform
     */
    @PostMapping("/transform")
    public ResponseEntity<DocumentTransformResponse> transformDocument(
        @RequestBody DocumentTransformRequest request,
        @AuthenticationPrincipal User user
    ) {
        try {
            log.info("Transform request: documentId={}, type={}, scope={}",
                request.getDocumentId(), request.getTransformationType(), request.getTransformationScope());

            AiWorkspaceDocumentVersion newVersion;

            // Check if selection-based or full document
            if ("SELECTION".equalsIgnoreCase(request.getTransformationScope())) {
                // Selection-based transformation
                newVersion = documentService.transformSelection(
                    request.getDocumentId(),
                    user.getId(),
                    request.getTransformationType(),
                    request.getFullDocumentContent(),
                    request.getSelectedText(),
                    request.getSelectionStartIndex(),
                    request.getSelectionEndIndex()
                );
            } else {
                // Full document transformation
                newVersion = documentService.transformFullDocument(
                    request.getDocumentId(),
                    user.getId(),
                    request.getTransformationType(),
                    request.getFullDocumentContent()
                );
            }

            // Build response
            DocumentTransformResponse response = DocumentTransformResponse.builder()
                .documentId(request.getDocumentId())
                .newVersion(newVersion.getVersionNumber())
                .transformedContent(newVersion.getContent())
                .explanation(buildExplanation(request.getTransformationType(), request.getTransformationScope()))
                .tokensUsed(newVersion.getTokensUsed())
                .costEstimate(newVersion.getCostEstimate())
                .wordCount(newVersion.getWordCount())
                .transformationType(request.getTransformationType())
                .transformationScope(request.getTransformationScope())
                .build();

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Invalid transform request: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (Exception e) {
            log.error("Error transforming document", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get document versions
     * GET /api/legal/ai-workspace/documents/{documentId}/versions
     */
    @GetMapping("/documents/{documentId}/versions")
    public ResponseEntity<List<AiWorkspaceDocumentVersion>> getVersions(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user
    ) {
        try {
            List<AiWorkspaceDocumentVersion> versions = documentService.getDocumentVersions(documentId, user.getId());
            return ResponseEntity.ok(versions);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Get specific version
     * GET /api/legal/ai-workspace/documents/{documentId}/versions/{versionNumber}
     */
    @GetMapping("/documents/{documentId}/versions/{versionNumber}")
    public ResponseEntity<AiWorkspaceDocumentVersion> getVersion(
        @PathVariable Long documentId,
        @PathVariable Integer versionNumber,
        @AuthenticationPrincipal User user
    ) {
        try {
            return documentService.getVersion(documentId, user.getId(), versionNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Restore previous version
     * POST /api/legal/ai-workspace/documents/{documentId}/versions/{versionNumber}/restore
     */
    @PostMapping("/documents/{documentId}/versions/{versionNumber}/restore")
    public ResponseEntity<AiWorkspaceDocumentVersion> restoreVersion(
        @PathVariable Long documentId,
        @PathVariable Integer versionNumber,
        @AuthenticationPrincipal User user
    ) {
        try {
            AiWorkspaceDocumentVersion restoredVersion = documentService.restoreVersion(
                documentId, user.getId(), versionNumber
            );
            return ResponseEntity.ok(restoredVersion);
        } catch (IllegalArgumentException e) {
            log.error("Error restoring version: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Save manual edit
     * POST /api/legal/ai-workspace/documents/{documentId}/save
     */
    @PostMapping("/documents/{documentId}/save")
    public ResponseEntity<Map<String, Object>> saveManualEdit(
        @PathVariable Long documentId,
        @RequestBody Map<String, String> payload,
        @AuthenticationPrincipal User user
    ) {
        try {
            String newContent = payload.get("content");
            AiWorkspaceDocumentVersion newVersion = documentService.saveManualEdit(
                documentId, user.getId(), newContent
            );

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("versionNumber", newVersion.getVersionNumber());
            response.put("message", "Document saved successfully");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Get user's documents
     * GET /api/legal/ai-workspace/documents
     */
    @GetMapping("/documents")
    public ResponseEntity<List<AiWorkspaceDocument>> getUserDocuments(
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long caseId
    ) {
        if (caseId != null) {
            return ResponseEntity.ok(documentService.getCaseDocuments(caseId, user.getId()));
        } else {
            return ResponseEntity.ok(documentService.getUserDocuments(user.getId()));
        }
    }

    /**
     * Delete document (soft delete)
     * DELETE /api/legal/ai-workspace/documents/{documentId}
     */
    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> deleteDocument(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user
    ) {
        try {
            documentService.deleteDocument(documentId, user.getId());
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Build explanation message for transformation
     */
    private String buildExplanation(String transformationType, String scope) {
        String scopeText = "SELECTION".equalsIgnoreCase(scope) ? "the selected text" : "the document";

        return switch (transformationType.toUpperCase()) {
            case "SIMPLIFY" -> String.format("I simplified %s to make the language more accessible while preserving legal accuracy.", scopeText);
            case "CONDENSE" -> String.format("I condensed %s to make it more concise while retaining all key legal points.", scopeText);
            case "EXPAND" -> String.format("I expanded %s with additional detail, explanation, and supporting arguments.", scopeText);
            case "FORMAL" -> String.format("I rewrote %s in a more formal, professional legal tone.", scopeText);
            case "PERSUASIVE" -> String.format("I enhanced %s to be more persuasive and compelling for legal advocacy.", scopeText);
            case "REDRAFT" -> String.format("I completely redrafted %s with a fresh approach while maintaining the same legal objectives.", scopeText);
            default -> String.format("I improved %s.", scopeText);
        };
    }
}
