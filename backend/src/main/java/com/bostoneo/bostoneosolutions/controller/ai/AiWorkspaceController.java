package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.DocumentChange;
import com.bostoneo.bostoneosolutions.dto.DocumentTransformRequest;
import com.bostoneo.bostoneosolutions.dto.DocumentTransformResponse;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationRequest;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationResponse;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocument;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentExhibit;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceDocumentService;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceExhibitService;
import com.bostoneo.bostoneosolutions.service.DraftStreamingPublisher;
import com.bostoneo.bostoneosolutions.service.GenerationCancellationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.bostoneo.bostoneosolutions.dto.UserDTO;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/legal/ai-workspace")
@RequiredArgsConstructor
@Slf4j
public class AiWorkspaceController {

    private final AiWorkspaceDocumentService documentService;
    private final AiWorkspaceExhibitService exhibitService;
    private final GenerationCancellationService cancellationService;
    private final DraftStreamingPublisher draftStreamingPublisher;

    /**
     * Transform document (full document or selection)
     * POST /api/legal/ai-workspace/transform
     *
     * For SIMPLIFY and CONDENSE transformations on documents > 500 chars,
     * uses diff-based mode for 80-90% token savings.
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

            DocumentTransformResponse response;

            // Check if selection-based or full document
            if ("SELECTION".equalsIgnoreCase(request.getTransformationScope())) {
                // Selection-based transformation - always use traditional mode
                AiWorkspaceDocumentVersion newVersion = documentService.transformSelection(
                    request.getDocumentId(),
                    effectiveUserId,
                    request.getTransformationType(),
                    request.getFullDocumentContent(),
                    request.getSelectedText(),
                    request.getSelectionStartIndex(),
                    request.getSelectionEndIndex(),
                    request.getCustomPrompt()
                );

                response = DocumentTransformResponse.builder()
                    .documentId(request.getDocumentId())
                    .newVersion(newVersion.getVersionNumber())
                    .transformedContent(newVersion.getContent())
                    .transformedSelection(newVersion.getTransformedSelection())
                    .explanation(buildExplanation(request.getTransformationType(), request.getTransformationScope()))
                    .tokensUsed(newVersion.getTokensUsed())
                    .costEstimate(newVersion.getCostEstimate())
                    .wordCount(newVersion.getWordCount())
                    .transformationType(request.getTransformationType())
                    .transformationScope(request.getTransformationScope())
                    .useDiffMode(false)
                    .build();

            } else if (documentService.shouldUseDiffMode(request.getTransformationType(), request.getFullDocumentContent())) {
                // DIFF MODE: For SIMPLIFY/CONDENSE on larger documents (80-90% token savings)
                log.info("📊 Using DIFF MODE for transformation (token-efficient)");

                Map<String, Object> diffResult = documentService.transformFullDocumentDiffMode(
                    request.getDocumentId(),
                    effectiveUserId,
                    request.getTransformationType(),
                    request.getFullDocumentContent()
                );

                // Extract changes list
                @SuppressWarnings("unchecked")
                List<DocumentChange> changes = (List<DocumentChange>) diffResult.get("changes");

                response = DocumentTransformResponse.builder()
                    .documentId(request.getDocumentId())
                    .newVersion((Integer) diffResult.get("newVersion"))
                    .transformedContent((String) diffResult.get("transformedContent"))
                    .explanation(buildExplanation(request.getTransformationType(), request.getTransformationScope()))
                    .tokensUsed((Integer) diffResult.get("tokensUsed"))
                    .costEstimate((BigDecimal) diffResult.get("costEstimate"))
                    .wordCount((Integer) diffResult.get("wordCount"))
                    .transformationType(request.getTransformationType())
                    .transformationScope(request.getTransformationScope())
                    .changes(changes)
                    .useDiffMode(true)
                    .build();

            } else if ("CUSTOM".equalsIgnoreCase(request.getTransformationType()) &&
                       request.getCustomPrompt() != null &&
                       documentService.shouldUseCustomDiffMode(request.getCustomPrompt(), request.getFullDocumentContent())) {
                // CUSTOM DIFF MODE: For custom chat transformations on large documents
                // This saves 80-90% on output tokens and prevents truncation
                log.info("📊 Using CUSTOM DIFF MODE for chat transformation (token-efficient)");

                Map<String, Object> diffResult = documentService.transformFullDocumentCustomDiffMode(
                    request.getDocumentId(),
                    effectiveUserId,
                    request.getCustomPrompt(),
                    request.getFullDocumentContent()
                );

                // Check for no-changes-needed (AI found nothing to change — no second API call)
                Boolean noChangesNeeded = (Boolean) diffResult.get("noChangesNeeded");
                if (Boolean.TRUE.equals(noChangesNeeded)) {
                    @SuppressWarnings("unchecked")
                    List<DocumentChange> emptyChanges = (List<DocumentChange>) diffResult.get("changes");
                    response = DocumentTransformResponse.builder()
                        .documentId(request.getDocumentId())
                        .newVersion((Integer) diffResult.get("newVersion"))
                        .transformedContent((String) diffResult.get("transformedContent"))
                        .explanation("No changes were needed for your request.")
                        .tokensUsed((Integer) diffResult.get("tokensUsed"))
                        .costEstimate((BigDecimal) diffResult.get("costEstimate"))
                        .wordCount((Integer) diffResult.get("wordCount"))
                        .transformationType("CUSTOM")
                        .transformationScope(request.getTransformationScope())
                        .changes(emptyChanges)
                        .useDiffMode(true)
                        .build();
                }
                // Check if fallback is required (diff parsing failed)
                else if (Boolean.TRUE.equals((Boolean) diffResult.get("fallbackRequired"))) {
                    log.info("⚠️ Diff mode failed, falling back to full document mode");
                    // Fall back to traditional full document transformation
                    AiWorkspaceDocumentVersion newVersion = documentService.transformFullDocument(
                        request.getDocumentId(),
                        effectiveUserId,
                        request.getTransformationType(),
                        request.getFullDocumentContent(),
                        request.getCustomPrompt()
                    );

                    response = DocumentTransformResponse.builder()
                        .documentId(request.getDocumentId())
                        .newVersion(newVersion.getVersionNumber())
                        .transformedContent(newVersion.getContent())
                        .explanation(buildExplanation(request.getTransformationType(), request.getTransformationScope()))
                        .tokensUsed(newVersion.getTokensUsed())
                        .costEstimate(newVersion.getCostEstimate())
                        .wordCount(newVersion.getWordCount())
                        .transformationType(request.getTransformationType())
                        .transformationScope(request.getTransformationScope())
                        .useDiffMode(false)
                        .build();
                } else {
                    // Diff mode succeeded
                    @SuppressWarnings("unchecked")
                    List<DocumentChange> changes = (List<DocumentChange>) diffResult.get("changes");

                    response = DocumentTransformResponse.builder()
                        .documentId(request.getDocumentId())
                        .newVersion((Integer) diffResult.get("newVersion"))
                        .transformedContent((String) diffResult.get("transformedContent"))
                        .explanation("I've applied the requested changes to your document. (" + changes.size() + " changes made)")
                        .tokensUsed((Integer) diffResult.get("tokensUsed"))
                        .costEstimate((BigDecimal) diffResult.get("costEstimate"))
                        .wordCount((Integer) diffResult.get("wordCount"))
                        .transformationType("CUSTOM")
                        .transformationScope(request.getTransformationScope())
                        .changes(changes)
                        .useDiffMode(true)
                        .build();
                }

            } else {
                // TRADITIONAL MODE: Full document transformation (EXPAND, REDRAFT, FORMAL, PERSUASIVE, small CUSTOM)
                AiWorkspaceDocumentVersion newVersion = documentService.transformFullDocument(
                    request.getDocumentId(),
                    effectiveUserId,
                    request.getTransformationType(),
                    request.getFullDocumentContent(),
                    request.getCustomPrompt()
                );

                response = DocumentTransformResponse.builder()
                    .documentId(request.getDocumentId())
                    .newVersion(newVersion.getVersionNumber())
                    .transformedContent(newVersion.getContent())
                    .explanation(buildExplanation(request.getTransformationType(), request.getTransformationScope()))
                    .tokensUsed(newVersion.getTokensUsed())
                    .costEstimate(newVersion.getCostEstimate())
                    .wordCount(newVersion.getWordCount())
                    .transformationType(request.getTransformationType())
                    .transformationScope(request.getTransformationScope())
                    .useDiffMode(false)
                    .build();
            }

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
     * SSE endpoint for draft streaming.
     * Client connects BEFORE triggering generation.
     * GET /api/legal/ai-workspace/drafts/stream?conversationId={id}
     */
    @GetMapping(value = "/drafts/stream", produces = "text/event-stream")
    public SseEmitter streamDraft(@RequestParam Long conversationId) {
        log.info("SSE connection opened for draft streaming, conversationId={}", conversationId);
        return draftStreamingPublisher.createEmitter(conversationId);
    }

    /**
     * Trigger streaming draft generation. Returns 202 Accepted immediately.
     * POST /api/legal/ai-workspace/drafts/generate-streaming
     */
    @PostMapping("/drafts/generate-streaming")
    public ResponseEntity<Map<String, Object>> generateDraftStreaming(
            @RequestBody DraftGenerationRequest request,
            @AuthenticationPrincipal User user
    ) {
        try {
            Long userId = (user != null) ? user.getId() : request.getUserId();
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            Long conversationId = request.getConversationId();
            if (conversationId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "conversationId is required"));
            }

            // Capture tenant context before going async
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Triggering streaming draft generation: userId={}, conversationId={}, type={}",
                    userId, conversationId, request.getDocumentType());

            // Launch in background — the SSE emitter is already connected
            final Long finalUserId = userId;
            CompletableFuture.runAsync(() -> {
                documentService.generateDraftStreaming(
                        finalUserId,
                        orgId,
                        request.getCaseId(),
                        request.getPrompt(),
                        request.getDocumentType(),
                        request.getJurisdiction(),
                        request.getSessionName(),
                        conversationId,
                        request.getResearchMode(),
                        request.getDocumentId(),
                        request.getStationeryTemplateId(),
                        request.getStationeryAttorneyId()
                );
            });

            Map<String, Object> response = new HashMap<>();
            response.put("conversationId", conversationId);
            response.put("message", "Streaming generation started");

            return ResponseEntity.accepted().body(response);

        } catch (Exception e) {
            log.error("Error triggering streaming draft generation: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Cancel ongoing AI generation for a conversation
     * POST /api/legal/ai-workspace/conversations/{conversationId}/cancel
     */
    @PostMapping("/conversations/{conversationId}/cancel")
    public ResponseEntity<Map<String, Object>> cancelGeneration(
        @PathVariable Long conversationId,
        @AuthenticationPrincipal User user
    ) {
        try {
            log.info("🛑 Cancellation requested for conversation {}", conversationId);

            cancellationService.cancelConversation(conversationId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Generation cancellation requested");
            response.put("conversationId", conversationId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error cancelling generation for conversation {}", conversationId, e);
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
     * Create conversation session for draft (returns immediately with conversation ID)
     * POST /api/legal/ai-workspace/drafts/init-conversation
     */
    @PostMapping("/drafts/init-conversation")
    public ResponseEntity<Map<String, Object>> initDraftConversation(
        @RequestBody DraftGenerationRequest request,
        @AuthenticationPrincipal User user
    ) {
        try {
            Long userId = (user != null) ? user.getId() : request.getUserId();

            if (userId == null) {
                log.error("No user ID available - user not authenticated and no userId in request");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("🔵 Initializing draft conversation for user={}, caseId={}", userId, request.getCaseId());

            // Create conversation session immediately
            Long conversationId = documentService.createDraftConversationSession(
                userId,
                request.getCaseId(),
                request.getPrompt(),
                request.getJurisdiction(),
                request.getSessionName(),
                request.getResearchMode(),
                request.getDocumentType()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("conversationId", conversationId);
            response.put("message", "Conversation created");

            log.info("✅ Created conversation {} for draft generation", conversationId);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error initializing draft conversation: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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

            log.info("Generating draft for user={}, caseId={}, type={}, conversationId={}",
                userId, request.getCaseId(), request.getDocumentType(), request.getConversationId());

            DraftGenerationResponse response = documentService.generateDraftWithConversation(
                userId,
                request.getCaseId(),
                request.getPrompt(),
                request.getDocumentType(),
                request.getJurisdiction(),
                request.getSessionName(),
                request.getConversationId(),
                request.getResearchMode(),
                request.getDocumentId(),
                request.getStationeryTemplateId(),
                request.getStationeryAttorneyId()
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
     * Enhance a rough prompt into a detailed, structured legal document prompt.
     * POST /api/legal/ai-workspace/drafts/enhance-prompt
     */
    @PostMapping("/drafts/enhance-prompt")
    public ResponseEntity<Map<String, Object>> enhancePrompt(
        @RequestBody Map<String, Object> request,
        @AuthenticationPrincipal UserDTO userDto
    ) {
        try {
            if (userDto == null || userDto.getId() == null) {
                log.error("No user available for prompt enhancement");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            String prompt = (String) request.get("prompt");
            String documentType = (String) request.get("documentType");
            String jurisdiction = (String) request.get("jurisdiction");
            Long caseId = request.get("caseId") != null ? Long.valueOf(request.get("caseId").toString()) : null;

            if (prompt == null || prompt.trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            log.info("Enhancing prompt for user={}, docType={}, jurisdiction={}, caseId={}", userDto.getId(), documentType, jurisdiction, caseId);

            String enhancedPrompt = documentService.enhancePrompt(prompt.trim(), documentType, jurisdiction, caseId);

            Map<String, Object> response = new HashMap<>();
            response.put("enhancedPrompt", enhancedPrompt);
            response.put("originalPrompt", prompt);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error enhancing prompt: {}", e.getMessage(), e);
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
     * Get document by conversation (session) ID — used by frontend polling fallback
     * when SSE connection drops mid-stream but backend completes successfully.
     * GET /api/legal/ai-workspace/drafts/by-conversation/{conversationId}
     */
    @GetMapping("/drafts/by-conversation/{conversationId}")
    public ResponseEntity<Map<String, Object>> getDraftByConversation(
        @PathVariable Long conversationId,
        @AuthenticationPrincipal User user,
        @RequestParam(required = false) Long userId
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;
            if (effectiveUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            return documentService.getDocumentByConversationId(conversationId, effectiveUserId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("Error fetching draft by conversation {}: {}", conversationId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
        @RequestParam(defaultValue = "false") boolean includeMetadata
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for Word export");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Exporting document {} to Word for user {}", documentId, effectiveUserId);

            // Generate Word document
            byte[] wordDoc = documentService.generateWordDocument(documentId, effectiveUserId, includeMetadata);

            // Get professional filename from document content
            String filename = documentService.getDocumentFilename(documentId, effectiveUserId, "docx");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

            // Set Content-Disposition header properly for downloads
            ContentDisposition contentDisposition = ContentDisposition.attachment()
                    .filename(filename, StandardCharsets.UTF_8)
                    .build();
            headers.setContentDisposition(contentDisposition);
            headers.setContentLength(wordDoc.length);

            log.info("Exporting Word document with filename: {}", filename);

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
        @RequestParam(defaultValue = "false") boolean includeMetadata
    ) {
        try {
            Long effectiveUserId = (user != null) ? user.getId() : userId;

            if (effectiveUserId == null) {
                log.error("No user ID available for PDF export");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            log.info("Exporting document {} to PDF for user {}", documentId, effectiveUserId);

            // Generate PDF document
            byte[] pdfDoc = documentService.generatePdfDocument(documentId, effectiveUserId, includeMetadata);

            // Get professional filename from document content
            String filename = documentService.getDocumentFilename(documentId, effectiveUserId, "pdf");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);

            // Set Content-Disposition header properly for downloads
            ContentDisposition contentDisposition = ContentDisposition.attachment()
                    .filename(filename, StandardCharsets.UTF_8)
                    .build();
            headers.setContentDisposition(contentDisposition);
            headers.setContentLength(pdfDoc.length);

            log.info("Exporting PDF document with filename: {}", filename);

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

    // ===== EXHIBIT ENDPOINTS =====

    /**
     * Get all exhibits for a workspace document
     * GET /api/legal/ai-workspace/documents/{documentId}/exhibits
     */
    @GetMapping("/documents/{documentId}/exhibits")
    public ResponseEntity<List<AiWorkspaceDocumentExhibit>> getExhibits(
        @PathVariable Long documentId,
        @AuthenticationPrincipal User user
    ) {
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            List<AiWorkspaceDocumentExhibit> exhibits = exhibitService.getExhibitsForDocument(documentId, orgId);
            return ResponseEntity.ok(exhibits);
        } catch (Exception e) {
            log.error("Error retrieving exhibits for document {}: {}", documentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Add an exhibit from an existing case document
     * POST /api/legal/ai-workspace/documents/{documentId}/exhibits/from-case
     */
    @PostMapping("/documents/{documentId}/exhibits/from-case")
    public ResponseEntity<AiWorkspaceDocumentExhibit> addExhibitFromCase(
        @PathVariable Long documentId,
        @RequestBody Map<String, Long> body,
        @AuthenticationPrincipal User user
    ) {
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            Long caseDocumentId = body.get("caseDocumentId");
            if (caseDocumentId == null) {
                return ResponseEntity.badRequest().build();
            }

            AiWorkspaceDocumentExhibit exhibit = exhibitService.addExhibitFromCaseDocument(documentId, caseDocumentId, orgId);
            return ResponseEntity.status(HttpStatus.CREATED).body(exhibit);
        } catch (Exception e) {
            log.error("Error adding exhibit from case document for workspace doc {}: {}", documentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Upload a file and attach it as an exhibit
     * POST /api/legal/ai-workspace/documents/{documentId}/exhibits/upload
     */
    @PostMapping("/documents/{documentId}/exhibits/upload")
    public ResponseEntity<AiWorkspaceDocumentExhibit> uploadExhibit(
        @PathVariable Long documentId,
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "caseId", required = false) Long caseId
    ) {
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            // Get userId from SecurityContext — @AuthenticationPrincipal doesn't resolve for multipart requests
            Long effectiveUserId = null;
            Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof User) {
                effectiveUserId = ((User) auth.getPrincipal()).getId();
            }

            AiWorkspaceDocumentExhibit exhibit = exhibitService.addExhibitFromUpload(
                documentId, file, caseId, orgId, effectiveUserId
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(exhibit);
        } catch (Exception e) {
            log.error("Error uploading exhibit for workspace doc {}: {}", documentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Remove an exhibit
     * DELETE /api/legal/ai-workspace/documents/{documentId}/exhibits/{exhibitId}
     */
    @DeleteMapping("/documents/{documentId}/exhibits/{exhibitId}")
    public ResponseEntity<Map<String, Object>> removeExhibit(
        @PathVariable Long documentId,
        @PathVariable Long exhibitId,
        @AuthenticationPrincipal User user
    ) {
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            exhibitService.removeExhibit(exhibitId, orgId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Exhibit removed successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error removing exhibit {} for workspace doc {}: {}", exhibitId, documentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get the raw exhibit file for preview (inline display in iframe)
     * GET /api/legal/ai-workspace/documents/{documentId}/exhibits/{exhibitId}/file
     */
    @GetMapping("/documents/{documentId}/exhibits/{exhibitId}/file")
    public ResponseEntity<byte[]> getExhibitFile(
        @PathVariable Long documentId,
        @PathVariable Long exhibitId
    ) {
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            // Get exhibit metadata for Content-Type
            AiWorkspaceDocumentExhibit exhibit = exhibitService.findById(exhibitId, orgId)
                .orElse(null);
            if (exhibit == null) {
                return ResponseEntity.notFound().build();
            }

            // Verify exhibit belongs to the requested document
            if (!exhibit.getDocumentId().equals(documentId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            byte[] fileBytes = exhibitService.getExhibitFile(exhibitId, orgId);

            String mimeType = exhibit.getMimeType() != null ? exhibit.getMimeType() : "application/octet-stream";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(mimeType));
            headers.setContentLength(fileBytes.length);
            // Use inline disposition for PDF preview in iframe
            ContentDisposition contentDisposition = ContentDisposition.inline()
                .filename(exhibit.getFileName() != null ? exhibit.getFileName() : "exhibit", StandardCharsets.UTF_8)
                .build();
            headers.setContentDisposition(contentDisposition);

            return ResponseEntity.ok()
                .headers(headers)
                .body(fileBytes);
        } catch (Exception e) {
            log.error("Error retrieving file for exhibit {} in document {}: {}", exhibitId, documentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Reorder exhibits for a document
     * PUT /api/legal/ai-workspace/documents/{documentId}/exhibits/reorder
     */
    @PutMapping("/documents/{documentId}/exhibits/reorder")
    public ResponseEntity<Map<String, Object>> reorderExhibits(
        @PathVariable Long documentId,
        @RequestBody List<Map<String, Object>> orderList,
        @AuthenticationPrincipal User user
    ) {
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            if (orderList == null || orderList.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            exhibitService.reorderExhibits(orderList, orgId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Exhibits reordered successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error reordering exhibits for document {}: {}", documentId, e.getMessage());
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
            case "CUSTOM" -> String.format("I've applied the requested changes to %s.", scopeText);
            default -> String.format("I improved %s.", scopeText);
        };
    }

    /**
     * Export content to Word (DOCX) - no document ID required
     * POST /api/legal/ai-workspace/export/content/word
     * Used for workflow drafts that haven't been saved to database
     */
    @PostMapping("/export/content/word")
    public ResponseEntity<byte[]> exportContentToWord(@RequestBody Map<String, String> request) {
        try {
            String content = request.get("content");
            String title = request.getOrDefault("title", "Document");

            if (content == null || content.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            log.info("Exporting content to Word, title={}", title);

            // Generate Word document from content
            byte[] wordDoc = documentService.generateWordDocumentFromContent(content, title);

            // Sanitize filename — use document service for consistent naming
            String filename = documentService.sanitizeFilenamePublic(title) + ".docx";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
            ContentDisposition contentDisposition = ContentDisposition.attachment()
                    .filename(filename, StandardCharsets.UTF_8)
                    .build();
            headers.setContentDisposition(contentDisposition);
            headers.setContentLength(wordDoc.length);

            log.info("Exporting Word document with filename: {}", filename);

            return ResponseEntity.ok()
                .headers(headers)
                .body(wordDoc);

        } catch (Exception e) {
            log.error("Error exporting content to Word", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Export content to PDF - no document ID required
     * POST /api/legal/ai-workspace/export/content/pdf
     * Used for workflow drafts that haven't been saved to database
     */
    @PostMapping("/export/content/pdf")
    public ResponseEntity<byte[]> exportContentToPdf(@RequestBody Map<String, String> request) {
        try {
            String content = request.get("content");
            String title = request.getOrDefault("title", "Document");

            if (content == null || content.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            log.info("Exporting content to PDF, title={}", title);

            // Generate PDF document from content
            byte[] pdfDoc = documentService.generatePdfDocumentFromContent(content, title);

            // Sanitize filename — use document service for consistent naming
            String filename = documentService.sanitizeFilenamePublic(title) + ".pdf";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            ContentDisposition contentDisposition = ContentDisposition.attachment()
                    .filename(filename, StandardCharsets.UTF_8)
                    .build();
            headers.setContentDisposition(contentDisposition);
            headers.setContentLength(pdfDoc.length);

            log.info("Exporting PDF document with filename: {}", filename);

            return ResponseEntity.ok()
                .headers(headers)
                .body(pdfDoc);

        } catch (Exception e) {
            log.error("Error exporting content to PDF", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * PATCH /api/legal/ai-workspace/documents/{documentId}/stationery
     * Update stationery association on a document.
     * Body: { "stationeryTemplateId": 1, "stationeryAttorneyId": 2 }
     * Pass nulls to clear stationery.
     */
    @PatchMapping("/documents/{documentId}/stationery")
    public ResponseEntity<?> updateDocumentStationery(
        @PathVariable Long documentId,
        @RequestBody Map<String, Object> body,
        @AuthenticationPrincipal UserDTO userDto
    ) {
        try {
            Long userId = (userDto != null) ? userDto.getId() : null;
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            Long templateId = body.get("stationeryTemplateId") != null
                    ? ((Number) body.get("stationeryTemplateId")).longValue() : null;
            Long attorneyId = body.get("stationeryAttorneyId") != null
                    ? ((Number) body.get("stationeryAttorneyId")).longValue() : null;
            documentService.updateDocumentStationery(documentId, userId, templateId, attorneyId);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("Error updating document stationery: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
