package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.DocumentTransformRequest;
import com.bostoneo.bostoneosolutions.dto.DocumentTransformResponse;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationRequest;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationResponse;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocument;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceDocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class AiWorkspaceController {

    private final AiWorkspaceDocumentService documentService;

    /**
     * Transform document (full document or selection)
     * POST /api/legal/ai-workspace/transform
     */
    @PostMapping("/transform")
    public ResponseEntity<DocumentTransformResponse> transformDocument(
        @RequestBody DocumentTransformRequest request,
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for document transformation");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Transform request: documentId={}, type={}, scope={}, userId={}",
                request.getDocumentId(), request.getTransformationType(), request.getTransformationScope(), effectiveUserId);

            AiWorkspaceDocumentVersion newVersion;

            // Check if selection-based or full document
            if ("SELECTION".equalsIgnoreCase(request.getTransformationScope())) {
                // Selection-based transformation
                newVersion = documentService.transformSelection(
                    request.getDocumentId(),
                    effectiveUserId,
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
                    effectiveUserId,
                    request.getTransformationType(),
                    request.getFullDocumentContent()
                );
            }

            // Build response
            DocumentTransformResponse response = DocumentTransformResponse.builder()
                .documentId(request.getDocumentId())
                .newVersion(newVersion.getVersionNumber())
                .transformedContent(newVersion.getContent())
                .transformedSelection(newVersion.getTransformedSelection()) // Only populated for SELECTION scope
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
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for retrieving document versions");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            List<AiWorkspaceDocumentVersion> versions = documentService.getDocumentVersions(documentId, effectiveUserId);
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
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for retrieving document version");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            return documentService.getVersion(documentId, effectiveUserId, versionNumber)
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
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for restoring document version");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            AiWorkspaceDocumentVersion restoredVersion = documentService.restoreVersion(
                documentId, effectiveUserId, versionNumber
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
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for saving document");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            String newContent = payload.get("content");
            String versionNote = payload.get("versionNote");
            AiWorkspaceDocumentVersion newVersion = documentService.saveManualEdit(
                documentId, effectiveUserId, newContent, versionNote
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
        @RequestParam(required = false) Long caseId,
        @RequestParam(required = false) Long userId
    ) {
        Long effectiveUserId = (user != null) ? user.getId() : userId;

        if (effectiveUserId == null) {
            log.error("No user ID available for retrieving user documents");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (caseId != null) {
            return ResponseEntity.ok(documentService.getCaseDocuments(caseId, effectiveUserId));
        } else {
            return ResponseEntity.ok(documentService.getUserDocuments(effectiveUserId));
        }
    }

    /**
     * Delete document (soft delete)
     * DELETE /api/legal/ai-workspace/documents/{documentId}
     */
    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> deleteDocument(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for deleting document");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            documentService.deleteDocument(documentId, effectiveUserId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Generate draft with conversation
     * POST /api/legal/ai-workspace/drafts/generate
     */
    @PostMapping("/drafts/generate")
    public ResponseEntity<DraftGenerationResponse> generateDraft(
        @RequestBody DraftGenerationRequest request,
        @AuthenticationPrincipal User user
    ) {
        try {
            // Use userId from request if user principal is null (for testing)
            // In production, should always use authenticated user
            Long userId = (user != null) ? user.getId() : request.getUserId();

            if (userId == null) {
                log.error("No user ID available - user not authenticated and no userId in request");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Generating draft for user={}, caseId={}, type={}",
                userId, request.getCaseId(), request.getDocumentType());

            DraftGenerationResponse response = documentService.generateDraftWithConversation(
                userId,
                request.getCaseId(),
                request.getPrompt(),
                request.getDocumentType(),
                request.getJurisdiction(),
                request.getSessionName()
            );

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Invalid draft generation request: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (Exception e) {
            log.error("Error generating draft: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get document by ID with latest version content
     * GET /api/legal/ai-workspace/documents/{documentId}
     */
    @GetMapping("/documents/{documentId}")
    public ResponseEntity<Map<String, Object>> getDocument(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            // Use userId from user principal, or from query param if principal is null
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for document retrieval");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            return documentService.getDocumentWithLatestVersion(documentId, effectiveUserId)
                .map(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("id", result.get("id"));
                    response.put("title", result.get("title"));
                    response.put("content", result.get("content"));
                    response.put("wordCount", result.get("wordCount"));
                    response.put("version", result.get("version"));
                    response.put("tokensUsed", result.get("tokensUsed"));
                    response.put("costEstimate", result.get("costEstimate"));
                    response.put("generatedAt", result.get("generatedAt"));
                    response.put("status", "COMPLETED");
                    response.put("processingTimeMs", 0);
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Export document to Word (DOCX)
     * GET /api/legal/ai-workspace/documents/{documentId}/export/word
     */
    @GetMapping("/documents/{documentId}/export/word")
    public ResponseEntity<byte[]> exportToWord(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId,
        @RequestParam(defaultValue = "true") boolean includeMetadata
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for Word export");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Exporting document {} to Word for user {}", documentId, effectiveUserId);

            byte[] wordDoc = documentService.generateWordDocument(documentId, effectiveUserId, includeMetadata);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
            headers.setContentDispositionFormData("attachment", "document.docx");
            headers.setContentLength(wordDoc.length);

            return ResponseEntity.ok()
                .headers(headers)
                .body(wordDoc);

        } catch (IllegalArgumentException e) {
            log.error("Document not found or access denied: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (Exception e) {
            log.error("Error exporting document to Word", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Export document to PDF
     * GET /api/legal/ai-workspace/documents/{documentId}/export/pdf
     */
    @GetMapping("/documents/{documentId}/export/pdf")
    public ResponseEntity<byte[]> exportToPdf(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId,
        @RequestParam(defaultValue = "true") boolean includeMetadata
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for PDF export");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Exporting document {} to PDF for user {}", documentId, effectiveUserId);

            byte[] pdfDoc = documentService.generatePdfDocument(documentId, effectiveUserId, includeMetadata);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "document.pdf");
            headers.setContentLength(pdfDoc.length);

            return ResponseEntity.ok()
                .headers(headers)
                .body(pdfDoc);

        } catch (IllegalArgumentException e) {
            log.error("Document not found or access denied: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (Exception e) {
            log.error("Error exporting document to PDF", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
