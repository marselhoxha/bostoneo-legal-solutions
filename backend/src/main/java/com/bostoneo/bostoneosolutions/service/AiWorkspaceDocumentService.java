package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.DocumentChange;
import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dto.PIDamageCalculationDTO;
import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import com.bostoneo.bostoneosolutions.dto.PIMedicalSummaryDTO;
import com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate;
import com.bostoneo.bostoneosolutions.dto.ai.DraftFromTemplateRequest;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationResponse;
import com.bostoneo.bostoneosolutions.dto.ai.GatingContext;
import com.bostoneo.bostoneosolutions.service.ai.DocumentGatingService;
import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocument;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentExhibit;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.LegalDocument;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.AITemplateVariableRepository;
import com.bostoneo.bostoneosolutions.repository.AiConversationSessionRepository;
import com.bostoneo.bostoneosolutions.repository.AiWorkspaceDocumentExhibitRepository;
import com.bostoneo.bostoneosolutions.repository.AiWorkspaceDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.AiWorkspaceDocumentVersionRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemTextCacheRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.LegalDocumentRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.service.ai.DocumentTypeTemplateRegistry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;

// iText PDF imports
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.events.Event;
import com.itextpdf.kernel.events.IEventHandler;
import com.itextpdf.kernel.events.PdfDocumentEvent;
import com.itextpdf.kernel.pdf.PdfPage;
import com.itextpdf.kernel.pdf.canvas.PdfCanvas;
import com.itextpdf.kernel.pdf.extgstate.PdfExtGState;
import com.itextpdf.layout.element.LineSeparator;
import com.itextpdf.kernel.pdf.canvas.draw.SolidLine;
import com.itextpdf.html2pdf.HtmlConverter;
import com.itextpdf.html2pdf.ConverterProperties;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiWorkspaceDocumentService {

    /** Tracks which documents currently have an auto-attach process running.
     *  Entries are added before the async task starts and removed when it finishes. */
    private static final ConcurrentHashMap<Long, Boolean> autoAttachInProgress = new ConcurrentHashMap<>();

    /** Returns true if no auto-attach process is running for this document. */
    public static boolean isAutoAttachComplete(Long documentId) {
        return !autoAttachInProgress.containsKey(documentId);
    }

    /**
     * Citation level for different document types
     */
    public enum CitationLevel {
        NONE,           // No citations at all (contracts, transactional documents)
        MINIMAL,        // 0-2 statutes only (demand letters, discovery, correspondence)
        COMPREHENSIVE   // Full case law + statutes (motions, briefs, pleadings, memos)
    }

    private final AiWorkspaceDocumentRepository documentRepository;
    private final AiWorkspaceDocumentVersionRepository versionRepository;
    private final AiWorkspaceDocumentExhibitRepository exhibitRepository;
    private final AiConversationSessionRepository conversationRepository;
    private final LegalCaseRepository caseRepository;
    private final ClaudeSonnet4Service claudeService;
    private final AiWorkspaceExhibitService exhibitService;
    private final com.bostoneo.bostoneosolutions.service.ai.AIRequestRouter aiRequestRouter;
    private final LegalResearchConversationService conversationService;
    private final GenerationCancellationService cancellationService;
    private final AILegalResearchService legalResearchService;  // For citation verification
    private final CitationUrlInjector citationUrlInjector;       // For URL injection
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;
    private final DraftStreamingPublisher draftStreamingPublisher;
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;
    private final StationeryService stationeryService;
    private final LegalCaseService legalCaseService;
    private final PIMedicalRecordService medicalRecordService;
    private final PIDamageCalculationService damageCalculationService;
    private final PIMedicalSummaryService medicalSummaryService;
    private final LegalDocumentRepository legalDocumentRepository;
    private final FileItemRepository fileItemRepository;
    private final FileItemTextCacheRepository fileItemTextCacheRepository;
    private final CaseDocumentService caseDocumentService;
    private final DocumentTypeTemplateRegistry templateRegistry;
    private final JurisdictionResolver jurisdictionResolver;
    private final DocumentTemplateEngine documentTemplateEngine;
    private final JurisdictionPromptBuilder jurisdictionPromptBuilder;
    private final DocumentGatingService documentGatingService;
    private final AiAuditLogService aiAuditLogService;
    private final AILegalTemplateRepository aiLegalTemplateRepository;
    private final AITemplateVariableRepository aiTemplateVariableRepository;

    /** Holds system + user message for draft generation */
    record DraftPrompt(String systemMessage, String userMessage) {}

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // MOCK MODE DISABLED - Using real API
    private static final boolean USE_MOCK_MODE = false;

    // Diff mode configuration
    private static final int MIN_CONTENT_LENGTH_FOR_DIFF_MODE = 500; // Only use diff mode for documents > 500 chars
    private static final Set<String> DIFF_ELIGIBLE_TRANSFORMATIONS = Set.of("SIMPLIFY", "CONDENSE");

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Simple transformations that can safely use Sonnet (cheaper model) */
    private static final Set<String> SIMPLE_TRANSFORMATIONS = Set.of("SIMPLIFY", "CONDENSE");

    private boolean isSimpleTransformation(String transformationType) {
        return transformationType != null && SIMPLE_TRANSFORMATIONS.contains(transformationType.toUpperCase());
    }

    /**
     * Create a new document with initial content
     */
    @Transactional
    public AiWorkspaceDocument createDocument(
        Long userId,
        Long caseId,
        Long sessionId,
        String title,
        String initialContent,
        String documentType,
        String jurisdiction,
        Integer tokensUsed,
        BigDecimal costEstimate
    ) {
        log.info("Creating new document for user={}, case={}, type={}", userId, caseId, documentType);

        // Create document
        Long orgId = getRequiredOrganizationId();
        AiWorkspaceDocument document = AiWorkspaceDocument.builder()
            .userId(userId)
            .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
            .caseId(caseId)
            .sessionId(sessionId)
            .title(title)
            .documentType(documentType)
            .jurisdiction(jurisdiction)
            .currentVersion(1)
            .status("DRAFT")
            .build();

        document = documentRepository.save(document);

        // Create initial version
        AiWorkspaceDocumentVersion initialVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
            .organizationId(document.getOrganizationId())
            .versionNumber(1)
            .content(initialContent)
            .wordCount(countWords(initialContent))
            .transformationType("INITIAL_GENERATION")
            .transformationScope("FULL_DOCUMENT")
            .createdByUser(false)
            .tokensUsed(tokensUsed)
            .costEstimate(costEstimate)
            .build();

        versionRepository.save(initialVersion);

        log.info("Created document id={} with initial version", document.getId());
        return document;
    }

    /**
     * Apply transformation to entire document
     * @param customPrompt For CUSTOM transformation type - user's natural language revision request
     */
    @Transactional
    public AiWorkspaceDocumentVersion transformFullDocument(
        Long documentId,
        Long userId,
        String transformationType,
        String currentContent,
        String customPrompt
    ) {
        log.info("Transforming full document id={}, type={}, hasCustomPrompt={}",
            documentId, transformationType, customPrompt != null && !customPrompt.isEmpty());

        // Verify document ownership
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Build transformation prompt - use custom prompt for CUSTOM type
        String prompt;
        if ("CUSTOM".equalsIgnoreCase(transformationType) && customPrompt != null && !customPrompt.isEmpty()) {
            // Include exhibit text so the AI can reference actual exhibit content
            String exhibitText = "";
            try {
                exhibitText = exhibitService.getExhibitTextForPrompt(documentId, getRequiredOrganizationId());
            } catch (Exception e) {
                log.warn("Failed to fetch exhibit text for transform: {}", e.getMessage());
            }
            prompt = buildCustomTransformationPrompt(customPrompt, currentContent, exhibitText);
        } else {
            prompt = buildTransformationPrompt(transformationType, currentContent, null, null);
        }

        // Check if generation has been cancelled (using document's sessionId as conversation ID)
        if (document.getSessionId() != null && cancellationService.isCancelled(document.getSessionId())) {
            log.warn("🛑 Transformation cancelled for document {} (conversation {})", documentId, document.getSessionId());
            cancellationService.clearCancellation(document.getSessionId());
            throw new IllegalStateException("Transformation cancelled by user");
        }

        // Call Claude API or use mock
        String transformedContent;
        if (USE_MOCK_MODE) {
            transformedContent = generateMockTransformation(transformationType, currentContent, "full");
            log.info("Using MOCK response for transformation (no API cost)");
        } else {
            // Route through AIRequestRouter for smart model selection
            // SIMPLIFY/CONDENSE → Sonnet (cheaper), EXPAND/REDRAFT/CUSTOM → Opus (quality)
            com.bostoneo.bostoneosolutions.enumeration.AIOperationType opType = isSimpleTransformation(transformationType)
                    ? com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_SIMPLE
                    : com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_COMPLEX;
            CompletableFuture<String> aiRequest = aiRequestRouter.routeSimple(
                    opType, prompt, null, false, document.getSessionId());

            try {
                transformedContent = aiRequest.join();
            } catch (Exception e) {
                throw e;
            }
        }

        // Strip [AI_NOTE]/[DOCUMENT] markers before persisting
        transformedContent = stripAiNoteMarkers(transformedContent);

        // Calculate tokens and cost (simplified - should use actual metrics)
        int tokensUsed = estimateTokens(transformedContent);
        BigDecimal cost = calculateCost(tokensUsed);

        // Create new version
        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
            .organizationId(document.getOrganizationId())
            .versionNumber(newVersionNumber)
            .content(transformedContent)
            .wordCount(countWords(transformedContent))
            .transformationType(transformationType)
            .transformationScope("FULL_DOCUMENT")
            .createdByUser(false)
            .tokensUsed(tokensUsed)
            .costEstimate(cost)
            .build();

        newVersion = versionRepository.save(newVersion);

        // Update document's current version
        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        log.info("Created version {} for document {}", newVersionNumber, documentId);
        return newVersion;
    }

    /**
     * Apply transformation to selected text only
     */
    @Transactional
    public AiWorkspaceDocumentVersion transformSelection(
        Long documentId,
        Long userId,
        String transformationType,
        String fullDocumentContent,
        String selectedText,
        Integer selectionStartIndex,
        Integer selectionEndIndex,
        String customPrompt
    ) {
        log.info("Transforming selection in document id={}, type={}, selection={}...{}",
            documentId, transformationType, selectionStartIndex, selectionEndIndex);

        // Verify document ownership
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Enrich with case context if document is linked to a case
        String caseContext = null;
        if (document.getCaseId() != null) {
            caseContext = caseRepository.findByIdAndOrganizationId(document.getCaseId(), getRequiredOrganizationId())
                .map(this::buildCaseContext)
                .orElse(null);
        }

        // Build transformation prompt for selection with full document context + case data
        String prompt = buildTransformationPrompt(transformationType, selectedText, "selection", fullDocumentContent, customPrompt, caseContext);

        // Check if generation has been cancelled (using document's sessionId as conversation ID)
        if (document.getSessionId() != null && cancellationService.isCancelled(document.getSessionId())) {
            log.warn("🛑 Selection transformation cancelled for document {} (conversation {})", documentId, document.getSessionId());
            cancellationService.clearCancellation(document.getSessionId());
            throw new IllegalStateException("Transformation cancelled by user");
        }

        // Call Claude API or use mock
        String transformedSelection;
        if (USE_MOCK_MODE) {
            transformedSelection = generateMockTransformation(transformationType, selectedText, "selection");
            log.info("Using MOCK response for selection transformation (no API cost)");
        } else {
            // Route through AIRequestRouter for smart model selection
            com.bostoneo.bostoneosolutions.enumeration.AIOperationType opType = isSimpleTransformation(transformationType)
                    ? com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_SIMPLE
                    : com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_COMPLEX;
            CompletableFuture<String> aiRequest = aiRequestRouter.routeSimple(
                    opType, prompt, null, false, document.getSessionId());

            try {
                transformedSelection = aiRequest.join();
            } catch (Exception e) {
                throw e;
            }
        }

        // Replace selected text in full document
        String newContent = replaceTextAtIndex(
            fullDocumentContent,
            selectionStartIndex,
            selectionEndIndex,
            transformedSelection
        );

        // Calculate tokens and cost
        int tokensUsed = estimateTokens(transformedSelection);
        BigDecimal cost = calculateCost(tokensUsed);

        // Create new version
        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
            .organizationId(document.getOrganizationId())
            .versionNumber(newVersionNumber)
            .content(newContent)
            .wordCount(countWords(newContent))
            .transformationType(transformationType)
            .transformationScope("SELECTION")
            .selectedText(selectedText)
            .transformedSelection(transformedSelection) // Store the transformed snippet
            .selectionStartIndex(selectionStartIndex)
            .selectionEndIndex(selectionEndIndex)
            .createdByUser(false)
            .tokensUsed(tokensUsed)
            .costEstimate(cost)
            .build();

        newVersion = versionRepository.save(newVersion);

        // Update document's current version
        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        log.info("Created version {} for document {} (selection transform)", newVersionNumber, documentId);
        return newVersion;
    }

    /**
     * Save manual edit as new version
     */
    @Transactional
    public AiWorkspaceDocumentVersion saveManualEdit(
        Long documentId,
        Long userId,
        String newContent
    ) {
        return saveManualEdit(documentId, userId, newContent, null);
    }

    /**
     * Save manual edit as new version with optional note.
     * §6.1 gating — if the document was previously `attorney_reviewed`, editing auto-reverts
     * it to `draft` so the watermark returns and a fresh review cycle is required. Reviewer
     * columns are preserved (audit history lives in ai_audit_logs, not the doc row).
     */
    @Transactional
    public AiWorkspaceDocumentVersion saveManualEdit(
        Long documentId,
        Long userId,
        String newContent,
        String versionNote
    ) {
        log.info("Saving manual edit for document id={} with note: {}", documentId, versionNote);

        Long orgId = getRequiredOrganizationId();
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Capture pre-edit approval state so we can audit any auto-revert below.
        String priorApproval = document.getApprovalStatus();
        Long priorReviewerId = document.getReviewedByUserId();

        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
            .organizationId(document.getOrganizationId())
            .versionNumber(newVersionNumber)
            .content(newContent)
            .wordCount(countWords(newContent))
            .transformationType("MANUAL_EDIT")
            .transformationScope("FULL_DOCUMENT")
            .createdByUser(true)
            .versionNote(versionNote)
            .tokensUsed(0)
            .costEstimate(BigDecimal.ZERO)
            .build();

        newVersion = versionRepository.save(newVersion);

        // §6.1 gating: if this was an approved document, editing demotes it back to draft.
        if ("attorney_reviewed".equalsIgnoreCase(priorApproval)) {
            document.setApprovalStatus("draft");
            logAutoRevertOnEdit(documentId, userId, orgId, priorReviewerId);
        }

        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        return newVersion;
    }

    /**
     * Emit an audit log entry when an approved document is automatically reverted to
     * draft because the owner edited the content. Fire-and-forget — an audit failure
     * must never block the user's save.
     */
    private void logAutoRevertOnEdit(Long documentId, Long editorUserId, Long orgId, Long priorReviewerId) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("documentId", documentId);
            payload.put("editorUserId", editorUserId);
            payload.put("priorApproval", "attorney_reviewed");
            payload.put("newApproval", "draft");
            payload.put("priorReviewerUserId", priorReviewerId);
            aiAuditLogService.logGenerationEvent(
                    editorUserId, null, null, orgId, "AUTO_REVERT_ON_EDIT",
                    "workspace_document", documentId,
                    payload,
                    String.format("Document auto-reverted to draft after edit (prior reviewer user=%s)", priorReviewerId),
                    true, null);
        } catch (Exception e) {
            // Audit logging must never break a save.
            log.warn("Failed to enqueue auto-revert audit event: {}", e.getMessage());
        }
    }

    /**
     * Get all versions for a document
     */
    public List<AiWorkspaceDocumentVersion> getDocumentVersions(Long documentId, Long userId) {
        // Verify ownership
        documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        return versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
    }

    /**
     * Get specific version
     */
    public Optional<AiWorkspaceDocumentVersion> getVersion(Long documentId, Long userId, Integer versionNumber) {
        // Verify ownership
        documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        return versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber);
    }

    /**
     * Restore a previous version (creates new version with old content)
     */
    @Transactional
    public AiWorkspaceDocumentVersion restoreVersion(Long documentId, Long userId, Integer versionToRestore) {
        log.info("Restoring document id={} to version {}", documentId, versionToRestore);

        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        AiWorkspaceDocumentVersion oldVersion = versionRepository
            .findByDocumentIdAndVersionNumber(documentId, versionToRestore)
            .orElseThrow(() -> new IllegalArgumentException("Version not found"));

        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion restoredVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
            .organizationId(document.getOrganizationId())
            .versionNumber(newVersionNumber)
            .content(oldVersion.getContent())
            .wordCount(oldVersion.getWordCount())
            .transformationType("RESTORE_VERSION")
            .transformationScope("FULL_DOCUMENT")
            .createdByUser(true)
            .tokensUsed(0)
            .costEstimate(BigDecimal.ZERO)
            .build();

        restoredVersion = versionRepository.save(restoredVersion);

        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        log.info("Restored version {} as new version {}", versionToRestore, newVersionNumber);
        return restoredVersion;
    }

    /**
     * Get user's documents
     */
    public List<AiWorkspaceDocument> getUserDocuments(Long userId) {
        Long orgId = getRequiredOrganizationId();
        return documentRepository.findByUserIdAndOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId, orgId);
    }

    /**
     * Get case documents
     */
    public List<AiWorkspaceDocument> getCaseDocuments(Long caseId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        return documentRepository.findByCaseIdAndOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(caseId, orgId);
    }

    /**
     * Get the latest demand letter for a case.
     * Returns document content and metadata for the most recent demand letter.
     */
    @SuppressWarnings("deprecation")
    public Map<String, Object> getLatestDemandLetterForCase(Long caseId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        List<AiWorkspaceDocument> caseDocuments = documentRepository.findByCaseIdAndOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(caseId, orgId);

        // Find the most recent demand letter
        for (AiWorkspaceDocument doc : caseDocuments) {
            if (isDemandLetterType(doc.getDocumentType())) {
                // Get the latest version content (using deprecated method with suppressed warning)
                // Parent document ownership already verified via orgId filter above
                List<AiWorkspaceDocumentVersion> versions = versionRepository
                    .findByDocumentIdOrderByVersionNumberDesc(doc.getId());

                if (!versions.isEmpty()) {
                    AiWorkspaceDocumentVersion latestVersion = versions.get(0);
                    Map<String, Object> result = new HashMap<>();
                    result.put("documentId", doc.getId());
                    result.put("conversationId", doc.getSessionId());
                    result.put("title", doc.getTitle());
                    result.put("content", latestVersion.getContent());
                    result.put("generatedAt", doc.getCreatedAt());
                    result.put("wordCount", latestVersion.getWordCount());
                    return result;
                }
            }
        }

        return null; // No demand letter found
    }

    /**
     * Soft delete document
     */
    @Transactional
    public void deleteDocument(Long documentId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        document.setDeletedAt(LocalDateTime.now());
        documentRepository.save(document);

        log.info("Soft deleted document id={}", documentId);
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    private String buildTransformationPrompt(String transformationType, String content, String scope, String fullDocumentContent) {
        return buildTransformationPrompt(transformationType, content, scope, fullDocumentContent, null, null);
    }

    private String buildTransformationPrompt(String transformationType, String content, String scope, String fullDocumentContent, String customPrompt) {
        return buildTransformationPrompt(transformationType, content, scope, fullDocumentContent, customPrompt, null);
    }

    private String buildTransformationPrompt(String transformationType, String content, String scope, String fullDocumentContent, String customPrompt, String caseContext) {
        // For selection transformations, provide full document context
        if ("selection".equals(scope) && fullDocumentContent != null && !fullDocumentContent.isEmpty()) {

            // CUSTOM type with user prompt — use the user's actual instruction
            if ("CUSTOM".equalsIgnoreCase(transformationType) && customPrompt != null && !customPrompt.trim().isEmpty()) {
                String caseSection = (caseContext != null && !caseContext.isBlank())
                    ? "\n\n---\n\nAVAILABLE CASE DATA (use this to fill in placeholders if applicable):\n" + caseContext + "\n"
                    : "";

                return String.format(
                    "Here is the full legal document for context:\n\n%s\n\n" +
                    "---\n\n" +
                    "The user has selected the following portion of the document:\n\n%s\n\n" +
                    "---\n\n" +
                    "USER'S REQUEST:\n%s\n" +
                    "%s\n\n" +
                    "INSTRUCTIONS:\n" +
                    "- Apply the user's request to the selected text above\n" +
                    "- Maintain consistency with the rest of the document\n" +
                    "- Preserve the format (if the selected text is a table, return a table)\n" +
                    "- Match the document's tone and style\n" +
                    "- Keep legal terminology consistent\n" +
                    "- If the selected text contains placeholder brackets like [Date], [Amount], [Name], use data from the document or case context to fill them in. If specific data is not available, keep the original placeholder — do NOT invent fake data.\n" +
                    "- NEVER generate fake, sample, test, dummy, mock, 'real-looking', or fabricated data — regardless of how the user phrases the request (e.g., 'add some real looking data', 'add fake data', 'fill with sample values'). If no real data is available, respond with a Note: explanation.\n" +
                    "- If you cannot meaningfully change the selected text based on the request (e.g., no real data available to replace placeholders), respond with ONLY a brief explanation starting with 'Note:' — do NOT return the unchanged table or text.\n" +
                    "- Return ONLY the transformed version of the selected text (not the full document)\n" +
                    "- Do NOT include any commentary or notes alongside the result — return EITHER the transformed content OR a 'Note:' explanation, never both",
                    fullDocumentContent, content, customPrompt.trim(), caseSection
                );
            }

            // Calculate word count limits for EXPAND operation
            int originalWordCount = countWords(content);
            int maxAllowedWords = (int) Math.ceil(originalWordCount * 1.3); // 30% increase max

            String transformAction = switch (transformationType.toUpperCase()) {
                case "SIMPLIFY" -> "simplify";
                case "CONDENSE" -> "condense";
                case "EXPAND" -> "expand moderately";
                case "FORMAL" -> "rewrite in a more formal, professional legal tone";
                case "PERSUASIVE" -> "rewrite to be more persuasive and compelling for legal advocacy";
                case "REDRAFT" -> "completely redraft with a fresh approach";
                default -> "improve";
            };

            // Add CRITICAL length constraint for EXPAND with explicit word counts
            String lengthRequirement = transformationType.equalsIgnoreCase("EXPAND")
                ? String.format(
                    "⚠️ CRITICAL LENGTH REQUIREMENT:\n" +
                    "- Original text: %d words\n" +
                    "- Your response MUST be NO MORE THAN %d words (30%% maximum increase)\n" +
                    "- Add only 2-3 brief additional sentences with moderate detail\n" +
                    "- DO NOT write extensive sections, bullet points, tables, or lengthy elaborations\n" +
                    "- DO NOT add headers, subheadings, or structural formatting\n" +
                    "- Keep expansion minimal, focused, and concise\n\n",
                    originalWordCount, maxAllowedWords
                )
                : "";

            return String.format(
                "Here is the full legal document for context:\n\n%s\n\n" +
                "---\n\n" +
                "%s" +
                "Please %s ONLY the following selected portion:\n\n%s\n\n" +
                "Requirements:\n" +
                "- Maintain consistency with the rest of the document\n" +
                "- Preserve any references to other sections\n" +
                "- Match the document's tone and style\n" +
                "- Keep legal terminology consistent\n" +
                "- Return ONLY the transformed version of the selected text (not the full document)",
                fullDocumentContent, lengthRequirement, transformAction, content
            );
        }

        // For full document transformations or fallback
        String scopePrefix = "selection".equals(scope) ? "the following selected text" : "this document";

        // Calculate word count for EXPAND fallback
        int originalWordCount = countWords(content);
        int maxAllowedWords = (int) Math.ceil(originalWordCount * 1.3);

        return switch (transformationType.toUpperCase()) {
            case "SIMPLIFY" -> String.format(
                "Please simplify %s to make it more accessible while preserving legal accuracy:\n\n%s",
                scopePrefix, content
            );
            case "CONDENSE" -> String.format(
                "Please condense %s to make it more concise while retaining all key legal points:\n\n%s",
                scopePrefix, content
            );
            case "EXPAND" -> String.format(
                "⚠️ CRITICAL: Original is %d words. Your response MUST be NO MORE THAN %d words (30%% max).\n\n" +
                "Please expand %s with moderate additional detail, explanation, and supporting arguments. " +
                "Add only 2-3 brief sentences. DO NOT write extensive sections, bullet points, or tables:\n\n%s",
                originalWordCount, maxAllowedWords, scopePrefix, content
            );
            case "FORMAL" -> String.format(
                "Please rewrite %s in a more formal, professional legal tone:\n\n%s",
                scopePrefix, content
            );
            case "PERSUASIVE" -> String.format(
                "Please rewrite %s to be more persuasive and compelling for legal advocacy:\n\n%s",
                scopePrefix, content
            );
            case "REDRAFT" -> String.format(
                "Please completely redraft %s with a fresh approach while maintaining the same legal objectives:\n\n%s",
                scopePrefix, content
            );
            default -> String.format("Please improve %s:\n\n%s", scopePrefix, content);
        };
    }

    /**
     * Build prompt for custom user-directed transformation
     * User provides natural language instructions for document changes
     */
    private String buildCustomTransformationPrompt(String userPrompt, String documentContent, String exhibitText) {
        // exhibitText already includes EXHIBIT REFERENCE RULES from getExhibitTextForPrompt()
        String exhibitSection = (exhibitText != null && !exhibitText.isEmpty())
            ? "\n" + exhibitText
            : "";

        return String.format(
            """
            You are an expert legal document editor. The user has requested specific changes to their document.

            USER'S REQUEST:
            %s
            %s
            CURRENT DOCUMENT:
            %s

            INSTRUCTIONS:
            1. Apply the user's requested changes to the document
            2. Maintain the document's EXACT formatting and structure — all headings, paragraphs, lists, tables, and section breaks must be preserved
            3. Preserve section numbering and references
            4. Keep consistent legal terminology and tone
            5. Return the COMPLETE modified document (not just the changed sections)

            CRITICAL RULES — VIOLATIONS WILL CORRUPT THE DOCUMENT:
            - Your output must be the revised document itself. Do NOT output explanations, instructions, or commentary.
            - Do NOT add bracketed instructions like "[ATTORNEY TO INSERT: describe what goes here]". If a placeholder cannot be filled with real data, leave it EXACTLY as it appears in the original (e.g., "[ATTORNEY TO INSERT]" stays as "[ATTORNEY TO INSERT]").
            - Do NOT flatten the document structure. Every heading, paragraph break, list item, and table row in the original must appear in your output.
            - Do NOT add preamble text like "Here is the revised document" or "Based on the document's context".
            - If you have a note for the user, put ONLY the note on the first line prefixed with "[AI_NOTE]", then "[DOCUMENT]" on the next line, then the full document. Example:
              [AI_NOTE] Some placeholders require case-specific data I don't have.
              [DOCUMENT]
              (full document here with original structure preserved)
            - If you cannot make any changes, return the original document EXACTLY as provided, with no modifications.
            - Do not wrap the document in markdown code fences.

            Return the revised document now:
            """,
            userPrompt, exhibitSection, documentContent
        );
    }

    /**
     * Strip [AI_NOTE]/[DOCUMENT] markers from AI response.
     * If the response has [AI_NOTE] + [DOCUMENT], extract only the document portion.
     * If [AI_NOTE] without [DOCUMENT], return original content unchanged (frontend handles the note).
     */
    private String stripAiNoteMarkers(String content) {
        if (content == null) return content;
        String trimmed = content.trim();
        if (trimmed.startsWith("[AI_NOTE]")) {
            int docIdx = trimmed.indexOf("[DOCUMENT]");
            if (docIdx != -1) {
                String docContent = trimmed.substring(docIdx + "[DOCUMENT]".length()).trim();
                return docContent.isEmpty() ? content : docContent;
            }
        }
        return content;
    }

    private int countWords(String text) {
        if (text == null || text.trim().isEmpty()) {
            return 0;
        }
        return text.trim().split("\\s+").length;
    }

    private int estimateTokens(String text) {
        // Rough estimate: 1 token ≈ 4 characters for English
        return text.length() / 4;
    }

    private BigDecimal calculateCost(int tokens) {
        // Claude Sonnet pricing: ~$3 per 1M input tokens, ~$15 per 1M output tokens
        // Using average of $9 per 1M tokens
        double costPerToken = 9.0 / 1_000_000;
        return BigDecimal.valueOf(tokens * costPerToken);
    }

    private String replaceTextAtIndex(String original, int startIndex, int endIndex, String replacement) {
        if (startIndex < 0 || endIndex > original.length() || startIndex > endIndex) {
            throw new IllegalArgumentException("Invalid selection indices");
        }

        return original.substring(0, startIndex) + replacement + original.substring(endIndex);
    }

    /**
     * Generate mock transformation responses for testing without API costs
     */
    private String generateMockTransformation(String transformationType, String originalText, String scope) {
        String prefix = "[MOCK " + transformationType.toUpperCase() + "] ";

        return switch (transformationType.toUpperCase()) {
            case "SIMPLIFY" -> prefix + "This is a simplified version: " +
                originalText.replace("pursuant to", "according to")
                           .replace("aforementioned", "mentioned")
                           .replace("heretofore", "previously");

            case "CONDENSE" -> {
                // Shorten the text by ~30%
                String[] words = originalText.split("\\s+");
                int targetLength = (int)(words.length * 0.7);
                StringBuilder condensed = new StringBuilder(prefix + "Condensed version: ");
                for (int i = 0; i < Math.min(targetLength, words.length); i++) {
                    condensed.append(words[i]).append(" ");
                }
                yield condensed.toString().trim();
            }

            case "EXPAND" -> prefix + "Expanded version with additional detail: " +
                originalText + " Furthermore, it is important to note that this matter requires " +
                "careful consideration of all relevant legal precedents and statutory requirements. " +
                "The applicable law provides clear guidance on this issue, and the facts of this case " +
                "align precisely with established legal principles.";

            case "FORMAL" -> prefix + originalText
                .replace("don't", "do not")
                .replace("can't", "cannot")
                .replace("won't", "will not")
                .replace("it's", "it is")
                + " The Court is respectfully requested to consider the foregoing arguments.";

            case "PERSUASIVE" -> prefix + "It is abundantly clear that " + originalText +
                " The evidence overwhelmingly supports this position. The applicable legal standards " +
                "compel only one conclusion: the relief sought must be granted. Justice and equity " +
                "demand no less than the outcome requested herein.";

            case "REDRAFT" -> prefix + "Complete redraft: In light of the relevant legal considerations, " +
                "this matter presents straightforward issues for the Court's determination. " +
                originalText.substring(0, Math.min(100, originalText.length())) +
                "... [redrafted content with fresh perspective]";

            default -> prefix + "Modified version: " + originalText;
        };
    }

    /**
     * Create draft conversation session (returns immediately with conversation ID)
     */
    @Transactional
    public Long createDraftConversationSession(
        Long userId,
        Long caseId,
        String prompt,
        String jurisdiction,
        String sessionName,
        String researchMode,
        String documentType
    ) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating draft conversation session: userId={}, caseId={}, orgId={}, researchMode={}, documentType={}", userId, caseId, orgId, researchMode, documentType);

        // Create conversation session with organization ID for tenant isolation
        AiConversationSession conversation = AiConversationSession.builder()
            .userId(userId)
            .organizationId(orgId)
            .caseId(caseId)
            .sessionName(sessionName)
            .sessionType(caseId != null ? "case-specific" : "general")
            .taskType("GENERATE_DRAFT")
            .researchMode(researchMode != null ? researchMode : "FAST")
            .jurisdiction(jurisdiction)
            .documentType(documentType)
            .isActive(true)
            .build();

        conversation = conversationRepository.save(conversation);

        // Add user message
        conversationService.addMessage(conversation.getId(), userId, "user", prompt, null);

        log.info("✅ Created conversation session {} for draft generation", conversation.getId());

        return conversation.getId();
    }

    /**
     * Generate draft with conversation - Complete flow
     */
    @Transactional
    public DraftGenerationResponse generateDraftWithConversation(
        Long userId,
        Long caseId,
        String prompt,
        String documentType,
        String jurisdiction,
        String sessionName,
        Long conversationId,
        String researchMode,
        Long documentId,
        Long stationeryTemplateId,
        Long stationeryAttorneyId,
        String courtLevel,
        String practiceArea,
        java.util.Map<String, Object> documentOptions
    ) {
        log.info("Generating draft with conversation: userId={}, caseId={}, type={}, conversationId={}, researchMode={}",
                 userId, caseId, documentType, conversationId, researchMode);

        // 1. Fetch case context if caseId provided - SECURITY: Use tenant-filtered query
        Long orgId = getRequiredOrganizationId();

        // Validate medical records exist before generating demand letter
        if (isDemandLetterType(documentType) && caseId != null) {
            List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByCaseId(caseId);
            if (records == null || records.isEmpty()) {
                throw new IllegalArgumentException(
                    "MEDICAL_RECORDS_REQUIRED: Medical records must be scanned before generating a demand letter. " +
                    "Go to the Medical Records tab and scan your case documents first.");
            }
            try {
                PIMedicalSummaryDTO summary = medicalSummaryService.getMedicalSummary(caseId);
                if (summary == null) {
                    throw new IllegalArgumentException(
                        "MEDICAL_SUMMARY_REQUIRED: A medical summary must be generated before creating a demand letter. " +
                        "Go to the Medical Summary tab and click Generate Summary.");
                }
            } catch (IllegalArgumentException e) {
                throw e; // Re-throw our own validation errors
            } catch (Exception e) {
                throw new IllegalArgumentException(
                    "MEDICAL_SUMMARY_REQUIRED: A medical summary must be generated before creating a demand letter. " +
                    "Go to the Medical Summary tab and click Generate Summary.");
            }
        }

        String caseContext = "";
        LegalCase legalCase = null;
        if (caseId != null) {
            legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId).orElse(null);
            if (legalCase != null) {
                if (isDemandLetterType(documentType)) {
                    caseContext = buildDemandLetterCaseData(caseId, orgId);
                    log.info("Using comprehensive demand letter case data for type: {}", documentType);
                } else if (isLetterType(documentType)) {
                    caseContext = buildFullCaseData(caseId);
                    log.info("Enriched case context with full case data for letter type: {}", documentType);
                } else {
                    caseContext = buildCaseContext(legalCase);
                }
            }
        }

        // 2. Use existing conversation or create new one - SECURITY: Use tenant-filtered query
        AiConversationSession conversation;
        if (conversationId != null) {
            // Use existing conversation
            conversation = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));
            log.info("✅ Using existing conversation {}", conversationId);
        } else {
            // Create new conversation session with organization ID for tenant isolation
            conversation = AiConversationSession.builder()
                .userId(userId)
                .organizationId(orgId)
                .caseId(caseId)
                .sessionName(sessionName)
                .sessionType(caseId != null ? "case-specific" : "general")
                .taskType("GENERATE_DRAFT")
                .researchMode(researchMode != null ? researchMode : "FAST")
                .jurisdiction(jurisdiction)
                .isActive(true)
                .build();

            conversation = conversationRepository.save(conversation);

            // Add user message (only for new conversation)
            conversationService.addMessage(conversation.getId(), userId, "user", prompt, null);
        }

        // 4. Fetch exhibits if a workspace document already exists
        List<AiWorkspaceDocumentExhibit> exhibits = Collections.emptyList();
        if (documentId != null) {
            exhibits = exhibitRepository.findByDocumentIdAndOrgId(documentId, orgId);
            exhibits = exhibitService.filterActiveExhibits(exhibits);
            if (!exhibits.isEmpty()) {
                log.info("Found {} active exhibits for document {} to include in prompt", exhibits.size(), documentId);
            }
        }

        // 5. Look up stationery context if document has stationery applied
        String stationeryContext = resolveStationeryContext(documentId, orgId, stationeryTemplateId, stationeryAttorneyId);

        // 5b. Build AI prompt with case context, exhibits, and stationery awareness
        String effectiveCourtLevel = (courtLevel != null && !courtLevel.isBlank()) ? courtLevel : "DEFAULT";
        // Resolve practice area: explicit param overrides, else fall back to the case's practice area
        String effectivePracticeArea = (practiceArea != null && !practiceArea.isBlank())
                ? practiceArea
                : (legalCase != null ? legalCase.getPracticeArea() : null);
        DraftPrompt draftPrompt = buildDraftPrompt(prompt, documentType, jurisdiction, caseContext, legalCase, researchMode, exhibits, stationeryContext, effectiveCourtLevel, effectivePracticeArea, documentOptions);

        // 5c. Resolve the same cascaded template the prompt used, then compute §6.1 gating state once.
        // Used downstream for watermark banner, disclaimer footer, overdue warning, and audit logging.
        com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate resolvedTemplate =
                templateRegistry.getResolvedTemplate(documentType, effectivePracticeArea, jurisdiction);
        GatingContext gating = documentGatingService.computeGating(resolvedTemplate);
        if (gating.isOverdue()) {
            log.warn("⚠️ Template {} (v{}) verification is OVERDUE — nextReviewDue={}, today={}",
                    gating.templateType(), gating.templateVersion(), gating.nextReviewDue(), LocalDate.now());
        }

        // 6. Check if generation has been cancelled
        if (cancellationService.isCancelled(conversation.getId())) {
            log.warn("🛑 Generation cancelled for conversation {} before AI call", conversation.getId());
            cancellationService.clearCancellation(conversation.getId());
            throw new IllegalStateException("Generation cancelled by user");
        }

        // 7. Generate document content using Claude with cancellation support (routed through AIRequestRouter)
        CompletableFuture<String> aiRequest = aiRequestRouter.routeSimple(
                com.bostoneo.bostoneosolutions.enumeration.AIOperationType.DRAFT_GENERATION,
                draftPrompt.userMessage(), draftPrompt.systemMessage(), false, conversation.getId());

        String content;
        try {
            content = aiRequest.join();
        } catch (Exception e) {
            if (cancellationService.isCancelled(conversation.getId())) {
                log.info("🛑 AI generation was cancelled for conversation {}", conversation.getId());
                throw new IllegalStateException("Generation cancelled by user");
            }
            throw e;
        }

        // TEMPLATE RENDERING: For supported document types, parse AI JSON and inject into HTML template
        if (documentTemplateEngine.supportsTemplateGeneration(documentType)) {
            try {
                content = renderWithTemplate(content, legalCase, jurisdiction, documentType, userId, orgId, effectiveCourtLevel, stationeryTemplateId, stationeryAttorneyId);
                log.info("✅ Template rendering complete — caption and structure from HTML template");
            } catch (Exception e) {
                log.warn("⚠️ Template rendering failed, using raw AI content as fallback: {}", e.getMessage());
                // Fall through to existing markdown flow — document still gets delivered
            }
        }

        // POST-PROCESSING: Skip citation regex for template-rendered HTML (would corrupt HTML structure).
        // Template docs have citations as plain text inside <p> tags — they render correctly as-is.
        if (content.startsWith("<!-- HTML_TEMPLATE -->")) {
            log.info("📋 Skipping citation post-processing for template-rendered document");
        } else {
        // POST-PROCESSING: Verify citations and inject URLs (conditional based on document type)
        CitationLevel postProcessingLevel = getCitationLevel(documentType);
        log.info("📋 POST-PROCESSING: Citation level for '{}' is {}", documentType, postProcessingLevel);

        switch (postProcessingLevel) {
            case COMPREHENSIVE:
                // Verify citations for comprehensive documents (motions, briefs, memos, pleadings)
                log.info("🔍 POST-PROCESSING: Verifying citations and injecting URLs in legal brief/motion");

                try {
                    // Step 1: Verify case law citations via CourtListener/Justia
                    content = legalResearchService.verifyAllCitationsInResponse(content);
                    log.info("✅ Citation verification complete");

                    // Step 2: Inject URLs for statutory/rule citations (FRCP, state statutes, CFR, etc.)
                    content = citationUrlInjector.inject(content);
                    log.info("✅ URL injection complete");
                } catch (Exception e) {
                    log.error("❌ POST-PROCESSING failed: {}", e.getMessage(), e);
                    // Continue anyway - better to have document without links than no document
                }
                break;

            case MINIMAL:
                // Skip case law verification for minimal citation documents (demand letters, discovery, correspondence)
                log.info("📋 Skipping case law verification for minimal-citation document ({})", documentType);
                log.info("ℹ️ Only statutory URL injection will run (if any statutes present)");

                try {
                    // Still inject URLs for any statutory citations (G.L. c., CFR, etc.)
                    content = citationUrlInjector.inject(content);
                    log.info("✅ URL injection complete");
                } catch (Exception e) {
                    log.error("❌ URL injection failed: {}", e.getMessage(), e);
                }
                break;

            case NONE:
                // No citation processing for transactional documents (contracts, agreements)
                log.info("📋 No citation processing for transactional document ({})", documentType);
                // Don't run any citation verification or URL injection
                break;
        }
        } // end if (!content.startsWith("<!-- HTML_TEMPLATE -->"))

        // 5d. Apply §6.1 gating: watermark banner (draft/in_review), overdue note, disclaimer footer.
        // Runs AFTER citation processing so URL injection/verification sees the original AI content
        // without gating markup (which would confuse regex-based citation detectors).
        content = documentGatingService.applyContentGating(content, gating);

        // 6. Validate content completeness (monitoring only - non-blocking)
        String validationWarning = validateDocumentCompleteness(content);
        if (validationWarning != null) {
            log.warn("⚠️ Document quality check: {}", validationWarning);
            log.warn("📋 Document will be delivered to user for review. Attorney can fill any placeholders or gaps.");
            // Continue normally - always save and return document
            // Prompt improvements should prevent incomplete lists via placeholders
        }

        // 7. Calculate metrics
        int tokensUsed = estimateTokens(content);
        BigDecimal cost = calculateCost(tokensUsed);
        int wordCount = countWords(content);

        // 8. Create document
        AiWorkspaceDocument document = AiWorkspaceDocument.builder()
            .userId(userId)
            .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
            .caseId(caseId)
            .sessionId(conversation.getId())
            .title(sessionName)
            .documentType(documentType)
            .jurisdiction(jurisdiction)
            .currentVersion(1)
            .status("DRAFT")
            .build();

        document = documentRepository.save(document);

        // 9. Create initial version
        AiWorkspaceDocumentVersion initialVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
            .organizationId(document.getOrganizationId())
            .versionNumber(1)
            .content(content)
            .wordCount(wordCount)
            .transformationType("INITIAL_GENERATION")
            .transformationScope("FULL_DOCUMENT")
            .createdByUser(false)
            .tokensUsed(tokensUsed)
            .costEstimate(cost)
            .build();

        versionRepository.save(initialVersion);

        // 9b. Auto-attach case documents as exhibits AFTER transaction commits
        // (runs in separate connection to avoid PostgreSQL 25P02 cascade on failure)
        final Long docId = document.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                autoAttachInProgress.put(docId, true);
                CompletableFuture.runAsync(() -> autoAttachCaseDocumentsAsExhibits(docId, caseId, orgId));
            }
        });

        // 10. Update conversation with relatedDraftId
        conversation.setRelatedDraftId(document.getId().toString());
        conversationRepository.save(conversation);

        // 11. Add AI response message
        String aiResponse = "I've generated your " + documentType +
            (caseId != null && legalCase != null ? " for Case #" + legalCase.getCaseNumber() : "") +
            ". You can view it in the document preview panel.";
        conversationService.addMessage(conversation.getId(), userId, "assistant", aiResponse, null);

        // 11b. Audit-log the generation event with gating metadata. Async — never blocks the response.
        logGenerationAuditEvent(userId, orgId, documentType, jurisdiction, effectivePracticeArea,
                document.getId(), gating, "DRAFT_GENERATION");

        // 12. Build response
        return DraftGenerationResponse.builder()
            .conversationId(conversation.getId())
            .documentId(document.getId())
            .document(DraftGenerationResponse.DocumentDTO.builder()
                .id(document.getId())
                .caseId(caseId)
                .title(sessionName)
                .content(content)
                .wordCount(wordCount)
                .version(1)
                .tokensUsed(tokensUsed)
                .costEstimate(cost)
                .generatedAt(document.getCreatedAt())
                .approvalStatus(effectiveApprovalStatus(document, gating))
                .isVerificationOverdue(gating.isOverdue())
                .templateVersion(gating.templateVersion())
                .lastVerified(gating.lastVerified())
                .build())
            .conversation(DraftGenerationResponse.ConversationDTO.builder()
                .id(conversation.getId())
                .caseId(caseId)
                .sessionName(sessionName)
                .taskType("GENERATE_DRAFT")
                .relatedDraftId(document.getId().toString())
                .createdAt(conversation.getCreatedAt())
                .build())
            .build();
    }

    /**
     * Deterministic "draft from template" — fills the template's {@code {{var}}}
     * placeholders with the supplied values. NO AI in the core path.
     *
     * <p>Behavior:</p>
     * <ul>
     *   <li>Required variables missing or blank → 400 {@link IllegalArgumentException} listing them.</li>
     *   <li>Optional variables missing or blank → rendered as {@code [Missing: name]} so the
     *       attorney can spot gaps during proofread.</li>
     *   <li>Values are HTML-escaped before insertion so {@code Smith & Jones} doesn't break markup.</li>
     *   <li>If {@code additionalInstructions} is non-blank, a single AI tweak pass runs AFTER
     *       substitution using those instructions as guidance — strictly opt-in.</li>
     * </ul>
     *
     * <p>Persisted as a workspace document with {@code status='DRAFT'} and
     * {@code approval_status='draft'}, mirroring the AI-generated path so the
     * UI behaves identically post-creation. The selection-toolbar AI transforms
     * (Polish/Condense/Expand/Custom) work on this draft just like on any other.</p>
     */
    @Transactional
    public DraftGenerationResponse createDraftFromTemplate(Long userId, DraftFromTemplateRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (request.getTemplateId() == null) {
            throw new IllegalArgumentException("templateId is required");
        }
        if (userId == null) {
            throw new IllegalArgumentException("userId is required");
        }

        Long orgId = getRequiredOrganizationId();

        // 1. Verify case access if a case is linked. caseId is optional — drafting from a
        //    template doesn't strictly require a case (e.g. generic letter, sample doc).
        LegalCase legalCase = null;
        if (request.getCaseId() != null) {
            legalCase = caseRepository.findByIdAndOrganizationId(request.getCaseId(), orgId)
                    .orElseThrow(() -> new IllegalArgumentException("Case not found: " + request.getCaseId()));
        }

        // 2. Load template (org-scoped + privacy-aware — same rules as AITemplateService.getTemplateById)
        AILegalTemplate template = aiLegalTemplateRepository
                .findByIdAndAccessibleByOrganizationAndUser(request.getTemplateId(), orgId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found or access denied: " + request.getTemplateId()));

        if (template.getTemplateContent() == null || template.getTemplateContent().isBlank()) {
            throw new IllegalArgumentException("Template " + template.getId() + " has no body content");
        }

        // 3. Load variable definitions (tenant safety inherited via the template ownership check above)
        List<AITemplateVariable> definitions = aiTemplateVariableRepository.findByTemplateId(template.getId());

        // 4. Validate required vars
        Map<String, String> values = request.getVariableValues() != null
                ? request.getVariableValues()
                : Collections.emptyMap();
        List<String> missingRequired = new ArrayList<>();
        for (AITemplateVariable def : definitions) {
            if (Boolean.TRUE.equals(def.getIsRequired())) {
                String v = values.get(def.getVariableName());
                if (v == null || v.trim().isEmpty()) {
                    missingRequired.add(def.getVariableName());
                }
            }
        }
        if (!missingRequired.isEmpty()) {
            throw new IllegalArgumentException("Missing required template variables: " + String.join(", ", missingRequired));
        }

        // 5. Deterministic substitution
        String content = substituteTemplateVariables(template.getTemplateContent(), definitions, values);

        // 6. Optional AI tweak (only when attorney supplied non-blank instructions)
        boolean aiTweakApplied = false;
        String additional = request.getAdditionalInstructions();
        if (additional != null && !additional.trim().isEmpty()) {
            content = applyTemplateAiTweak(content, additional.trim());
            aiTweakApplied = true;
        }

        // 6b. Tag content as pre-rendered HTML so the AI workspace's content loader
        //     (setCKEditorContentFromMarkdown) skips markdown conversion. Without this
        //     marker the loader runs the body through a markdown→HTML converter, which
        //     mangles paragraph structure and adds incorrect spacing. Same marker the
        //     AI's HTML-template path uses, so PDF/Word export, version history, and
        //     selection-toolbar transforms all already understand it.
        if (!content.trim().startsWith("<!-- HTML_TEMPLATE -->")) {
            content = "<!-- HTML_TEMPLATE -->\n" + content;
        }

        // 7. Resolve session name (default: "<Template Name> · Case #<num>" or just template name)
        String sessionName = request.getSessionName();
        if (sessionName == null || sessionName.trim().isEmpty()) {
            if (legalCase != null && legalCase.getCaseNumber() != null) {
                sessionName = template.getName() + " · Case #" + legalCase.getCaseNumber();
            } else {
                sessionName = template.getName();
            }
        }

        // 8. Conversation session — even though no AI was used in the core path, the response
        //    shape requires a conversationId; this also gives Polish/Refine etc. a session to attach to.
        // taskType uses the same value as the AI draft flow ("GENERATE_DRAFT") so
        // this conversation shows up in the LegiDraft "Recent drafts" sidebar.
        // The audit log below records "DRAFT_FROM_TEMPLATE" for analytics — that's
        // a different field and doesn't affect the conversation classifier on the
        // frontend.
        AiConversationSession conversation = AiConversationSession.builder()
                .userId(userId)
                .organizationId(orgId)
                .caseId(request.getCaseId())
                .sessionName(sessionName)
                .sessionType("case-specific")
                .taskType("GENERATE_DRAFT")
                .researchMode("FAST")
                .jurisdiction(template.getJurisdiction())
                .isActive(true)
                .build();
        conversation = conversationRepository.save(conversation);

        // 9. Document
        int wordCount = countWords(content);
        AiWorkspaceDocument document = AiWorkspaceDocument.builder()
                .userId(userId)
                .organizationId(orgId)
                .caseId(request.getCaseId())
                .sessionId(conversation.getId())
                .title(sessionName)
                .documentType(template.getDocumentType())
                .jurisdiction(template.getJurisdiction())
                .currentVersion(1)
                .status("DRAFT")
                .build();
        document = documentRepository.save(document);

        // 10. Initial version
        AiWorkspaceDocumentVersion initialVersion = AiWorkspaceDocumentVersion.builder()
                .document(document)
                .organizationId(orgId)
                .versionNumber(1)
                .content(content)
                .wordCount(wordCount)
                .transformationType("INITIAL_GENERATION")
                .transformationScope("FULL_DOCUMENT")
                .createdByUser(false)
                .build();
        versionRepository.save(initialVersion);

        // 11. Wire up conversation → draft pointer
        conversation.setRelatedDraftId(document.getId().toString());
        conversationRepository.save(conversation);

        // 12. Auto-attach case documents as exhibits AFTER transaction commits — same as the AI path,
        //     so the workspace is feature-parity regardless of how the draft was created.
        //     Skip when no case is linked (nothing to attach from).
        if (request.getCaseId() != null) {
            final Long docId = document.getId();
            final Long caseIdFinal = request.getCaseId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    autoAttachInProgress.put(docId, true);
                    CompletableFuture.runAsync(() -> autoAttachCaseDocumentsAsExhibits(docId, caseIdFinal, orgId));
                }
            });
        }

        // 13. Audit log — best effort, never breaks the response
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("templateId", template.getId());
            payload.put("templateName", template.getName());
            payload.put("documentType", template.getDocumentType());
            payload.put("jurisdiction", template.getJurisdiction());
            payload.put("variableCount", definitions.size());
            payload.put("aiTweakApplied", aiTweakApplied);
            String summary = String.format("Drafted '%s' from template (aiTweak=%s)",
                    template.getName(), aiTweakApplied);
            aiAuditLogService.logGenerationEvent(
                    userId, null, null, orgId, "DRAFT_FROM_TEMPLATE",
                    "workspace_document", document.getId(),
                    payload, summary, true, null);
        } catch (Exception e) {
            log.warn("Audit log for DRAFT_FROM_TEMPLATE failed: {}", e.getMessage());
        }

        log.info("✅ Drafted from template {} → document {} (aiTweak={}, vars={})",
                template.getId(), document.getId(), aiTweakApplied, definitions.size());

        // 14. Response — same shape as the AI path so the frontend handler stays unified
        return DraftGenerationResponse.builder()
                .conversationId(conversation.getId())
                .documentId(document.getId())
                .document(DraftGenerationResponse.DocumentDTO.builder()
                        .id(document.getId())
                        .caseId(request.getCaseId())
                        .title(sessionName)
                        .content(content)
                        .wordCount(wordCount)
                        .version(1)
                        .generatedAt(document.getCreatedAt())
                        .approvalStatus(document.getApprovalStatus())
                        .build())
                .conversation(DraftGenerationResponse.ConversationDTO.builder()
                        .id(conversation.getId())
                        .caseId(request.getCaseId())
                        .sessionName(sessionName)
                        // Same as conversation.taskType — keeps the front-end's draft
                        // classifier (which keys off this field) consistent.
                        .taskType("GENERATE_DRAFT")
                        .relatedDraftId(document.getId().toString())
                        .createdAt(conversation.getCreatedAt())
                        .build())
                .build();
    }

    /**
     * Replace each declared {@code {{variableName}}} in the template body with the user's
     * value (HTML-escaped) or {@code [Missing: name]} when blank. Tolerant of optional
     * whitespace inside braces ({@code {{ name }}}) and replaces ALL occurrences.
     *
     * <p>Logs a warning if the body contains undeclared {@code {{...}}} placeholders after
     * substitution — those slip through unchanged and indicate template/variable-definition
     * drift (template body edited after variable extraction, or an import bug).</p>
     */
    private String substituteTemplateVariables(String body, List<AITemplateVariable> definitions,
                                               Map<String, String> values) {
        if (body == null) return "";
        String result = body;
        for (AITemplateVariable def : definitions) {
            String name = def.getVariableName();
            if (name == null || name.isBlank()) continue;
            String value = values.get(name);
            String replacement = (value == null || value.trim().isEmpty())
                    ? "[Missing: " + name + "]"
                    : HtmlUtils.htmlEscape(value);
            // Pattern.quote escapes regex metachars in the variable name; \s* tolerates {{ name }}.
            String regex = "\\{\\{\\s*" + Pattern.quote(name) + "\\s*\\}\\}";
            result = result.replaceAll(regex, Matcher.quoteReplacement(replacement));
        }

        // Detect orphan placeholders — surfaces drift between the body and the declared
        // variable rows. We do NOT touch them (preserving deterministic behavior); just log.
        Matcher orphans = Pattern.compile("\\{\\{\\s*([^}\\s]+)\\s*\\}\\}").matcher(result);
        Set<String> orphanNames = new LinkedHashSet<>();
        while (orphans.find()) {
            orphanNames.add(orphans.group(1));
        }
        if (!orphanNames.isEmpty()) {
            log.warn("Template body contains undeclared placeholders left unsubstituted: {}", orphanNames);
        }
        return result;
    }

    /**
     * Single-shot AI pass over already-substituted content using attorney-supplied guidance.
     * Strict prompt that tells the model to preserve the document's structure and the literal
     * field values that were just substituted in. On any AI error, return the substituted
     * content unchanged so the draft still gets saved.
     */
    private String applyTemplateAiTweak(String substitutedContent, String instructions) {
        String userPrompt = "Apply the following guidance to the document below.\n\n" +
                "STRICT RULES:\n" +
                "- Preserve the document's existing structure, headings, and the literal field values that are already filled in.\n" +
                "- Do NOT remove or change factual data points (names, dates, amounts, addresses).\n" +
                "- Apply ONLY the requested tweaks; leave everything else unchanged.\n" +
                "- Return the same format as the input (HTML in → HTML out).\n\n" +
                "GUIDANCE:\n" + instructions + "\n\n" +
                "DOCUMENT:\n" + substitutedContent + "\n\n" +
                "Return only the revised document — no commentary or explanation.";

        String systemMessage = "You are a careful legal-document editor. Apply the user's tweak " +
                "instructions to the supplied document while preserving all factual content " +
                "and the document's structure. Return only the revised document.";

        try {
            String tweaked = aiRequestRouter.routeSimple(
                    com.bostoneo.bostoneosolutions.enumeration.AIOperationType.DOCUMENT_ENHANCEMENT,
                    userPrompt, systemMessage, false, null
            ).join();
            return (tweaked == null || tweaked.isBlank()) ? substitutedContent : tweaked;
        } catch (Exception e) {
            log.warn("AI tweak pass failed; returning substituted content unchanged: {}", e.getMessage());
            return substitutedContent;
        }
    }

    /**
     * Build a structured audit payload for a gating-aware generation event and emit asynchronously.
     * The payload stays small and flat (strings/booleans only) so JSONB queries remain efficient.
     */
    private void logGenerationAuditEvent(Long userId, Long orgId, String documentType,
                                         String jurisdiction, String practiceArea,
                                         Long documentId, GatingContext gating, String action) {
        try {
            java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("documentType", documentType);
            payload.put("practiceArea", practiceArea);
            payload.put("jurisdiction", jurisdiction);
            payload.put("resolvedTemplateType", gating.templateType());
            payload.put("templateVersion", gating.templateVersion());
            payload.put("approvalStatus", gating.approvalStatus());
            payload.put("watermarked", gating.requiresWatermark());
            payload.put("overdue", gating.isOverdue());
            payload.put("hasDisclaimer", gating.hasDisclaimer());
            payload.put("lastVerified", gating.lastVerified());
            payload.put("nextReviewDue", gating.nextReviewDue());

            String summary = String.format("Generated %s (approval=%s, overdue=%s, watermarked=%s)",
                    documentType,
                    gating.approvalStatus() != null ? gating.approvalStatus() : "none",
                    gating.isOverdue(),
                    gating.requiresWatermark());

            aiAuditLogService.logGenerationEvent(
                    userId, null, null, orgId, action,
                    "workspace_document", documentId,
                    payload, summary, true, null);
        } catch (Exception e) {
            // Audit logging must never break generation
            log.warn("Failed to enqueue gating audit event: {}", e.getMessage());
        }
    }

    /**
     * Generate a draft via streaming. NOT @Transactional — the streaming call runs for minutes.
     * Tokens are relayed to the SSE emitter as they arrive.
     * Post-processing + DB save happen after the stream completes.
     *
     * Must be called from a background thread (CompletableFuture.runAsync).
     * Caller must capture orgId/userId before going async and pass them explicitly.
     */
    public void generateDraftStreaming(
            Long userId,
            Long orgId,
            Long caseId,
            String prompt,
            String documentType,
            String jurisdiction,
            String sessionName,
            Long conversationId,
            String researchMode,
            Long documentId,
            Long stationeryTemplateId,
            Long stationeryAttorneyId,
            String courtLevel,
            String practiceArea,
            java.util.Map<String, Object> documentOptions
    ) {
        log.info("Starting streaming draft generation: userId={}, conversationId={}, type={}",
                userId, conversationId, documentType);

        // Set tenant context for this async thread — orgId was captured from the request thread
        TenantContext.setCurrentTenant(orgId);

        // Validate medical records and summary exist before generating demand letter
        // (checked here because this method is called from both LegiDraft and LegiPI controllers)
        if (isDemandLetterType(documentType) && caseId != null) {
            List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByCaseId(caseId);
            if (records == null || records.isEmpty()) {
                draftStreamingPublisher.sendError(conversationId,
                    "Medical records must be scanned before generating a demand letter. " +
                    "Go to the Medical Records tab and scan your case documents first.");
                return;
            }
            try {
                PIMedicalSummaryDTO summary = medicalSummaryService.getMedicalSummary(caseId);
                if (summary == null) {
                    draftStreamingPublisher.sendError(conversationId,
                        "A medical summary must be generated before creating a demand letter. " +
                        "Go to the Medical Summary tab and click Generate Summary.");
                    return;
                }
            } catch (Exception e) {
                draftStreamingPublisher.sendError(conversationId,
                    "A medical summary must be generated before creating a demand letter. " +
                    "Go to the Medical Summary tab and click Generate Summary.");
                return;
            }
        }

        // Note: ALB heartbeats are handled automatically by DraftStreamingPublisher
        // (every 20s via ScheduledExecutorService) — no manual pings needed here.

        // 1. Fetch case context
        String caseContext = "";
        LegalCase legalCase = null;
        if (caseId != null) {
            legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId).orElse(null);
            if (legalCase != null) {
                if (isDemandLetterType(documentType)) {
                    caseContext = buildDemandLetterCaseData(caseId, orgId);
                    log.info("Using comprehensive demand letter case data for type: {}", documentType);
                } else if (isLetterType(documentType)) {
                    caseContext = buildFullCaseData(caseId);
                    log.info("Enriched case context with full case data for letter type: {}", documentType);
                } else {
                    caseContext = buildCaseContext(legalCase);
                }
            }
        }

        // 2a. Fetch exhibits if a workspace document already exists, filtering out deleted source docs
        List<AiWorkspaceDocumentExhibit> exhibits = Collections.emptyList();
        if (documentId != null) {
            exhibits = exhibitRepository.findByDocumentIdAndOrgId(documentId, orgId);
            exhibits = exhibitService.filterActiveExhibits(exhibits);
            if (!exhibits.isEmpty()) {
                log.info("Found {} active exhibits for document {} to include in streaming prompt", exhibits.size(), documentId);
            }
        }

        // 2b. Look up stationery context if document has stationery applied
        String stationeryContext = resolveStationeryContext(documentId, orgId, stationeryTemplateId, stationeryAttorneyId);

        // 2c. Build prompt with stationery awareness (system + user message split)
        String effectiveCourtLevel = (courtLevel != null && !courtLevel.isBlank()) ? courtLevel : "DEFAULT";
        // Resolve practice area: explicit param overrides, else fall back to the case's practice area
        String effectivePracticeArea = (practiceArea != null && !practiceArea.isBlank())
                ? practiceArea
                : (legalCase != null ? legalCase.getPracticeArea() : null);
        DraftPrompt draftPrompt = buildDraftPrompt(prompt, documentType, jurisdiction, caseContext, legalCase, researchMode, exhibits, stationeryContext, effectiveCourtLevel, effectivePracticeArea, documentOptions);

        // 2d. Resolve template + gating ONCE before streaming starts — the same context is applied
        // post-stream inside the onComplete callback. Captured in an effectively-final variable so
        // the lambda can see it without additional synchronization.
        com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate streamResolvedTemplate =
                templateRegistry.getResolvedTemplate(documentType, effectivePracticeArea, jurisdiction);
        final GatingContext streamGating = documentGatingService.computeGating(streamResolvedTemplate);
        if (streamGating.isOverdue()) {
            log.warn("⚠️ (streaming) Template {} (v{}) verification is OVERDUE — nextReviewDue={}",
                    streamGating.templateType(), streamGating.templateVersion(), streamGating.nextReviewDue());
        }

        // 3. Check cancellation
        if (cancellationService.isCancelled(conversationId)) {
            log.warn("Streaming generation cancelled before API call for conversation {}", conversationId);
            cancellationService.clearCancellation(conversationId);
            draftStreamingPublisher.sendError(conversationId, "Generation cancelled by user");
            return;
        }

        // 4. Stream tokens
        StringBuilder accumulated = new StringBuilder();
        final LegalCase finalCase = legalCase;

        // Route streaming through AIRequestRouter for smart model selection
        com.bostoneo.bostoneosolutions.dto.ai.AIRoutingRequest streamingRequest = com.bostoneo.bostoneosolutions.dto.ai.AIRoutingRequest.builder()
                .operationType(com.bostoneo.bostoneosolutions.enumeration.AIOperationType.DRAFT_GENERATION_STREAMING)
                .query(draftPrompt.userMessage())
                .systemMessage(draftPrompt.systemMessage())
                .sessionId(conversationId)
                .build();

        aiRequestRouter.routeStreaming(
                streamingRequest,
                // tokenConsumer: relay to SSE + accumulate
                token -> {
                    accumulated.append(token);
                    draftStreamingPublisher.sendToken(conversationId, token);
                },
                // onComplete: dispatch to a blocking thread for post-processing + DB save
                // (runs on Reactor Netty event loop — must not block)
                () -> CompletableFuture.runAsync(() -> {
                    TenantContext.setCurrentTenant(orgId);
                    try {
                        String content = accumulated.toString();

                        // Template rendering: for supported types, parse JSON and inject into HTML template
                        if (documentTemplateEngine.supportsTemplateGeneration(documentType)) {
                            try {
                                content = renderWithTemplate(content, finalCase, jurisdiction, documentType, userId, orgId, effectiveCourtLevel, stationeryTemplateId, stationeryAttorneyId);
                                log.info("✅ Template rendering complete (streaming path)");
                            } catch (Exception e) {
                                log.warn("⚠️ Template rendering failed (streaming), using raw content: {}", e.getMessage());
                            }
                        }

                        // Post-processing: for template HTML, only run URL injection (safe for HTML)
                        // Skip full AI citation verification which could corrupt HTML structure
                        if (content.startsWith("<!-- HTML_TEMPLATE -->")) {
                            try {
                                draftStreamingPublisher.sendPostProcessing(conversationId, "Injecting citation URLs...");
                                content = citationUrlInjector.inject(content);
                                log.info("URL injection complete for template HTML");
                            } catch (Exception e) {
                                log.warn("URL injection failed for template HTML: {}", e.getMessage());
                            }
                        } else {
                            content = postProcessDraftContent(content, documentType, conversationId);
                        }

                        // §6.1 gating: stamp banner/disclaimer after citation processing so regex-based
                        // URL injection does not see the gating markup.
                        content = documentGatingService.applyContentGating(content, streamGating);

                        // Validate completeness (monitoring only)
                        String validationWarning = validateDocumentCompleteness(content);
                        if (validationWarning != null) {
                            log.warn("Document quality check: {}", validationWarning);
                        }

                        // Save to DB via programmatic transaction
                        Map<String, Object> savedDoc = saveDraftDocument(
                                userId, orgId, caseId, conversationId, sessionName,
                                documentType, jurisdiction, content, finalCase
                        );

                        // Audit-log the streaming generation event with gating metadata
                        Long savedDocId = (savedDoc != null && savedDoc.get("documentId") != null)
                                ? ((Number) savedDoc.get("documentId")).longValue() : null;
                        logGenerationAuditEvent(userId, orgId, documentType, jurisdiction,
                                effectivePracticeArea, savedDocId, streamGating, "DRAFT_GENERATION_STREAMING");

                        // Send complete event with metadata
                        Map<String, Object> completePayload = new HashMap<>();
                        if (savedDoc != null) {
                            completePayload.put("documentId", savedDoc.get("documentId"));
                            completePayload.put("wordCount", savedDoc.get("wordCount"));
                            completePayload.put("tokensUsed", savedDoc.get("tokensUsed"));
                            completePayload.put("costEstimate", savedDoc.get("costEstimate"));
                        } else {
                            log.error("Failed to save draft document for conversation {}", conversationId);
                        }
                        completePayload.put("conversationId", conversationId);
                        completePayload.put("title", sessionName);
                        completePayload.put("content", content);
                        completePayload.put("version", 1);
                        // §6.1 gating metadata for the client UI.
                        // Per-doc approval_status wins over template default so freshly-saved
                        // drafts always start watermarked as 'draft' regardless of template state.
                        AiWorkspaceDocument savedDocEntity = savedDocId != null
                                ? documentRepository.findById(savedDocId).orElse(null)
                                : null;
                        completePayload.put("approvalStatus", effectiveApprovalStatus(savedDocEntity, streamGating));
                        completePayload.put("isVerificationOverdue", streamGating.isOverdue());
                        completePayload.put("templateVersion", streamGating.templateVersion());
                        completePayload.put("lastVerified", streamGating.lastVerified());

                        draftStreamingPublisher.sendComplete(conversationId, completePayload);

                    } catch (Exception e) {
                        log.error("Post-processing failed for conversation {}: {}", conversationId, e.getMessage(), e);
                        draftStreamingPublisher.sendError(conversationId, "Post-processing failed: " + e.getMessage());
                    } finally {
                        TenantContext.clear();
                    }
                }),
                // onError
                error -> {
                    log.error("Streaming generation failed for conversation {}: {}", conversationId, error.getMessage());
                    draftStreamingPublisher.sendError(conversationId,
                            error.getMessage() != null ? error.getMessage() : "AI service unavailable");
                }
        );
    }

    /**
     * Post-process draft content: citation verification + URL injection.
     * Extracted from generateDraftWithConversation for reuse in streaming path.
     */
    private String postProcessDraftContent(String content, String documentType, Long conversationId) {
        CitationLevel postProcessingLevel = getCitationLevel(documentType);
        log.info("POST-PROCESSING (streaming): Citation level for '{}' is {}", documentType, postProcessingLevel);

        draftStreamingPublisher.sendPostProcessing(conversationId, "Verifying citations...");

        switch (postProcessingLevel) {
            case COMPREHENSIVE:
                try {
                    content = legalResearchService.verifyAllCitationsInResponse(content);
                    log.info("Citation verification complete");
                    draftStreamingPublisher.sendPostProcessing(conversationId, "Injecting citation URLs...");
                    content = citationUrlInjector.inject(content);
                    log.info("URL injection complete");
                } catch (Exception e) {
                    log.error("POST-PROCESSING failed: {}", e.getMessage(), e);
                }
                break;
            case MINIMAL:
                try {
                    content = citationUrlInjector.inject(content);
                    log.info("URL injection complete");
                } catch (Exception e) {
                    log.error("URL injection failed: {}", e.getMessage(), e);
                }
                break;
            case NONE:
                log.info("No citation processing for transactional document ({})", documentType);
                break;
        }

        return content;
    }

    /**
     * Auto-attach all case documents as exhibits for the given workspace document.
     * Non-blocking: failures are logged as warnings and do not propagate.
     */
    private void autoAttachCaseDocumentsAsExhibits(Long documentId, Long caseId, Long orgId) {
        if (caseId == null) {
            autoAttachInProgress.remove(documentId);
            return;
        }
        List<Long> savedExhibitIds = new ArrayList<>();
        try {
            // Clean up exhibits linked to since-deleted file_items before attaching fresh ones
            exhibitRepository.deleteStaleExhibits(documentId, orgId);

            List<FileItem> caseFiles = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);
            if (caseFiles.isEmpty()) {
                return;
            }

            // Phase 1: Save all exhibits to DB (fast — no text extraction).
            // Text extraction is deferred to phase 2 because @Async self-invocation
            // within AiWorkspaceExhibitService bypasses Spring's proxy, causing each
            // OCR call (~10s) to block the loop sequentially.
            int skippedPrivileged = 0;
            for (FileItem file : caseFiles) {
                if (isPrivilegedDocument(file) || isNonExhibitDocument(file) || isContentMatchingNonExhibit(file, orgId)) {
                    skippedPrivileged++;
                    continue;
                }
                try {
                    AiWorkspaceDocumentExhibit saved = exhibitService.addExhibitFromFileItem(documentId, file, orgId, false);
                    savedExhibitIds.add(saved.getId());
                } catch (Exception e) {
                    log.warn("Failed to auto-attach file_item {} as exhibit: {}", file.getId(), e.getMessage());
                }
            }
            if (skippedPrivileged > 0) {
                log.info("Skipped {} privileged documents from auto-attach for document {}", skippedPrivileged, documentId);
            }
            if (!savedExhibitIds.isEmpty()) {
                log.info("Auto-attached {} case files as exhibits for document {}", savedExhibitIds.size(), documentId);
            }
        } catch (Exception e) {
            log.warn("Failed to auto-attach case files as exhibits: {}", e.getMessage());
        } finally {
            autoAttachInProgress.remove(documentId);
        }

        // Phase 2: Trigger text extraction via inter-bean call (goes through Spring proxy,
        // so @Async actually works — all extractions run in parallel, not blocking exhibit visibility).
        for (Long exhibitId : savedExhibitIds) {
            exhibitService.extractTextAsync(exhibitId, orgId);
        }
    }

    /**
     * Check if a file is a privileged/internal document that should NOT be exposed as an exhibit.
     * Uses category when set, falls back to filename pattern matching.
     */
    private boolean isPrivilegedDocument(FileItem file) {
        // Check document category if set — only block ATTORNEY_CLIENT_PRIVILEGE
        // CONFIDENTIAL and INTERNAL are access-control tiers, not privilege markers
        String category = file.getDocumentCategory();
        if (category != null && !category.isBlank()) {
            String upper = category.toUpperCase();
            if (upper.contains("ATTORNEY_CLIENT") || upper.contains("WORK_PRODUCT")) {
                return true;
            }
        }

        // Fallback: check filename patterns for common privileged document types
        String name = "";
        if (file.getOriginalName() != null) name = file.getOriginalName().toLowerCase();
        else if (file.getName() != null) name = file.getName().toLowerCase();

        String[] privilegedPatterns = {
            "fee-agreement", "fee agreement", "fee_agreement",
            "retainer",
            "firm-billing", "firm_billing", "legal-billing", "legal_billing", "client-billing", "client_billing",
            "firm-invoice", "firm_invoice", "legal-invoice", "legal_invoice",
            "attorney-client", "attorney_client", "attorney client",
            "work-product", "work product", "work_product",
            "settlement-authority", "settlement_authority",
            "internal-memo", "internal_memo", "internal memo",
            "contingent-fee", "contingent_fee", "contingent fee"
        };

        for (String pattern : privilegedPatterns) {
            if (name.contains(pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a file is an administrative/procedural document that should NOT appear as an exhibit
     * in a demand letter. These aren't privileged — they're just not evidence supporting the claim.
     */
    private boolean isNonExhibitDocument(FileItem file) {
        String name = "";
        if (file.getOriginalName() != null) name = file.getOriginalName().toLowerCase();
        else if (file.getName() != null) name = file.getName().toLowerCase();

        String[] nonExhibitPatterns = {
            // Letters of representation
            "letter of representation", "letter-of-representation", "letter_of_representation",
            "representation letter", "representation-letter", "representation_letter",
            // Mailing receipts
            "certified mail", "certified-mail", "certified_mail",
            "mail receipt", "mail-receipt", "mail_receipt",
            "return receipt", "return-receipt", "return_receipt",
            "proof of mailing", "proof-of-mailing", "proof_of_mailing",
            // Insurance administrative docs
            "claim form", "claim-form", "claim_form",
            "claim acknowledgment", "claim-acknowledgment", "claim_acknowledgment",
            "insurance card", "insurance-card", "insurance_card",
            "policy declaration", "policy-declaration", "policy_declaration",
            "declarations page", "declarations-page", "declarations_page",
            // Authorization forms
            "hipaa release", "hipaa-release", "hipaa_release",
            "hipaa authorization", "hipaa-authorization", "hipaa_authorization",
            "medical release", "medical-release", "medical_release",
            "medical authorization", "medical-authorization", "medical_authorization",
            "authorization form", "authorization-form", "authorization_form",
            "records request", "records-request", "records_request",
            // Intake/client forms
            "intake form", "intake-form", "intake_form",
            "client questionnaire", "client-questionnaire", "client_questionnaire"
        };

        for (String pattern : nonExhibitPatterns) {
            if (name.contains(pattern)) {
                return true;
            }
        }
        return false;
    }

    private static final String[] NON_EXHIBIT_CONTENT_PATTERNS = {
        "AUTHORIZATION FOR USE OR DISCLOSURE",
        "AUTHORIZATION FOR THE RELEASE OF",
        "HIPAA AUTHORIZATION",
        "HIPAA RELEASE",
        "MEDICAL RECORDS RELEASE",
        "AUTHORIZATION TO RELEASE PROTECTED HEALTH",
        "LETTER OF REPRESENTATION",
        "NOTICE OF REPRESENTATION",
        "REPRESENTATION AGREEMENT",
        "ATTORNEY-CLIENT FEE AGREEMENT",
        "CONTINGENT FEE AGREEMENT",
        "CONTINGENCY FEE AGREEMENT",
        "RETAINER AGREEMENT",
        "INTAKE QUESTIONNAIRE",
        "CLIENT QUESTIONNAIRE",
        "CERTIFIED MAIL RECEIPT",
        "RETURN RECEIPT REQUESTED",
        "PROOF OF MAILING"
    };

    private String lookupExtractedText(Long fileItemId, Long orgId) {
        if (fileItemId == null) return null;
        try {
            return fileItemTextCacheRepository
                .findByFileItemIdAndOrganizationId(fileItemId, orgId)
                .filter(c -> "success".equalsIgnoreCase(c.getExtractionStatus()))
                .map(com.bostoneo.bostoneosolutions.model.FileItemTextCache::getExtractedText)
                .orElse(null);
        } catch (Exception e) {
            log.warn("FileItemTextCache lookup failed for fileItemId={}: {}", fileItemId, e.getMessage());
            return null;
        }
    }

    /**
     * Content-based non-exhibit screen — complements the filename-based isNonExhibitDocument.
     * Catches HIPAA forms / LORs / fee agreements that were uploaded with generic filenames.
     */
    private boolean isContentMatchingNonExhibit(FileItem file, Long orgId) {
        String text = lookupExtractedText(file.getId(), orgId);
        if (text == null || text.isBlank()) return false;
        String head = text.substring(0, Math.min(2000, text.length())).toUpperCase();
        for (String pattern : NON_EXHIBIT_CONTENT_PATTERNS) {
            if (head.contains(pattern)) return true;
        }
        return false;
    }

    private String mimeFallbackLabel(String mime) {
        if (mime == null) return "Supporting Document";
        if (mime.startsWith("image/")) return "Photograph";
        return "Supporting Document";
    }

    /**
     * Save the draft document + version + update conversation in a single transaction.
     * Uses TransactionTemplate programmatically because this method is called from
     * async callbacks where @Transactional proxy interception does not work (self-invocation
     * + non-Spring-managed threads).
     */
    private Map<String, Object> saveDraftDocument(
            Long userId, Long orgId, Long caseId, Long conversationId,
            String sessionName, String documentType, String jurisdiction,
            String content, LegalCase legalCase
    ) {
        org.springframework.transaction.support.TransactionTemplate txTemplate =
                new org.springframework.transaction.support.TransactionTemplate(transactionManager);

        Map<String, Object> txResult = txTemplate.execute(status -> {
            int tokensUsed = estimateTokens(content);
            BigDecimal cost = calculateCost(tokensUsed);
            int wordCount = countWords(content);

            AiWorkspaceDocument document = AiWorkspaceDocument.builder()
                    .userId(userId)
                    .organizationId(orgId)
                    .caseId(caseId)
                    .sessionId(conversationId)
                    .title(sessionName)
                    .documentType(documentType)
                    .jurisdiction(jurisdiction)
                    .currentVersion(1)
                    .status("DRAFT")
                    .build();

            AiWorkspaceDocument savedDocument = documentRepository.save(document);

            AiWorkspaceDocumentVersion initialVersion = AiWorkspaceDocumentVersion.builder()
                    .document(savedDocument)
                    .organizationId(orgId)
                    .versionNumber(1)
                    .content(content)
                    .wordCount(wordCount)
                    .transformationType("INITIAL_GENERATION")
                    .transformationScope("FULL_DOCUMENT")
                    .createdByUser(false)
                    .tokensUsed(tokensUsed)
                    .costEstimate(cost)
                    .build();

            versionRepository.save(initialVersion);

            // Update conversation with relatedDraftId
            AiConversationSession conversation = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
                    .orElse(null);
            if (conversation != null) {
                conversation.setRelatedDraftId(savedDocument.getId().toString());
                conversationRepository.save(conversation);

                String aiResponse = "I've generated your " + documentType +
                        (caseId != null && legalCase != null ? " for Case #" + legalCase.getCaseNumber() : "") +
                        ". You can view it in the document preview panel.";
                conversationService.addMessage(conversation.getId(), userId, "assistant", aiResponse, null);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("documentId", savedDocument.getId());
            result.put("wordCount", wordCount);
            result.put("tokensUsed", tokensUsed);
            result.put("costEstimate", cost);

            log.info("Saved streaming draft: documentId={}, wordCount={}", savedDocument.getId(), wordCount);

            return result;
        });

        // Auto-attach case documents as exhibits AFTER transaction commits
        // (runs in separate connection to avoid PostgreSQL 25P02 cascade on failure)
        if (txResult != null && txResult.get("documentId") != null && caseId != null) {
            final Long savedDocId = (Long) txResult.get("documentId");
            autoAttachInProgress.put(savedDocId, true);
            CompletableFuture.runAsync(() -> autoAttachCaseDocumentsAsExhibits(savedDocId, caseId, orgId));
        }

        return txResult;
    }

    /**
     * Get document with latest version content
     */
    public Optional<Map<String, Object>> getDocumentWithLatestVersion(Long documentId, Long userId) {
        return documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .map(doc -> {
                // Get latest version
                AiWorkspaceDocumentVersion latestVersion = versionRepository
                    .findByDocumentIdOrderByVersionNumberDesc(doc.getId())
                    .stream()
                    .findFirst()
                    .orElse(null);

                if (latestVersion == null) {
                    return null;
                }

                Map<String, Object> result = new HashMap<>();
                result.put("id", doc.getId());
                result.put("title", doc.getTitle());
                result.put("documentType", doc.getDocumentType());
                result.put("content", latestVersion.getContent());
                result.put("wordCount", latestVersion.getWordCount());
                result.put("version", latestVersion.getVersionNumber());
                result.put("tokensUsed", latestVersion.getTokensUsed());
                result.put("costEstimate", latestVersion.getCostEstimate());
                result.put("generatedAt", latestVersion.getCreatedAt());
                result.put("stationeryTemplateId", doc.getStationeryTemplateId());
                result.put("stationeryAttorneyId", doc.getStationeryAttorneyId());

                // §6.1 gating metadata — re-derived from the template registry so
                // re-opened documents keep rendering the DRAFT watermark. Legacy
                // documents store the BASE type (e.g. "demand_letter") while the
                // registry keys include the practice-area suffix (e.g.
                // "demand_letter_pi_ma"), so we infer the practice area from the
                // linked case to let the 4-way cascade actually reach those keys.
                String practiceArea = resolvePracticeAreaForDoc(doc);
                DocumentTypeTemplate resolved = templateRegistry.getResolvedTemplate(
                        doc.getDocumentType(), practiceArea, doc.getJurisdiction());
                GatingContext gating = documentGatingService.computeGating(resolved);
                result.put("approvalStatus", effectiveApprovalStatus(doc, gating));
                result.put("isVerificationOverdue", gating.isOverdue());
                result.put("templateVersion", gating.templateVersion());
                result.put("lastVerified", gating.lastVerified());
                result.put("reviewedAt", doc.getReviewedAt());
                result.put("reviewNotes", doc.getReviewNotes());
                result.put("reviewRequestedAt", doc.getReviewRequestedAt());
                result.put("reviewedByUserId", doc.getReviewedByUserId());
                result.put("reviewRequestedByUserId", doc.getReviewRequestedByUserId());
                return result;
            });
    }

    /**
     * Look up the practice area for a document's linked case so §6.1 gating can
     * find templates keyed on the {type}_{pa} / {type}_{pa}_{state} cascade
     * branches. Returns null (safe for cascade) when the document has no case or
     * the case has no practice_area set.
     */
    private String resolvePracticeAreaForDoc(AiWorkspaceDocument doc) {
        if (doc.getCaseId() == null) return null;
        return caseRepository.findByIdAndOrganizationId(doc.getCaseId(), getRequiredOrganizationId())
                .map(LegalCase::getEffectivePracticeArea)
                .orElse(null);
    }

    /**
     * §6.1 review-state priority: if the doc has an attorney-driven approval_status
     * (set via the review endpoints), that wins over the template default. Falls
     * back to the template-level gating value for legacy docs where the column is
     * still NULL (shouldn't happen after V51 backfill, but safe).
     */
    private String effectiveApprovalStatus(AiWorkspaceDocument doc, GatingContext gating) {
        if (doc != null && doc.getApprovalStatus() != null && !doc.getApprovalStatus().isBlank()) {
            return doc.getApprovalStatus();
        }
        return gating != null ? gating.approvalStatus() : null;
    }

    // ==========================================================================
    // §6.1 Attorney Review State Machine (ABA Opinion 512 compliance)
    // ==========================================================================

    /**
     * Transition a document into 'in_review' so an attorney can formally review.
     * Any doc owner can request review. Allowed from: draft, changes_requested,
     * attorney_reviewed (for re-review after edits).
     */
    @Transactional
    public Map<String, Object> requestAttorneyReview(Long documentId, Long userId, String message) {
        AiWorkspaceDocument doc = documentRepository
                .findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        String current = normalizedApprovalStatus(doc);
        if (!Set.of("draft", "changes_requested", "attorney_reviewed").contains(current)) {
            throw new IllegalStateException("Cannot request review from state: " + current);
        }

        doc.setApprovalStatus("in_review");
        doc.setReviewRequestedByUserId(userId);
        doc.setReviewRequestedAt(LocalDateTime.now());
        // Clear prior review notes when starting a new review cycle so stale
        // feedback doesn't show alongside the new submission.
        if (!"changes_requested".equals(current)) {
            doc.setReviewNotes(message);
        } else if (message != null && !message.isBlank()) {
            doc.setReviewNotes(message);
        }
        documentRepository.save(doc);

        return buildReviewStateMap(doc);
    }

    /**
     * Attorney approves a document. Scoped by organization only (reviewer is
     * typically not the doc owner). Role gating is enforced at the controller.
     */
    @Transactional
    public Map<String, Object> approveDocument(Long documentId, Long reviewerUserId, String notes) {
        AiWorkspaceDocument doc = documentRepository
                .findByIdAndOrganizationId(documentId, getRequiredOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        String current = normalizedApprovalStatus(doc);
        if (!Set.of("draft", "in_review", "changes_requested").contains(current)) {
            throw new IllegalStateException("Cannot approve from state: " + current);
        }

        doc.setApprovalStatus("attorney_reviewed");
        doc.setReviewedByUserId(reviewerUserId);
        doc.setReviewedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) {
            doc.setReviewNotes(notes);
        }
        documentRepository.save(doc);

        return buildReviewStateMap(doc);
    }

    /**
     * Attorney rejects the document with change requests. Notes are required —
     * without them the doc owner has nothing to act on. Role gating is enforced
     * at the controller.
     */
    @Transactional
    public Map<String, Object> requestChanges(Long documentId, Long reviewerUserId, String notes) {
        if (notes == null || notes.isBlank()) {
            throw new IllegalArgumentException("Review notes are required when requesting changes");
        }

        AiWorkspaceDocument doc = documentRepository
                .findByIdAndOrganizationId(documentId, getRequiredOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        String current = normalizedApprovalStatus(doc);
        if (!Set.of("in_review", "draft").contains(current)) {
            throw new IllegalStateException("Cannot request changes from state: " + current);
        }

        doc.setApprovalStatus("changes_requested");
        doc.setReviewedByUserId(reviewerUserId);
        doc.setReviewedAt(LocalDateTime.now());
        doc.setReviewNotes(notes);
        documentRepository.save(doc);

        return buildReviewStateMap(doc);
    }

    /**
     * Doc owner reverts an approved/rejected doc back to draft (e.g. to make
     * further edits). Preserves reviewer columns so the audit trail remains
     * in the document snapshot — the audit log retains the full history.
     */
    @Transactional
    public Map<String, Object> revertToDraft(Long documentId, Long userId) {
        AiWorkspaceDocument doc = documentRepository
                .findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        doc.setApprovalStatus("draft");
        documentRepository.save(doc);

        return buildReviewStateMap(doc);
    }

    private String normalizedApprovalStatus(AiWorkspaceDocument doc) {
        return doc.getApprovalStatus() != null ? doc.getApprovalStatus() : "draft";
    }

    private Map<String, Object> buildReviewStateMap(AiWorkspaceDocument doc) {
        Map<String, Object> result = new HashMap<>();
        result.put("documentId", doc.getId());
        result.put("approvalStatus", doc.getApprovalStatus());
        result.put("reviewedByUserId", doc.getReviewedByUserId());
        result.put("reviewedAt", doc.getReviewedAt());
        result.put("reviewNotes", doc.getReviewNotes());
        result.put("reviewRequestedByUserId", doc.getReviewRequestedByUserId());
        result.put("reviewRequestedAt", doc.getReviewRequestedAt());
        return result;
    }

    /**
     * Get the last jurisdiction used for documents linked to a specific case.
     * Used to auto-populate the jurisdiction dropdown and detect mismatches.
     */
    public String getLastUsedJurisdiction(Long caseId) {
        return documentRepository.findLastJurisdictionByCaseIdAndOrganizationId(
            caseId, getRequiredOrganizationId()
        ).orElse(null);
    }

    /**
     * Find a completed document by conversation (session) ID.
     * Used by the frontend polling fallback when SSE drops mid-stream.
     */
    public Optional<Map<String, Object>> getDocumentByConversationId(Long conversationId, Long userId) {
        return documentRepository.findBySessionIdAndUserIdAndOrganizationId(conversationId, userId, getRequiredOrganizationId())
            .flatMap(doc -> {
                AiWorkspaceDocumentVersion latestVersion = versionRepository
                    .findByDocumentIdOrderByVersionNumberDesc(doc.getId())
                    .stream()
                    .findFirst()
                    .orElse(null);

                if (latestVersion == null) {
                    return Optional.empty();
                }

                Map<String, Object> result = new HashMap<>();
                result.put("documentId", doc.getId());
                result.put("title", doc.getTitle());
                result.put("content", latestVersion.getContent());
                result.put("wordCount", latestVersion.getWordCount());
                result.put("version", latestVersion.getVersionNumber());
                result.put("tokensUsed", latestVersion.getTokensUsed());
                result.put("costEstimate", latestVersion.getCostEstimate());

                // §6.1 gating metadata — ensures SSE-drop polling fallback still
                // flips the DRAFT watermark on when the client eventually receives
                // the completed payload via HTTP polling rather than the stream.
                // Practice area inferred from the linked case so the cascade can
                // reach {type}_{pa} / {type}_{pa}_{state} template keys.
                String practiceArea = resolvePracticeAreaForDoc(doc);
                DocumentTypeTemplate resolved = templateRegistry.getResolvedTemplate(
                        doc.getDocumentType(), practiceArea, doc.getJurisdiction());
                GatingContext gating = documentGatingService.computeGating(resolved);
                result.put("approvalStatus", effectiveApprovalStatus(doc, gating));
                result.put("isVerificationOverdue", gating.isOverdue());
                result.put("templateVersion", gating.templateVersion());
                result.put("lastVerified", gating.lastVerified());
                result.put("reviewedAt", doc.getReviewedAt());
                result.put("reviewNotes", doc.getReviewNotes());
                result.put("reviewRequestedAt", doc.getReviewRequestedAt());
                result.put("reviewedByUserId", doc.getReviewedByUserId());
                result.put("reviewRequestedByUserId", doc.getReviewRequestedByUserId());
                return Optional.of(result);
            });
    }

    /**
     * Build case context string for AI prompt
     */
    private String buildCaseContext(LegalCase legalCase) {
        StringBuilder ctx = new StringBuilder("\nCASE CONTEXT:\n");
        ctx.append("Case Number: ").append(safeStr(legalCase.getCaseNumber())).append("\n");
        ctx.append("Case Title: ").append(safeStr(legalCase.getTitle())).append("\n");
        ctx.append("Case Type: ").append(safeStr(legalCase.getEffectivePracticeArea())).append("\n");
        ctx.append("Court: ").append(safeStr(legalCase.getCourtroom())).append("\n");
        ctx.append("County: ").append(safeStr(legalCase.getCountyName())).append("\n");
        ctx.append("Status: ").append(safeStr(legalCase.getStatus())).append("\n");
        ctx.append("Client: ").append(safeStr(legalCase.getClientName())).append("\n");
        if (legalCase.getDefendantName() != null && !legalCase.getDefendantName().isBlank()) {
            ctx.append("Opposing Party: ").append(legalCase.getDefendantName()).append("\n");
        }
        if (legalCase.getJudgeName() != null && !legalCase.getJudgeName().isBlank()) {
            ctx.append("Judge: ").append(legalCase.getJudgeName()).append("\n");
        }
        if (legalCase.getPrimaryCharge() != null && !legalCase.getPrimaryCharge().isBlank()) {
            ctx.append("Primary Charge: ").append(legalCase.getPrimaryCharge()).append("\n");
        }
        if (legalCase.getChargeLevel() != null && !legalCase.getChargeLevel().isBlank()) {
            ctx.append("Charge Level: ").append(legalCase.getChargeLevel()).append("\n");
        }
        if (legalCase.getFilingDate() != null) {
            ctx.append("Filing Date: ").append(legalCase.getFilingDate()).append("\n");
        }
        if (legalCase.getDescription() != null && !legalCase.getDescription().isBlank()) {
            ctx.append("\nCase Description:\n").append(legalCase.getDescription()).append("\n");
        }
        return ctx.toString();
    }

    private static String safeStr(Object value) {
        return value != null ? value.toString() : "";
    }

    private static final java.text.NumberFormat CURRENCY_FORMAT = java.text.NumberFormat.getCurrencyInstance(java.util.Locale.US);

    /**
     * Build full case data for letter types (representation letters, demand letters, settlement letters).
     * Fetches party details, insurance info, medical records, damages, and medical summary.
     * This is the equivalent of AIPersonalInjuryController.fetchCaseDataForDemandLetter() but accessible
     * from the drafting taskcard.
     */
    private String buildFullCaseData(Long caseId) {
        StringBuilder sb = new StringBuilder();
        sb.append("\n============= CASE DATA (USE REAL VALUES) =============\n");

        try {
            // Fetch full case details via LegalCaseService (DTO has insurance, defendant, etc.)
            LegalCaseDTO caseDto = legalCaseService.getCase(caseId);
            if (caseDto != null) {
                sb.append("\nPARTIES & CLAIM INFORMATION:\n");
                sb.append(String.format("Client Name: %s\n", caseDto.getClientName() != null ? caseDto.getClientName() : "N/A"));
                if (caseDto.getDefendantName() != null && !caseDto.getDefendantName().isEmpty()) {
                    sb.append(String.format("Defendant Name: %s\n", caseDto.getDefendantName()));
                }
                if (caseDto.getDefendantAddress() != null && !caseDto.getDefendantAddress().isEmpty()) {
                    sb.append(String.format("Defendant Address: %s\n", caseDto.getDefendantAddress()));
                }
                // DEFENDANT'S (AT-FAULT PARTY'S) INSURANCE — use for letters to the defendant's insurer (e.g., policy-limits request)
                boolean hasDefendantInsurance =
                    (caseDto.getInsuranceCompany() != null && !caseDto.getInsuranceCompany().isEmpty()) ||
                    (caseDto.getInsuranceAdjusterName() != null && !caseDto.getInsuranceAdjusterName().isEmpty()) ||
                    (caseDto.getInsurancePolicyNumber() != null && !caseDto.getInsurancePolicyNumber().isEmpty()) ||
                    (caseDto.getInsurancePolicyLimit() != null);
                if (hasDefendantInsurance) {
                    sb.append("\nDEFENDANT'S INSURANCE (at-fault party):\n");
                    if (caseDto.getInsuranceCompany() != null && !caseDto.getInsuranceCompany().isEmpty()) {
                        sb.append(String.format("  Defendant's Insurance Company: %s\n", caseDto.getInsuranceCompany()));
                    }
                    if (caseDto.getInsuranceAdjusterName() != null && !caseDto.getInsuranceAdjusterName().isEmpty()) {
                        sb.append(String.format("  Defendant's Adjuster Name: %s\n", caseDto.getInsuranceAdjusterName()));
                    }
                    if (caseDto.getInsuranceAdjusterContact() != null && !caseDto.getInsuranceAdjusterContact().isEmpty()) {
                        sb.append(String.format("  Defendant's Adjuster Contact: %s\n", caseDto.getInsuranceAdjusterContact()));
                    }
                    if (caseDto.getInsuranceAdjusterEmail() != null && !caseDto.getInsuranceAdjusterEmail().isEmpty()) {
                        sb.append(String.format("  Defendant's Adjuster Email: %s\n", caseDto.getInsuranceAdjusterEmail()));
                    }
                    if (caseDto.getInsuranceAdjusterPhone() != null && !caseDto.getInsuranceAdjusterPhone().isEmpty()) {
                        sb.append(String.format("  Defendant's Adjuster Phone: %s\n", caseDto.getInsuranceAdjusterPhone()));
                    }
                    if (caseDto.getInsurancePolicyNumber() != null && !caseDto.getInsurancePolicyNumber().isEmpty()) {
                        sb.append(String.format("  Defendant's Policy/Claim Number: %s\n", caseDto.getInsurancePolicyNumber()));
                    }
                    if (caseDto.getInsurancePolicyLimit() != null) {
                        sb.append(String.format("  Defendant's Policy Limit: %s\n", CURRENCY_FORMAT.format(caseDto.getInsurancePolicyLimit())));
                    }
                }

                // CLIENT'S (OUR CLIENT'S OWN) INSURANCE — use for PIP applications, UIM notices, and letters to the client's own insurer
                boolean hasClientInsurance =
                    (caseDto.getClientInsuranceCompany() != null && !caseDto.getClientInsuranceCompany().isEmpty()) ||
                    (caseDto.getClientInsuranceAdjusterName() != null && !caseDto.getClientInsuranceAdjusterName().isEmpty()) ||
                    (caseDto.getClientInsurancePolicyNumber() != null && !caseDto.getClientInsurancePolicyNumber().isEmpty());
                if (hasClientInsurance) {
                    sb.append("\nCLIENT'S INSURANCE (our client's own carrier — for PIP / UIM):\n");
                    if (caseDto.getClientInsuranceCompany() != null && !caseDto.getClientInsuranceCompany().isEmpty()) {
                        sb.append(String.format("  Client's Insurance Company: %s\n", caseDto.getClientInsuranceCompany()));
                    }
                    if (caseDto.getClientInsuranceAdjusterName() != null && !caseDto.getClientInsuranceAdjusterName().isEmpty()) {
                        sb.append(String.format("  Client's Adjuster Name: %s\n", caseDto.getClientInsuranceAdjusterName()));
                    }
                    if (caseDto.getClientInsuranceAdjusterEmail() != null && !caseDto.getClientInsuranceAdjusterEmail().isEmpty()) {
                        sb.append(String.format("  Client's Adjuster Email: %s\n", caseDto.getClientInsuranceAdjusterEmail()));
                    }
                    if (caseDto.getClientInsuranceAdjusterPhone() != null && !caseDto.getClientInsuranceAdjusterPhone().isEmpty()) {
                        sb.append(String.format("  Client's Adjuster Phone: %s\n", caseDto.getClientInsuranceAdjusterPhone()));
                    }
                    if (caseDto.getClientInsurancePolicyNumber() != null && !caseDto.getClientInsurancePolicyNumber().isEmpty()) {
                        sb.append(String.format("  Client's Policy Number: %s\n", caseDto.getClientInsurancePolicyNumber()));
                    }
                }

                if (caseDto.getInjuryDate() != null) {
                    sb.append(String.format("\nDate of Incident: %s\n", caseDto.getInjuryDate()));
                }

                sb.append(String.format("\nCase Number: %s\n", caseDto.getCaseNumber()));
                sb.append(String.format("Case Type: %s\n", caseDto.getPracticeArea() != null ? caseDto.getPracticeArea() : "N/A"));
                if (caseDto.getDescription() != null && !caseDto.getDescription().isEmpty()) {
                    sb.append(String.format("Case Description: %s\n", caseDto.getDescription()));
                }
            }

            // Fetch medical records summary (for PI cases)
            try {
                List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByCaseId(caseId);
                if (records != null && !records.isEmpty()) {
                    sb.append("\n\nMEDICAL TREATMENT RECORDS:\n");
                    java.math.BigDecimal totalBilled = java.math.BigDecimal.ZERO;
                    for (PIMedicalRecordDTO rec : records) {
                        sb.append(String.format("- Provider: %s", rec.getProviderName() != null ? rec.getProviderName() : "Unknown"));
                        if (rec.getTreatmentDate() != null) {
                            sb.append(String.format(", Date: %s", rec.getTreatmentDate()));
                        }
                        if (rec.getDiagnoses() != null && !rec.getDiagnoses().isEmpty()) {
                            sb.append(String.format(", Diagnoses: %s", rec.getDiagnoses().stream()
                                .map(d -> String.format("%s (ICD: %s)",
                                    d.getOrDefault("name", d.getOrDefault("description", "Unknown")),
                                    d.getOrDefault("icdCode", d.getOrDefault("code", "N/A"))))
                                .collect(java.util.stream.Collectors.joining("; "))));
                        }
                        if (rec.getBilledAmount() != null) {
                            sb.append(String.format(", Billed: %s", CURRENCY_FORMAT.format(rec.getBilledAmount())));
                            totalBilled = totalBilled.add(rec.getBilledAmount());
                        }
                        sb.append("\n");
                        if (rec.getKeyFindings() != null && !rec.getKeyFindings().isEmpty()) {
                            sb.append(String.format("  Key Findings: %s\n", rec.getKeyFindings()));
                        }
                        if (rec.getTreatmentProvided() != null && !rec.getTreatmentProvided().isEmpty()) {
                            sb.append(String.format("  Treatment: %s\n", rec.getTreatmentProvided()));
                        }
                    }
                    sb.append(String.format("Total Medical Expenses: %s\n", CURRENCY_FORMAT.format(totalBilled)));
                }
            } catch (Exception e) {
                log.debug("No medical records for case {}: {}", caseId, e.getMessage());
            }

            // Fetch damages calculation
            try {
                PIDamageCalculationDTO damages = damageCalculationService.getDamageCalculation(caseId);
                if (damages != null) {
                    sb.append("\nDAMAGES CALCULATION:\n");
                    if (damages.getPastMedicalTotal() != null) {
                        sb.append(String.format("Past Medical: %s\n", CURRENCY_FORMAT.format(damages.getPastMedicalTotal())));
                    }
                    if (damages.getFutureMedicalTotal() != null && damages.getFutureMedicalTotal().compareTo(java.math.BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Future Medical: %s\n", CURRENCY_FORMAT.format(damages.getFutureMedicalTotal())));
                    }
                    if (damages.getLostWagesTotal() != null && damages.getLostWagesTotal().compareTo(java.math.BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Lost Wages: %s\n", CURRENCY_FORMAT.format(damages.getLostWagesTotal())));
                    }
                    if (damages.getPainSufferingTotal() != null && damages.getPainSufferingTotal().compareTo(java.math.BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Pain & Suffering: %s\n", CURRENCY_FORMAT.format(damages.getPainSufferingTotal())));
                    }
                    if (damages.getAdjustedDamagesTotal() != null) {
                        sb.append(String.format("Total Damages: %s\n", CURRENCY_FORMAT.format(damages.getAdjustedDamagesTotal())));
                    }
                }
            } catch (Exception e) {
                log.debug("No damage calculation for case {}: {}", caseId, e.getMessage());
            }

            // Fetch medical summary
            try {
                PIMedicalSummaryDTO summary = medicalSummaryService.getMedicalSummary(caseId);
                if (summary != null) {
                    if (summary.getDiagnosisList() != null && !summary.getDiagnosisList().isEmpty()) {
                        sb.append("\nDIAGNOSES:\n");
                        for (Map<String, Object> diag : summary.getDiagnosisList()) {
                            String name = (String) diag.getOrDefault("name", "Unknown");
                            String icdCode = (String) diag.getOrDefault("icdCode", null);
                            sb.append("- ").append(name);
                            if (icdCode != null && !"N/A".equals(icdCode)) {
                                sb.append(" (ICD: ").append(icdCode).append(")");
                            }
                            sb.append("\n");
                        }
                    }
                    if (summary.getPrognosisAssessment() != null && !"Not available".equals(summary.getPrognosisAssessment())) {
                        sb.append(String.format("Prognosis: %s\n", summary.getPrognosisAssessment()));
                    }
                }
            } catch (Exception e) {
                log.debug("No medical summary for case {}: {}", caseId, e.getMessage());
            }

        } catch (Exception e) {
            log.warn("Error building full case data for case {}: {}", caseId, e.getMessage());
        }

        sb.append("\n=======================================================\n");
        return sb.toString();
    }

    // ── Demand-letter-specific data & prompt (ported from AIPersonalInjuryController) ──

    private static final DateTimeFormatter DL_DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    private static final DateTimeFormatter DL_LETTER_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy");

    /**
     * Comprehensive case data fetch for demand letters.
     * Full medical records with ICD/CPT codes, key findings, treatment details,
     * billing breakdown per provider, itemized damages, medical summary with chronology.
     */
    private String buildDemandLetterCaseData(Long caseId, Long orgId) {
        StringBuilder sb = new StringBuilder();

        try {
            // Fetch legal case to get accident/injury date for validation
            LocalDate accidentDate = null;
            try {
                LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
                if (legalCase != null && legalCase.getInjuryDate() != null) {
                    accidentDate = legalCase.getInjuryDate();
                    log.debug("Accident date for case {}: {}", caseId, accidentDate);
                }
            } catch (Exception e) {
                log.warn("Could not fetch legal case {} for date validation: {}", caseId, e.getMessage());
            }

            // Fetch medical records with full details
            List<PIMedicalRecordDTO> medicalRecords = null;
            try {
                medicalRecords = medicalRecordService.getRecordsByCaseId(caseId);
            } catch (Exception e) {
                log.warn("Could not fetch medical records for demand letter, caseId={}: {}", caseId, e.getMessage());
            }
            if (medicalRecords != null && !medicalRecords.isEmpty()) {
                sb.append("\n\n=== MEDICAL TREATMENT RECORDS ===\n");

                BigDecimal totalBilled = BigDecimal.ZERO;
                BigDecimal totalAdjusted = BigDecimal.ZERO;
                BigDecimal totalPaid = BigDecimal.ZERO;

                for (PIMedicalRecordDTO record : medicalRecords) {
                    sb.append("\n--- MEDICAL PROVIDER ---\n");
                    sb.append(String.format("Provider: %s\n", record.getProviderName() != null ? record.getProviderName() : "Unknown"));
                    sb.append(String.format("Record Type: %s\n", record.getRecordType() != null ? record.getRecordType() : "N/A"));
                    sb.append(String.format("Treatment Date: %s\n", record.getTreatmentDate() != null ? record.getTreatmentDate().format(DL_DATE_FORMATTER) : "N/A"));

                    if (record.getKeyFindings() != null && !record.getKeyFindings().isEmpty()) {
                        sb.append(String.format("Key Findings: %s\n", record.getKeyFindings()));
                    }
                    if (record.getTreatmentProvided() != null && !record.getTreatmentProvided().isEmpty()) {
                        sb.append(String.format("Treatment Provided: %s\n", record.getTreatmentProvided()));
                    }
                    if (record.getDiagnoses() != null && !record.getDiagnoses().isEmpty()) {
                        sb.append(String.format("Diagnoses: %s\n", dlFormatDiagnoses(record.getDiagnoses())));
                    }
                    if (record.getProcedures() != null && !record.getProcedures().isEmpty()) {
                        sb.append(String.format("Procedures: %s\n", dlFormatProcedures(record.getProcedures())));
                    }
                    if (record.getPrognosisNotes() != null && !record.getPrognosisNotes().isEmpty()) {
                        sb.append(String.format("Prognosis: %s\n", record.getPrognosisNotes()));
                    }
                    if (record.getWorkRestrictions() != null && !record.getWorkRestrictions().isEmpty()) {
                        sb.append(String.format("Work Restrictions: %s\n", record.getWorkRestrictions()));
                    }

                    if (record.getBilledAmount() != null) {
                        sb.append(String.format("Billed Amount: %s\n", dlFormatCurrency(record.getBilledAmount().doubleValue())));
                        totalBilled = totalBilled.add(record.getBilledAmount());
                    }
                    if (record.getAdjustedAmount() != null && record.getAdjustedAmount().compareTo(BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Adjusted Amount: %s\n", dlFormatCurrency(record.getAdjustedAmount().doubleValue())));
                        totalAdjusted = totalAdjusted.add(record.getAdjustedAmount());
                    }
                    if (record.getPaidAmount() != null && record.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Paid Amount: %s\n", dlFormatCurrency(record.getPaidAmount().doubleValue())));
                        totalPaid = totalPaid.add(record.getPaidAmount());
                    }
                }

                sb.append("\n--- MEDICAL EXPENSES SUMMARY ---\n");
                sb.append(String.format("Total Billed: %s\n", dlFormatCurrency(totalBilled.doubleValue())));
                if (totalAdjusted.compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Total Adjusted: %s\n", dlFormatCurrency(totalAdjusted.doubleValue())));
                }
                if (totalPaid.compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Total Paid: %s\n", dlFormatCurrency(totalPaid.doubleValue())));
                }

                String dateValidationWarning = dlValidateMedicalRecordDates(medicalRecords, accidentDate);
                if (!dateValidationWarning.isEmpty()) {
                    sb.append(dateValidationWarning);
                    log.warn("Date validation issues found for case {}", caseId);
                }
            }

            // Fetch damage calculation with itemized elements
            PIDamageCalculationDTO damageCalc = null;
            try {
                damageCalc = damageCalculationService.getDamageCalculation(caseId);
            } catch (Exception e) {
                log.warn("Could not fetch damage calculation for demand letter, caseId={}: {}", caseId, e.getMessage());
            }
            if (damageCalc != null) {
                sb.append("\n\n=== DAMAGES CALCULATION ===\n");

                sb.append("\n--- ECONOMIC DAMAGES ---\n");
                sb.append(String.format("Past Medical Expenses: %s\n",
                    damageCalc.getPastMedicalTotal() != null ? dlFormatCurrency(damageCalc.getPastMedicalTotal().doubleValue()) : "$0"));
                sb.append(String.format("Future Medical Expenses: %s\n",
                    damageCalc.getFutureMedicalTotal() != null ? dlFormatCurrency(damageCalc.getFutureMedicalTotal().doubleValue()) : "$0"));
                sb.append(String.format("Lost Wages: %s\n",
                    damageCalc.getLostWagesTotal() != null ? dlFormatCurrency(damageCalc.getLostWagesTotal().doubleValue()) : "$0"));

                if (damageCalc.getEarningCapacityTotal() != null && damageCalc.getEarningCapacityTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Loss of Earning Capacity: %s\n", dlFormatCurrency(damageCalc.getEarningCapacityTotal().doubleValue())));
                }
                if (damageCalc.getHouseholdServicesTotal() != null && damageCalc.getHouseholdServicesTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Household Services: %s\n", dlFormatCurrency(damageCalc.getHouseholdServicesTotal().doubleValue())));
                }
                if (damageCalc.getMileageTotal() != null && damageCalc.getMileageTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Mileage/Transportation: %s\n", dlFormatCurrency(damageCalc.getMileageTotal().doubleValue())));
                }
                if (damageCalc.getOtherDamagesTotal() != null && damageCalc.getOtherDamagesTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Other Economic Damages: %s\n", dlFormatCurrency(damageCalc.getOtherDamagesTotal().doubleValue())));
                }

                sb.append(String.format("TOTAL ECONOMIC DAMAGES: %s\n",
                    damageCalc.getEconomicDamagesTotal() != null ? dlFormatCurrency(damageCalc.getEconomicDamagesTotal().doubleValue()) : "$0"));

                sb.append("\n--- NON-ECONOMIC DAMAGES ---\n");
                sb.append(String.format("Pain and Suffering: %s\n",
                    damageCalc.getPainSufferingTotal() != null ? dlFormatCurrency(damageCalc.getPainSufferingTotal().doubleValue()) : "$0"));
                sb.append(String.format("TOTAL NON-ECONOMIC DAMAGES: %s\n",
                    damageCalc.getNonEconomicDamagesTotal() != null ? dlFormatCurrency(damageCalc.getNonEconomicDamagesTotal().doubleValue()) : "$0"));

                sb.append("\n--- DAMAGES SUMMARY ---\n");
                sb.append(String.format("Gross Total Damages: %s\n",
                    damageCalc.getGrossDamagesTotal() != null ? dlFormatCurrency(damageCalc.getGrossDamagesTotal().doubleValue()) : "$0"));

                Integer compNeg = damageCalc.getComparativeNegligencePercent() != null ? damageCalc.getComparativeNegligencePercent() : 0;
                if (compNeg > 0) {
                    sb.append(String.format("Comparative Negligence: %d%%\n", compNeg));
                }
                sb.append(String.format("Adjusted Total Damages: %s\n",
                    damageCalc.getAdjustedDamagesTotal() != null ? dlFormatCurrency(damageCalc.getAdjustedDamagesTotal().doubleValue()) : "$0"));

                if (damageCalc.getLowValue() != null || damageCalc.getMidValue() != null || damageCalc.getHighValue() != null) {
                    sb.append("\n--- CASE VALUE RANGE ---\n");
                    if (damageCalc.getLowValue() != null) {
                        sb.append(String.format("Low Value Estimate: %s\n", dlFormatCurrency(damageCalc.getLowValue().doubleValue())));
                    }
                    if (damageCalc.getMidValue() != null) {
                        sb.append(String.format("Mid Value Estimate: %s\n", dlFormatCurrency(damageCalc.getMidValue().doubleValue())));
                    }
                    if (damageCalc.getHighValue() != null) {
                        sb.append(String.format("High Value Estimate: %s\n", dlFormatCurrency(damageCalc.getHighValue().doubleValue())));
                    }
                }
            }

            // Fetch medical summary for treatment chronology and prognosis
            PIMedicalSummaryDTO medicalSummary = null;
            try {
                medicalSummary = medicalSummaryService.getMedicalSummary(caseId);
            } catch (Exception e) {
                log.warn("Could not fetch medical summary for demand letter, caseId={}: {}", caseId, e.getMessage());
            }
            if (medicalSummary != null) {
                sb.append("\n\n=== MEDICAL SUMMARY ===\n");

                sb.append("\n--- TREATMENT OVERVIEW ---\n");
                if (medicalSummary.getTreatmentDurationDays() != null) {
                    sb.append(String.format("Treatment Duration: %d days\n", medicalSummary.getTreatmentDurationDays()));
                }
                if (medicalSummary.getTotalProviders() != null) {
                    sb.append(String.format("Total Providers: %d\n", medicalSummary.getTotalProviders()));
                }
                if (medicalSummary.getTotalVisits() != null) {
                    sb.append(String.format("Total Visits: %d\n", medicalSummary.getTotalVisits()));
                }
                if (medicalSummary.getTreatmentGapDays() != null && medicalSummary.getTreatmentGapDays() > 0) {
                    sb.append(String.format("Treatment Gap Days: %d\n", medicalSummary.getTreatmentGapDays()));
                }

                if (medicalSummary.getTreatmentChronology() != null && !medicalSummary.getTreatmentChronology().isEmpty()) {
                    sb.append("\n--- TREATMENT CHRONOLOGY ---\n");
                    sb.append(medicalSummary.getTreatmentChronology());
                    sb.append("\n");
                }

                if (medicalSummary.getKeyHighlights() != null && !medicalSummary.getKeyHighlights().isEmpty()) {
                    sb.append("\n--- KEY MEDICAL HIGHLIGHTS ---\n");
                    sb.append(medicalSummary.getKeyHighlights());
                    sb.append("\n");
                }

                if (medicalSummary.getPrognosisAssessment() != null && !"Not available".equals(medicalSummary.getPrognosisAssessment())) {
                    sb.append(String.format("\n--- PROGNOSIS ---\n%s\n", medicalSummary.getPrognosisAssessment()));
                }

                if (medicalSummary.getDiagnosisList() != null && !medicalSummary.getDiagnosisList().isEmpty()) {
                    sb.append("\n--- DIAGNOSES ---\n");
                    for (Map<String, Object> diagnosis : medicalSummary.getDiagnosisList()) {
                        String name = (String) diagnosis.getOrDefault("name", "Unknown");
                        String icdCode = (String) diagnosis.getOrDefault("icdCode", null);
                        String status = (String) diagnosis.getOrDefault("status", null);
                        StringBuilder diagLine = new StringBuilder();
                        diagLine.append("- ").append(name);
                        if (icdCode != null && !"N/A".equals(icdCode)) {
                            diagLine.append(" (ICD: ").append(icdCode).append(")");
                        }
                        if (status != null) {
                            diagLine.append(" - ").append(status);
                        }
                        sb.append(diagLine).append("\n");
                    }
                }

                if (medicalSummary.getRedFlags() != null && !medicalSummary.getRedFlags().isEmpty()) {
                    sb.append("\n--- CASE CONSIDERATIONS ---\n");
                    for (Map<String, Object> flag : medicalSummary.getRedFlags()) {
                        sb.append(String.format("- %s: %s\n",
                            flag.getOrDefault("type", "Note"),
                            flag.getOrDefault("description", "")
                        ));
                    }
                }
            }

            // Fetch case file inventory + extracted text content (single source of truth for exhibits)
            try {
                List<FileItem> caseFiles = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);
                if (caseFiles != null && !caseFiles.isEmpty()) {
                    // Pre-extract: ensure FileItemTextCache holds extracted text for every
                    // exhibit-eligible file before we read it below. Without this, files
                    // never read by the AI agent (NULL cache) and files where Tika threw
                    // before Vision OCR fallback ("failed" cache) all surface as
                    // "Supporting Document" in the AI's exhibit list.
                    // Per-file timeout via completeOnTimeout — one slow OCR doesn't stall the batch.
                    List<FileItem> exhibitCandidates = caseFiles.stream()
                        .filter(f -> !isPrivilegedDocument(f) && !isNonExhibitDocument(f))
                        .collect(java.util.stream.Collectors.toList());
                    if (!exhibitCandidates.isEmpty()) {
                        long t0 = System.currentTimeMillis();
                        List<CompletableFuture<Boolean>> futures = exhibitCandidates.stream()
                            .map(f -> CompletableFuture.supplyAsync(() -> {
                                // Save-and-restore: ForkJoinPool work-stealing means this lambda
                                // may run on the calling thread itself (when the parent .join()s),
                                // so an unconditional clear() would clobber the caller's tenant.
                                Long previousTenant = TenantContext.getCurrentTenant();
                                TenantContext.setCurrentTenant(orgId);
                                try {
                                    return caseDocumentService.ensureExtracted(f.getId(), orgId);
                                } catch (Exception e) {
                                    log.warn("Pre-extract threw for file {}: {}", f.getId(), e.getMessage());
                                    return false;
                                } finally {
                                    if (previousTenant != null) {
                                        TenantContext.setCurrentTenant(previousTenant);
                                    } else {
                                        TenantContext.clear();
                                    }
                                }
                            }).completeOnTimeout(false, 30, java.util.concurrent.TimeUnit.SECONDS))
                            .collect(java.util.stream.Collectors.toList());
                        try {
                            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
                        } catch (Exception e) {
                            log.warn("Pre-extract batch join failed: {}", e.getMessage());
                        }
                        long extracted = futures.stream().filter(fu -> {
                            try { return Boolean.TRUE.equals(fu.getNow(false)); } catch (Exception e) { return false; }
                        }).count();
                        log.info("Pre-extracted {}/{} exhibit-eligible files in {} ms (caseId={})",
                            extracted, exhibitCandidates.size(), System.currentTimeMillis() - t0, caseId);
                    }

                    sb.append("\n\n=== CASE DOCUMENT INVENTORY ===\n");
                    sb.append("The following case documents will be attached as exhibits. Each entry shows the actual extracted content of the document.\n\n");
                    sb.append("EXHIBIT LABELING RULES (apply when generating the Section 6 Exhibit List):\n");
                    sb.append("- Derive each exhibit's description ONLY from the --- Content --- block shown for that exhibit\n");
                    sb.append("- For exhibits marked [NO TEXT EXTRACTED — IMAGE OR UNREADABLE FILE]: label by MIME type only (image/* → \"Photograph\"; otherwise \"Supporting Document\"). DO NOT infer subject matter from the filename or position.\n");
                    sb.append("- NEVER use the filename, file order, or sequence-number patterns (e.g., Marsel_001-9) as evidence of content\n");
                    sb.append("- If the content is ambiguous, label it \"Supporting Document\" — DO NOT fabricate a description\n");
                    sb.append("- Reference exhibits using their exact labels (Exhibit A, Exhibit B, etc.) throughout the letter body\n\n");
                    char label = 'A';
                    for (FileItem file : caseFiles) {
                        if (isPrivilegedDocument(file) || isNonExhibitDocument(file) || isContentMatchingNonExhibit(file, orgId)) continue;
                        String filename = file.getOriginalName() != null ? file.getOriginalName() : file.getName();
                        String mime = file.getMimeType() != null ? file.getMimeType() : "unknown";
                        sb.append("=== Exhibit ").append(label++).append(" ===\n");
                        sb.append("File: ").append(filename).append("\n");
                        sb.append("MIME: ").append(mime).append("\n");
                        sb.append("--- Content ---\n");
                        String text = lookupExtractedText(file.getId(), orgId);
                        if (text == null || text.isBlank()) {
                            sb.append("[NO TEXT EXTRACTED — IMAGE OR UNREADABLE FILE — label generically as \"")
                              .append(mimeFallbackLabel(mime)).append("\"]\n");
                        } else {
                            if (text.length() > 15000) text = text.substring(0, 15000) + "\n[... truncated ...]";
                            sb.append(text).append("\n");
                        }
                        sb.append("--- End Content ---\n\n");
                    }
                }
            } catch (Exception e) {
                log.warn("Could not fetch case files for demand letter: {}", e.getMessage());
            }

        } catch (Exception e) {
            log.error("Error fetching comprehensive demand letter case data, caseId={}: {}", caseId, e.getMessage());
        }

        return sb.toString();
    }

    /** Format diagnoses list with ICD codes for demand letter */
    private String dlFormatDiagnoses(List<Map<String, Object>> diagnoses) {
        if (diagnoses == null || diagnoses.isEmpty()) return "N/A";
        return diagnoses.stream()
            .map(d -> String.format("%s (ICD: %s)",
                d.getOrDefault("name", d.getOrDefault("description", "Unknown")),
                d.getOrDefault("icdCode", d.getOrDefault("code", "N/A"))))
            .collect(java.util.stream.Collectors.joining("; "));
    }

    /** Format procedures list with CPT codes for demand letter */
    private String dlFormatProcedures(List<Map<String, Object>> procedures) {
        if (procedures == null || procedures.isEmpty()) return "N/A";
        return procedures.stream()
            .map(p -> String.format("%s (CPT: %s)",
                p.getOrDefault("name", p.getOrDefault("description", "Unknown")),
                p.getOrDefault("cptCode", p.getOrDefault("code", "N/A"))))
            .collect(java.util.stream.Collectors.joining("; "));
    }

    /** Format currency for demand letter (takes double) */
    private String dlFormatCurrency(double value) {
        if (value == 0) return "$0";
        return CURRENCY_FORMAT.format(value);
    }

    /** Validate medical record dates against accident date */
    private String dlValidateMedicalRecordDates(List<PIMedicalRecordDTO> records, LocalDate accidentDate) {
        if (accidentDate == null || records == null || records.isEmpty()) return "";

        List<String> issues = new ArrayList<>();
        for (PIMedicalRecordDTO record : records) {
            if (record.getTreatmentDate() != null && record.getTreatmentDate().isBefore(accidentDate)) {
                issues.add(String.format("- %s: treatment date %s is BEFORE accident date %s",
                    record.getProviderName() != null ? record.getProviderName() : "Unknown Provider",
                    record.getTreatmentDate().format(DL_DATE_FORMATTER),
                    accidentDate.format(DL_DATE_FORMATTER)));
            }
        }

        if (issues.isEmpty()) return "";

        StringBuilder warning = new StringBuilder();
        warning.append("\n\n⚠️ DATA VALIDATION WARNING ⚠️\n");
        warning.append("The following medical records have treatment dates BEFORE the accident date:\n");
        for (String issue : issues) {
            warning.append(issue).append("\n");
        }
        warning.append("\nATTORNEY: Please verify these dates before sending this letter.\n");
        warning.append("DO NOT send this demand letter until the date discrepancies are resolved.\n");
        return warning.toString();
    }

    /**
     * Build EvenUp-style demand letter prompt using LegalCaseDTO fields.
     * Produces a 6-section demand package: Salutation, Facts & Liability, Injuries & Treatments,
     * Damages (per diem analysis), Bad Faith Notice, Exhibit List.
     */
    private String buildDemandLetterPrompt(LegalCaseDTO caseDto, PIDamageCalculationDTO damages, String caseDataSection, boolean isDetailed, String jurisdiction) {
        String letterDate = LocalDate.now().format(DL_LETTER_DATE_FORMATTER);
        // Prefer the user-selected jurisdiction (supports both "tx" codes and "Texas" names);
        // fall back to the organization's configured state only when no explicit jurisdiction was provided.
        String stateName = (jurisdiction != null && !jurisdiction.isBlank())
            ? jurisdictionResolver.getStateName(jurisdiction)
            : jurisdictionResolver.resolveStateName(getRequiredOrganizationId());

        // Safely extract values from DTO
        String clientName = caseDto.getClientName() != null ? caseDto.getClientName() : "Unknown Client";
        String defendantName = caseDto.getDefendantName() != null ? caseDto.getDefendantName() : "Unknown Defendant";
        String insuranceCompany = caseDto.getInsuranceCompany() != null ? caseDto.getInsuranceCompany() : "Unknown Insurance Company";
        String adjusterName = caseDto.getInsuranceAdjusterName() != null ? caseDto.getInsuranceAdjusterName() : "Claims Department";
        String claimNumber = caseDto.getInsurancePolicyNumber() != null ? caseDto.getInsurancePolicyNumber() : "See Policy Number";
        String policyLimit = caseDto.getInsurancePolicyLimit() != null ? dlFormatCurrency(caseDto.getInsurancePolicyLimit().doubleValue()) : "$0";
        String accidentDate = caseDto.getInjuryDate() != null ? caseDto.getInjuryDate().format(DL_DATE_FORMATTER) : "Date Unknown";
        long daysSinceAccident = caseDto.getInjuryDate() != null
            ? java.time.temporal.ChronoUnit.DAYS.between(caseDto.getInjuryDate(), LocalDate.now()) : 0;
        String daysSinceAccidentStr = daysSinceAccident > 0 ? String.valueOf(daysSinceAccident) : "unknown";
        String accidentLocation = caseDto.getAccidentLocation() != null ? caseDto.getAccidentLocation() : "Location Unknown";
        String injuryType = caseDto.getInjuryType() != null ? caseDto.getInjuryType() : "Personal Injury";
        String injuryDescription = caseDto.getInjuryDescription() != null ? caseDto.getInjuryDescription() : "";
        String liabilityDetails = caseDto.getLiabilityAssessment() != null ? caseDto.getLiabilityAssessment() : "";

        // Extract damage values
        String medicalExpenses = damages != null && damages.getPastMedicalTotal() != null
            ? dlFormatCurrency(damages.getPastMedicalTotal().doubleValue()) : "$0";
        String lostWages = damages != null && damages.getLostWagesTotal() != null
            ? dlFormatCurrency(damages.getLostWagesTotal().doubleValue()) : "$0";
        String futureMedical = damages != null && damages.getFutureMedicalTotal() != null
            ? dlFormatCurrency(damages.getFutureMedicalTotal().doubleValue()) : "$0";
        String painSuffering = damages != null && damages.getPainSufferingTotal() != null
            ? dlFormatCurrency(damages.getPainSufferingTotal().doubleValue()) : "$0";

        return String.format("""
            JURISDICTION: %s
            Generate a professional demand package for a personal injury case in the above jurisdiction.
            This must read as a polished, attorney-ready demand letter — NOT a template or outline.

            ============================================================
            CASE DATA (USE THESE VALUES — DO NOT INVENT OR USE BRACKETS)
            ============================================================

            CLAIM INFORMATION:
            Claimant: %s
            Defendant (At-Fault Party): %s
            Insurance Company: %s
            Adjuster Name: %s
            Claim Number: %s
            Policy Limit: %s

            ACCIDENT DETAILS:
            Date of Accident: %s
            Location: %s

            INJURIES:
            Injury Type: %s
            Description: %s

            LIABILITY NARRATIVE:
            %s

            DAMAGE VALUES (starting values — recalculate totals from itemized medical records below):
            Medical Expenses: %s
            Lost Wages: %s
            Future Medical Expenses: %s
            Pain & Suffering (calculated): %s

            %s

            ============================================================
            ABSOLUTE RULES (VIOLATION = FAILURE)
            ============================================================

            1. ZERO PLACEHOLDERS: The letter must contain ZERO square brackets. Never write $[amount], [Date], [Name], [N], [Provider], [ATTORNEY TO INSERT], or ANY text inside square brackets. Every value must be a real number, real name, or real date from the CASE DATA above. If a value is truly missing, write $0.00 for amounts or "N/A" for text — never brackets.

            2. REAL DATA ONLY: Every provider name, diagnosis, ICD code, dollar amount, and date in the letter MUST come from the MEDICAL TREATMENT RECORDS, DAMAGES CALCULATION, or MEDICAL SUMMARY sections in the CASE DATA above. Read those sections carefully and extract the actual values.

            3. MATH MUST ADD UP: Every table total must exactly equal the sum of its line items. The total demand must equal Economic + Non-Economic damages. Double-check all arithmetic.

            4. NARRATIVE PROSE: Write the Facts & Liability and Pain & Suffering sections as compelling narrative paragraphs, not bullet points.

            5. PRECISE DOLLARS: Use exact dollar amounts with cents (e.g., $5,234.50).

            6. TABLE FORMAT: Use standard markdown pipe tables. Every table needs: header row, separator row (|---|---|), data rows, and a bold Total row at the bottom.

            7. HEADING FORMAT: Number main section headings with Roman numerals: "I. Facts and Liability", "II. Injuries and Medical Treatment", "III. Damages", etc. Use Arabic numbers for subsections (1, 2, 3). Do NOT use "Section 1:", "Section 2:" — the "SECTION N:" labels below are internal prompt directives only, not heading formats.

            ============================================================
            SECTION 1: SALUTATION & INTRODUCTION
            ============================================================
            IMPORTANT: Do NOT generate a firm name header, logo placeholder, or letterhead block.
            The document already has firm stationery applied externally (letterhead with logo and contact info).
            NEVER write [LAW FIRM NAME], [Attorney Name, Esq.], [Firm Address], [Phone] | [Fax] | [Email] — firm stationery is applied externally.
            Start the document body directly with the date and salutation.

            - Date: %s
            - "Via Certified Mail, Return Receipt Requested"
            - Addressee: Use the actual Adjuster Name and Insurance Company from the CASE DATA
            - RE: line with the actual Claimant name, Defendant name, Date of Loss, and Claim Number
            - "Dear [actual adjuster name from CASE DATA]:" — use their real name, not a bracket
            - Brief representation statement (1-2 paragraphs):
              * State that this office represents the claimant
              * Attorney lien notice
              * Direct all communications to this office
              * State this is a good-faith attempt to resolve the claim

            ============================================================
            SECTION 2: FACTS & LIABILITY
            ============================================================
            Write this as a COMPELLING NARRATIVE (like telling a story to a jury), NOT as bullet points.

            Structure:
            - Opening paragraph: Set the scene. Describe the client's day before the accident in human terms.
            - Accident narrative: Describe what happened in vivid, chronological detail. Use the actual accident location and date from CASE DATA.
            - Defendant's negligence: Explain clearly how the defendant was at fault.
            - Legal standard for liability:
              * For rear-end collisions: Reference the applicable state statute creating a presumption of negligence on the following driver. Use the correct citation for the jurisdiction.
              * IMPORTANT: Use "presumption of negligence" — NEVER "negligence per se" for rear-end cases.
              * For other collisions: State the applicable duty of care and how it was breached using correct state law citations.
            - Conclude with a strong statement that liability is clear and undisputed.

            ============================================================
            SECTION 3: INJURIES & TREATMENTS
            ============================================================

            ### 3.1 Summary of Injuries
            Create a table listing every diagnosis found in the MEDICAL TREATMENT RECORDS. Extract the actual diagnosis names and ICD-10 codes from the records. The table columns are: Injury/Diagnosis and ICD Code.

            ### 3.2 Treatment by Provider
            For EACH medical provider found in the MEDICAL TREATMENT RECORDS, create a structured summary:

            Start with the provider's actual name in bold, then a small table with Treatment Timeline (actual first date to last date from records) and Number of Visits (actual count from records).

            Then write 1-3 narrative paragraphs describing the treatment chronologically. Include: presenting complaints, examination findings, diagnoses, treatment plan, procedures performed, medications prescribed, and prognosis/recommendations. Use the actual ICD-10 and CPT codes from the medical records.

            End with "Supporting Documents: Exhibit N — [actual provider name] Medical Records" where N is the exhibit number.

            Order providers chronologically by first treatment date.

            ============================================================
            SECTION 4: DAMAGES
            ============================================================

            ### 4.1 Total Projected Claim Value
            Present a summary table with columns: Elements of Damages and Amount.
            Include rows for: Past Medical Expenses, Future Medical Expenses, Loss of Income, Loss of Household Services (if applicable), and Past and Future Pain and Suffering. Use the actual dollar amounts from the DAMAGES CALCULATION in CASE DATA. Include a bold Total Damages row that sums everything.

            ### 4.2 Past Medical Expenses
            Create an itemized table with columns: Provider, Date of Service, Amount Charged, Supporting Document.
            List every medical provider from the MEDICAL TREATMENT RECORDS with their actual billed amounts and treatment dates. The Total row must match the Past Medical Expenses total from the DAMAGES CALCULATION.

            After the table, include: "If you claim any of the medical treatment above was unnecessary, or that any of the bills associated with such treatment were unreasonable, then please identify in writing which bills you dispute and the factual basis for such dispute."

            PIP/NO-FAULT COORDINATION: If the jurisdiction has PIP or no-fault insurance requirements, include a coordination statement referencing the applicable state PIP statute. State that PIP benefits have been exhausted/coordinated, entitling recovery of the full medical special damages from the bodily injury coverage. Use the correct statutory citation for this jurisdiction.

            ### 4.3 Future Medical Expenses (if applicable)
            If future medical expense data exists in the DAMAGES CALCULATION, create a table with columns: Procedure, Years, Frequency/Year, Cost Each, Total. Use actual projected treatment data. Include a bold Total Future Medical row.
            Use the phrase "within a reasonable degree of medical certainty" for all future medical projections.

            ### 4.4 Loss of Income (if applicable)
            If lost wages data exists in the DAMAGES CALCULATION, present a Loss of Income Schedule table with columns: Start of Loss Date, End of Loss Date, Lost Income. Use actual dates and amounts. Include a bold Total row.
            If no lost wages are claimed, briefly note work impact without claiming economic loss.

            ### 4.5 Past and Future Pain and Suffering
            Write a COMPELLING NARRATIVE (not bullet points) describing:
            - How the injuries changed the client's daily life (sleep, work, family, hobbies, independence)
            - The duration of suffering: the client has endured EXACTLY %s days of pain since the accident (this number is pre-computed — use it as-is, do NOT recalculate)
            - Specific concrete examples of activities the client can no longer perform
            - Emotional and psychological impact

            CRITICAL VALUATION RULES:
            * NEVER state a specific multiplier (e.g., "1.0x", "2.0x multiplier") in the letter
            * NEVER show the insurer how you calculated pain and suffering
            * For disc herniation/structural injuries: value at LEAST 2.5-3.0x medical specials
            * For cases with permanency/chronic symptoms: use 3.0-4.0x
            * Simply state the pain and suffering amount confidently using the actual value from CASE DATA

            Per Diem Analysis: Include a per diem calculation table to justify the pain and suffering amount. Calculate days from accident to a medical milestone, multiply by 16 waking hours per day, multiply by a reasonable hourly rate. Show the math with actual numbers — no brackets. Split into Initial and Subsequent periods if the case spans years.

            State confidently that the calculated amount is fair and equitable compensation for the client's pain and suffering.

            ============================================================
            SECTION 5: BAD FAITH NOTICE & DEMAND TO SETTLE
            ============================================================

            Statutory Bad Faith Notice:
            Include a bad faith / unfair claim settlement practices notice citing the applicable state statutes for this jurisdiction. Reference the state's unfair insurance practices act and consumer protection statute with correct citations. Warn that failure to tender policy limits may constitute a violation of these statutes and that all rights are reserved.

            Demand:
            - State the total demand amount using the actual Total Damages calculated in Section 4.1
            - If damages exceed policy limits: Make a STRONG, UNCONDITIONAL policy limits demand.
              Use assertive language: "Tender of the policy limits is the only reasonable course of action to protect your insured from personal exposure."
              Do NOT use weak language like "we will consider" or "we may accept."
            - 30-day response deadline from date of letter
            - Consequences of non-response: State that failure to respond will result in filing a civil action seeking all available damages including those under the applicable state consumer protection or bad faith statute. Use the correct citation for this jurisdiction.

            Closing:
            - "Please do not hesitate to contact me if you have any additional questions or concerns."
            - End with "Respectfully submitted," — do NOT add attorney name, firm name, or signature block after this (the document stationery handles the signature block externally)

            ============================================================
            SECTION 6: EXHIBIT LIST
            ============================================================
            Create a numbered exhibit list table (Exhibit No. and Description columns) referencing the documents from CASE DOCUMENT INVENTORY that were cited or referenced in the letter body.

            STRICT GROUNDING RULES (mandatory — violation = failed output):
            - Each exhibit description MUST be derived ONLY from the --- Content --- block shown for that exhibit in CASE DOCUMENT INVENTORY
            - For exhibits whose content is marked [NO TEXT EXTRACTED — IMAGE OR UNREADABLE FILE]: use ONLY the generic MIME-based label suggested in the marker (e.g., "Photograph", "Supporting Document"). DO NOT infer subject matter, provider, location, or content from the filename, file order, or sequence number.
            - NEVER use filename, file ordering, or sequence-number patterns (e.g., Marsel_001-9, IMG_2847, scan_001) as evidence of what a document contains
            - If the content is ambiguous or empty, label the exhibit "Supporting Document" — DO NOT fabricate a description
            - Use actual provider/author names ONLY when they appear inside the extracted content — no brackets, no guessing

            EXCLUSIONS — NEVER include privileged or confidential attorney-client documents in the exhibit list:
            - Contingent fee / retainer / representation agreements
            - Attorney-client communications, work product, internal memos, settlement authority memos
            - Billing records, invoices, fee schedules
            - HIPAA / medical authorization forms (these are administrative, not evidence)
            - Letters of representation, certified-mail receipts, intake questionnaires
            Only include documents that support the CLAIM: medical records, bills, police/incident reports, photographs, employment records, expert reports, and similar evidence.

            ============================================================
            FINAL SELF-CHECK BEFORE RESPONDING
            ============================================================
            Before you submit, scan your entire response for the characters [ and ]. If you find ANY square brackets (except in statute citations), you have FAILED. Replace them with actual data from the CASE DATA sections above.

            %s
            """,
            stateName,
            clientName,
            defendantName,
            insuranceCompany,
            adjusterName,
            claimNumber,
            policyLimit,
            accidentDate,
            accidentLocation,
            injuryType,
            injuryDescription,
            liabilityDetails,
            medicalExpenses,
            lostWages,
            futureMedical,
            painSuffering,
            caseDataSection,
            letterDate,
            daysSinceAccidentStr, // pre-computed days since accident for pain & suffering narrative
            isDetailed
                ? "Make the letter thorough and compelling, suitable for policy limits demands. This is a serious injury case warranting detailed documentation."
                : "Keep the letter focused and professional while including all required jurisdiction-specific elements."
        );
    }

    private CitationLevel getCitationLevel(String documentType) {
        return templateRegistry.getCitationLevel(documentType);
    }

    /**
     * Look up stationery context for AI prompt.
     * Tries direct IDs first (for first-generation), falls back to document lookup.
     */
    private String resolveStationeryContext(Long documentId, Long orgId, Long stationeryTemplateId, Long stationeryAttorneyId) {
        // Priority 1: Direct IDs from request (for first-generation) — treat as atomic pair
        Long templateId = stationeryTemplateId;
        Long attorneyId = stationeryAttorneyId;

        // Priority 2: Fall back to document lookup (for re-generation)
        // Use document IDs only when BOTH direct IDs are missing (avoid mixing sources)
        if (templateId == null && attorneyId == null && documentId != null) {
            AiWorkspaceDocument doc = documentRepository.findByIdAndOrganizationId(documentId, orgId).orElse(null);
            if (doc != null) {
                templateId = doc.getStationeryTemplateId();
                attorneyId = doc.getStationeryAttorneyId();
            }
        }

        if (templateId == null || attorneyId == null) return null;

        try {
            return stationeryService.getStationeryContextForPrompt(templateId, attorneyId, orgId);
        } catch (Exception e) {
            log.warn("Failed to load stationery context for prompt: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Build draft prompt split into system message (static instructions) and user message (dynamic context).
     * The system message is loaded from templates/system-prompt.txt.
     * The user message contains only per-request dynamic content: date, stationery, template, case data, exhibits, citation policy.
     */
    private DraftPrompt buildDraftPrompt(
        String userPrompt,
        String documentType,
        String jurisdiction,
        String caseContext,
        LegalCase legalCase,
        String researchMode,
        List<AiWorkspaceDocumentExhibit> exhibits,
        String stationeryContext,
        String courtLevel,
        String practiceArea,
        java.util.Map<String, Object> documentOptions
    ) {
        // Guard against null jurisdiction — default to case's jurisdiction or "Massachusetts"
        if (jurisdiction == null || jurisdiction.isBlank()) {
            if (legalCase != null && legalCase.getJurisdiction() != null && !legalCase.getJurisdiction().isBlank()) {
                jurisdiction = legalCase.getJurisdiction();
            } else {
                jurisdiction = "Massachusetts";
            }
            log.warn("Jurisdiction was null/blank, defaulted to: {}", jurisdiction);
        }

        // ── SYSTEM MESSAGE (static instructions loaded once at startup) ──
        String systemMessage = templateRegistry.getSystemPrompt();

        // ── USER MESSAGE (dynamic, per-request content) ──
        StringBuilder prompt = new StringBuilder();

        // Today's date for letter date lines
        prompt.append("Today's date: ").append(java.time.LocalDate.now(java.time.ZoneId.of("America/New_York")).format(java.time.format.DateTimeFormatter.ofPattern("MMMM d, yyyy"))).append("\n\n");

        // Stationery awareness: tell AI what's already in the letterhead/signature/footer
        if (stationeryContext != null && !stationeryContext.isEmpty()) {
            prompt.append("**LETTERHEAD STATIONERY APPLIED TO THIS DOCUMENT**:\n");
            prompt.append(stationeryContext).append("\n");
            prompt.append("Because letterhead stationery is applied:\n");
            if (stationeryContext.contains("LETTERHEAD")) {
                prompt.append("- DO NOT generate a firm name/address header at the top — it's in the letterhead\n");
                prompt.append("- For letters: start with date, then recipient address block, then 'Dear...'\n");
                prompt.append("- For motions/pleadings: start with the court caption\n");
            }
            if (stationeryContext.contains("SIGNATURE")) {
                prompt.append("- The stationery signature block ALREADY includes the closing salutation (e.g., 'Very Truly Yours,'),\n");
                prompt.append("  the attorney name, bar number, and signature line.\n");
                prompt.append("  DO NOT generate ANY of these in the document body.\n");
                prompt.append("- For letters: end with your last paragraph of body content. Do NOT write\n");
                prompt.append("  'Very truly yours,', 'Sincerely,', 'Respectfully,' or any closing phrase.\n");
                prompt.append("- For motions/pleadings: end with the conclusion paragraph. Do NOT add a signature block.\n");
            }
            if (stationeryContext.contains("FOOTER")) {
                prompt.append("- DO NOT generate a footer with firm contact info — it's in the stationery footer\n");
            }
            prompt.append("NEVER include firm name, address, phone, fax, email, or logo in the document body — all handled by stationery.\n\n");
            // Page-layout awareness: letterhead reduces first-page space
            if (stationeryContext.contains("LETTERHEAD")) {
                prompt.append("**PAGE LAYOUT — LETTERHEAD IMPACT**:\n");
                prompt.append("The letterhead takes approximately 1 inch of space at the top of page 1, reducing available content on that page.\n");
                prompt.append("Structure your content with this in mind:\n");
                prompt.append("- Make the opening section (before the first ## heading) substantial enough to fill the reduced first page naturally\n");
                prompt.append("- NEVER place a section heading (##) with only 1-2 short lines before a page would break — always ensure each heading has meaningful content immediately following it\n");
                prompt.append("- Avoid starting with a very short paragraph followed immediately by a large table — spread introductory text to flow naturally across the first page\n");
                prompt.append("- Keep sections balanced in length so page breaks fall mid-paragraph rather than right after a heading\n");
            }
            prompt.append("\n");
        }

        // Demand letters get the EvenUp-style prompt; all other types get the generic template path
        if (isDemandLetterType(documentType) && legalCase != null) {
            try {
                LegalCaseDTO caseDto = legalCaseService.getCase(legalCase.getId());
                PIDamageCalculationDTO dmg = null;
                try { dmg = damageCalculationService.getDamageCalculation(legalCase.getId()); } catch (Exception ignored) {}
                boolean isDetailed = "THOROUGH".equalsIgnoreCase(researchMode);
                String demandPrompt = buildDemandLetterPrompt(caseDto, dmg, caseContext, isDetailed, jurisdiction);
                prompt.append(demandPrompt).append("\n\n");
                log.info("Using EvenUp-style demand letter prompt for type: {}", documentType);
            } catch (Exception e) {
                log.warn("Failed to build demand letter prompt, falling back to generic template: {}", e.getMessage());
                // Fall through to generic path below
                appendGenericDocumentPrompt(prompt, documentType, practiceArea, jurisdiction);
            }
        } else if (documentTemplateEngine.supportsTemplateGeneration(documentType)) {
            // Template-generated docs: provide content/legal guidance WITHOUT formatting/caption instructions
            // (those conflict with the JSON schema that follows).
            prompt.append("Generate SUBSTANTIVE LEGAL CONTENT for a ").append(jurisdiction);
            if (documentType != null && !documentType.isBlank()) {
                String readableType = documentType.replace("-", " ").replace("_", " ");
                prompt.append(" ").append(readableType);
            }
            prompt.append(".\n");
            String introTemplateKey = documentTemplateEngine.resolveDocumentTemplateKey(documentType);
            if ("letter".equals(introTemplateKey)) {
                prompt.append("The letterhead, date, signature block, and footer are handled by the template — do NOT generate them.\n\n");
            } else if ("contract".equals(introTemplateKey)) {
                prompt.append("The centered title and dual signature blocks are handled by the template — do NOT generate them.\n\n");
            } else {
                prompt.append("The court caption, title, and signature block are handled by the template — do NOT generate them.\n\n");
            }

            // Practice area context — different guidance for criminal vs civil
            boolean isCriminal = legalCase != null && documentTemplateEngine.isCriminalCase(legalCase);
            if (isCriminal) {
                prompt.append("**PRACTICE AREA: CRIMINAL LAW**\n");
                prompt.append("This is a CRIMINAL case. The attorney represents the DEFENDANT (the accused).\n");
                prompt.append("- Focus on constitutional protections (4th, 5th, 6th, 14th Amendments)\n");
                prompt.append("- Reference the state's criminal procedure rules, not civil rules\n");
                prompt.append("- Use criminal law standards (beyond reasonable doubt, suppression, Brady obligations)\n");
                prompt.append("- The opposing party is the State/Prosecution, not a private plaintiff\n\n");
            } else {
                prompt.append("**PRACTICE AREA: CIVIL LAW**\n");
                prompt.append("This is a CIVIL case. The attorney represents the filing party.\n");
                prompt.append("- Focus on the applicable civil standard (preponderance, plausibility for 12(b)(6), etc.)\n");
                prompt.append("- Reference the state's civil procedure rules\n");
                prompt.append("- Address the specific claims and causes of action\n\n");
            }

            // Jurisdiction-specific legal writing conventions (data-driven from state_court_configurations DB table)
            prompt.append(jurisdictionPromptBuilder.buildJurisdictionPromptSection(jurisdiction, documentType));

            // For letter and contract types, inject the type-specific content guidance from the JSON template
            // (e.g., letter-of-representation.json has strict 3-paragraph, 150-word rules that the AI MUST follow)
            String templateKey = documentTemplateEngine.resolveDocumentTemplateKey(documentType);
            if ("letter".equals(templateKey) || "contract".equals(templateKey)) {
                String typeSpecificTemplate = templateRegistry.getTemplateText(documentType, practiceArea, jurisdiction);
                if (typeSpecificTemplate != null && !typeSpecificTemplate.isEmpty()) {
                    prompt.append("**DOCUMENT-SPECIFIC CONTENT RULES — FOLLOW EXACTLY**:\n");
                    prompt.append(typeSpecificTemplate).append("\n\n");
                }
            }

            // Type-specific section guidance — different document types need different sections
            switch (templateKey) {
                case "complaint":
                    prompt.append("**REQUIRED SECTIONS FOR COMPLAINT** (use these exact JSON fields):\n");
                    prompt.append("- 'facts': FACTUAL ALLEGATIONS — write as individual numbered factual statements separated by \\n\\n. Each should be one concise factual allegation (e.g., '1. On December 14, 2025, Defendant operated a motor vehicle...'). Number every paragraph.\n");
                    prompt.append("- 'legalStandard': JURISDICTION AND VENUE — why this court has subject matter jurisdiction and personal jurisdiction, and why venue is proper\n");
                    prompt.append("- 'arguments': CAUSES OF ACTION — each argument is one COUNT. The 'heading' should be the cause of action name (e.g., 'Negligence', 'Breach of Contract'). The 'body' should incorporate prior allegations by reference and state the legal elements.\n");
                    prompt.append("- 'prayerItems': specific relief items for the WHEREFORE prayer\n");
                    prompt.append("- 'reliefSought': general description for the COMES NOW intro (e.g., 'files this Complaint for damages arising from...')\n\n");
                    break;
                case "discovery":
                    prompt.append("**REQUIRED SECTIONS FOR DISCOVERY** (use these exact JSON fields):\n");
                    prompt.append("- 'facts': INSTRUCTIONS AND DEFINITIONS — define key terms ('document', 'identify', 'describe', 'you/your', 'communication'), reference applicable procedural rules, state production format requirements, include continuing duty to supplement answers\n");
                    prompt.append("- 'legalStandard': Brief reference to the applicable procedural rule (e.g., 'Pursuant to Federal Rule of Civil Procedure 34' or 'Mass. R. Civ. P. 34' or state equivalent). 1-2 sentences only.\n");
                    prompt.append("- 'arguments': Each argument is one NUMBERED REQUEST or INTERROGATORY. The 'heading' should be the topic (e.g., 'Communications Between Parties', 'Insurance Coverage'). The 'body' should contain the specific discovery request text, using precise legal language.\n");
                    prompt.append("- 'prayerItems': not used for discovery — leave as empty array []\n");
                    prompt.append("- 'reliefSought': not used for discovery — leave as empty string\n\n");
                    break;
                case "contract":
                    prompt.append("**REQUIRED SECTIONS FOR CONTRACT/AGREEMENT** (use these exact JSON fields):\n");
                    prompt.append("- 'title': ALL CAPS document title (e.g., 'NON-DISCLOSURE AGREEMENT', 'SERVICE AGREEMENT', 'SETTLEMENT AGREEMENT AND GENERAL RELEASE')\n");
                    prompt.append("- 'facts': PREAMBLE — opening paragraph with effective date, full legal names and addresses of both parties, and recitals (WHEREAS clauses explaining the purpose/background of the agreement)\n");
                    prompt.append("- 'arguments': Each argument is one NUMBERED SECTION of the contract. The 'heading' should be the section title (e.g., 'DEFINITIONS', 'OBLIGATIONS', 'TERM AND TERMINATION'). The 'body' should contain the full section text with subsections as needed.\n");
                    prompt.append("- 'legalStandard': not used for contracts — leave as empty string\n");
                    prompt.append("- 'prayerItems': not used for contracts — leave as empty array []\n");
                    prompt.append("- 'reliefSought': not used for contracts — leave as empty string\n\n");
                    break;
                case "letter":
                    prompt.append("**REQUIRED FIELDS FOR LETTER** (use these exact JSON fields):\n");
                    prompt.append("- 'title': The VIA line if applicable (e.g., 'Via Certified Mail, Return Receipt Requested' or 'Via Email to mikrause@hanover.com'). Leave empty string if no via line needed.\n");
                    prompt.append("- 'recipientBlock': ONLY the mailing address — each line separated by \\n. Include: company/organization name, contact name and title, street address, city/state/zip. Do NOT include 'Re:' lines, insured references, or claim numbers here — those go in reBlock.\n");
                    prompt.append("- 'reBlock': The RE: reference lines — each line separated by \\n. Use label: value format (e.g., 'Our Client(s): John Doe\\nClaim Number: LM-2025-12345\\nDate of Incident: March 15, 2025'). Do NOT prefix with 'Re:' — the template adds that.\n");
                    prompt.append("- 'salutation': Greeting line (e.g., 'Dear Ms. Krause,' or 'Dear Claims Adjuster:')\n");
                    prompt.append("- 'letterBody': The letter body paragraphs ONLY. Use \\n\\n to separate paragraphs. Follow the DOCUMENT-SPECIFIC CONTENT RULES above for paragraph count and length. Do NOT include date, recipient, RE block, salutation, or closing — those are in separate fields.\n");
                    prompt.append("- 'closing': The closing phrase only (e.g., 'Very truly yours,' or 'Sincerely,'). Do NOT include attorney name or signature — the template handles that.\n");
                    prompt.append("- All other fields (facts, legalStandard, arguments, prayerItems, reliefSought): leave empty or omit.\n\n");
                    break;
                case "brief":
                    prompt.append("**REQUIRED SECTIONS FOR BRIEF/MEMORANDUM** (use these exact JSON fields):\n");
                    prompt.append("- 'facts': STATEMENT OF FACTS — objective factual narrative relevant to the legal issues\n");
                    prompt.append("- 'legalStandard': LEGAL STANDARD — the applicable standard of review or governing legal framework (1-2 paragraphs)\n");
                    prompt.append("- 'arguments': ARGUMENT sections — each is a major argument point. Use the 'heading' for the argument title. Apply law to facts in each 'body'.\n");
                    prompt.append("- 'prayerItems': CONCLUSION points — these will be rendered as a prose conclusion paragraph (NOT a numbered prayer). Write each item as a specific conclusion or requested action.\n");
                    prompt.append("- 'reliefSought': brief description of what the memorandum supports (e.g., 'in support of Defendant\\'s Motion to Dismiss')\n\n");
                    break;
                default: // motion, petition, pleading
                    prompt.append("**REQUIRED SECTIONS** (use these exact section names):\n");
                    prompt.append("- I. STATEMENT OF FACTS — Narrative of what happened, using case data provided\n");
                    prompt.append("- II. APPLICABLE LEGAL STANDARDS — governing statutes and constitutional provisions (1-2 paragraphs)\n");
                    prompt.append("- III. ARGUMENT — subsections A, B, C for each ground. Apply law to facts.\n");
                    prompt.append("- The 'prayer' JSON field handles the WHEREFORE — always include specific relief\n\n");
                    break;
            }
        } else {
            if (isDemandLetterType(documentType)) {
                log.warn("Demand letter type '{}' requested but no case linked — using generic prompt", documentType);
            }
            appendGenericDocumentPrompt(prompt, documentType, practiceArea, jurisdiction);
        }

        // Indicate research mode for token allocation and citation behavior
        if ("THOROUGH".equalsIgnoreCase(researchMode)) {
            prompt.append("**RESEARCH MODE**: THOROUGH - Include verified citations from case law databases\n");
            prompt.append("**TOOL USAGE**: Use citation verification tools to validate all legal citations\n\n");
        }

        prompt.append("JURISDICTION: ").append(jurisdiction).append("\n");
        if (practiceArea != null && !practiceArea.isBlank()) {
            prompt.append("PRACTICE AREA: ").append(practiceArea).append("\n");
        }
        if (courtLevel != null && !"DEFAULT".equals(courtLevel)) {
            prompt.append("COURT LEVEL: ").append(courtLevel).append("\n");
        }
        prompt.append("Use ").append(jurisdiction).append(" rules of procedure, ").append(jurisdiction).append(" case law, and the applicable federal circuit's precedent. Format the court caption and signature block according to ").append(jurisdiction).append(" court conventions.\n\n");

        // JURISDICTION CONTEXT — citation pack with rule labels and common statute numbers so the AI uses the right state's law.
        com.bostoneo.bostoneosolutions.dto.ai.JurisdictionPack jurisdictionPack = templateRegistry.getJurisdictionPack(jurisdiction);
        if (jurisdictionPack != null) {
            prompt.append("**JURISDICTION CONTEXT — AUTHORITATIVE FOR THIS DOCUMENT**:\n");
            prompt.append("Name: ").append(jurisdictionPack.getName()).append("\n");
            if (jurisdictionPack.getCivilRules() != null) {
                prompt.append("Civil Procedure Rules: ").append(jurisdictionPack.getCivilRules()).append("\n");
            }
            if (jurisdictionPack.getCriminalRules() != null) {
                prompt.append("Criminal Procedure Rules: ").append(jurisdictionPack.getCriminalRules()).append("\n");
            }
            if (jurisdictionPack.getEvidenceRules() != null) {
                prompt.append("Evidence Rules: ").append(jurisdictionPack.getEvidenceRules()).append("\n");
            }
            if (jurisdictionPack.getReporterAbbrev() != null) {
                prompt.append("Reporter Abbreviation: ").append(jurisdictionPack.getReporterAbbrev()).append("\n");
            }
            if (jurisdictionPack.getCommonCitations() != null && !jurisdictionPack.getCommonCitations().isEmpty()) {
                prompt.append("Common Citations (use these exact values when the topic applies):\n");
                jurisdictionPack.getCommonCitations().forEach((key, value) ->
                    prompt.append("  - ").append(key).append(": ").append(value).append("\n"));
            }
            prompt.append("Use ONLY these jurisdiction-specific rules and citations. If you need a citation not listed here, write it as `[STATE STATUTE CITATION]` rather than inventing a number.\n\n");
        } else if (jurisdiction != null && !jurisdiction.isBlank() && !jurisdiction.equalsIgnoreCase("Massachusetts")) {
            prompt.append("**JURISDICTION CONTEXT — NOT LOADED**:\n");
            prompt.append("No citation pack is available for ").append(jurisdiction).append(". Do NOT default to Massachusetts law. ");
            prompt.append("Where a jurisdiction-specific citation is required, write `[STATE STATUTE CITATION]` and flag the gap rather than inventing a statute number.\n\n");
        }

        // DOCUMENT OPTIONS — per-request flags the template may branch on (e.g., LOR recipient + purposes).
        if (documentOptions != null && !documentOptions.isEmpty()) {
            prompt.append("**DOCUMENT OPTIONS (drives conditional branches in the template)**:\n");
            documentOptions.forEach((key, value) -> {
                prompt.append("- ").append(key).append(": ");
                if (value instanceof java.util.Collection<?>) {
                    java.util.Collection<?> col = (java.util.Collection<?>) value;
                    prompt.append(col.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", ")));
                } else {
                    prompt.append(String.valueOf(value));
                }
                prompt.append("\n");
            });
            prompt.append("Apply these options strictly as specified in the document-specific content rules above.\n\n");
        }

        if (caseContext != null && !caseContext.isEmpty()) {
            prompt.append(caseContext).append("\n");
        }

        // Append exhibit content if exhibits are attached to this document.
        // Suppressed for demand-letter types: buildDemandLetterCaseData already injects
        // the same extracted-text content into CASE DOCUMENT INVENTORY as the single
        // source of truth, so emitting AVAILABLE EXHIBITS here would create a parallel
        // labeled list that can drift on regen.
        if (exhibits != null && !exhibits.isEmpty() && !isDemandLetterType(documentType)) {
            prompt.append("\n\nAVAILABLE EXHIBITS:\n");
            for (AiWorkspaceDocumentExhibit exhibit : exhibits) {
                prompt.append("- Exhibit ").append(exhibit.getLabel())
                      .append(": ").append(exhibit.getFileName()).append("\n");
                if (exhibit.getExtractedText() != null && !exhibit.getExtractedText().isEmpty()
                    && "COMPLETED".equals(exhibit.getTextExtractionStatus())) {
                    String text = exhibit.getExtractedText();
                    if (text.length() > 15000) {
                        text = text.substring(0, 15000) + "\n[... truncated ...]";
                    }
                    prompt.append(text).append("\n\n");
                } else {
                    prompt.append("[Text extraction pending -- reference by exhibit label only]\n\n");
                }
            }
            prompt.append("\nEXHIBIT REFERENCE RULES:\n");
            prompt.append("- When referencing supporting evidence from exhibits, use the format [Exhibit A, p.X]\n");
            prompt.append("- Include specific page numbers when citing particular facts or passages\n");
            prompt.append("- Only reference exhibits that genuinely support the point being made\n");
            prompt.append("- Do not fabricate exhibit content -- only reference what appears in the exhibit text above\n");
            prompt.append("- NEVER include privileged or confidential documents (fee agreements, retainer agreements, attorney-client communications, internal memos, billing records) in any exhibit list sent to opposing parties or third parties\n\n");
            log.info("Included {} exhibits in draft prompt", exhibits.size());
        }

        prompt.append("USER REQUEST:\n");
        prompt.append(userPrompt).append("\n\n");

        prompt.append("INSTRUCTIONS:\n");
        prompt.append("1. Generate a complete, properly formatted legal document\n");
        prompt.append("2. Use the case information provided above\n");
        prompt.append("3. Follow standard legal document structure\n");
        prompt.append("4. Make it court-ready and professional\n");

        if (legalCase != null) {
            prompt.append("5. Use EXACT case number: ").append(legalCase.getCaseNumber()).append("\n");
            prompt.append("6. Use EXACT client name: ").append(legalCase.getClientName()).append("\n");
            prompt.append("7. Address the specific issues in this case\n");
        }

        // DETERMINE CITATION POLICY based on document type (and practice-area / jurisdiction-specific override if available)
        CitationLevel citationLevel = templateRegistry.getCitationLevel(documentType, practiceArea, jurisdiction);
        log.info("Document type '{}' (practiceArea: {}, jurisdiction: {}) has citation level: {}",
                documentType, practiceArea, jurisdiction, citationLevel);

        // CONDITIONAL CITATION POLICY based on research mode AND document type
        if ("THOROUGH".equalsIgnoreCase(researchMode)) {
            switch (citationLevel) {
                case NONE:
                    prompt.append("\n**CITATION POLICY - NONE (Transactional/Contract Document)**:\n");
                    prompt.append("This is a transactional or contract document.\n");
                    prompt.append("DO NOT include any legal citations (no case law, no statutes).\n");
                    prompt.append("Focus on clear business terms, obligations, and commercial language.\n\n");
                    prompt.append("**FOCUS YOUR WRITING ON**:\n");
                    prompt.append("- Clear contractual terms and obligations\n");
                    prompt.append("- Rights and responsibilities of parties\n");
                    prompt.append("- Payment terms, deadlines, deliverables\n");
                    prompt.append("- Warranties, representations, and indemnification\n");
                    prompt.append("- Dispute resolution mechanisms\n\n");
                    prompt.append("**CITATION RULES - ABSOLUTE**:\n");
                    prompt.append("DO NOT cite any case law, statutes, or legal precedents.\n");
                    prompt.append("Use standard contract language and business terms.\n\n");
                    break;

                case MINIMAL:
                    prompt.append("\n**CITATION POLICY - MINIMAL (Business/Demand Document)**:\n");
                    prompt.append("This is a business/demand document, NOT a legal brief or motion.\n");
                    prompt.append("Insurance adjusters and business parties care about FACTS and DAMAGES, not case law.\n\n");
                    prompt.append("**FOCUS YOUR WRITING ON**:\n");
                    prompt.append("- Specific factual allegations (what happened, when, where, how)\n");
                    prompt.append("- Documented damages (medical bills, lost wages, repair costs)\n");
                    prompt.append("- Settlement value and business pressure\n");
                    prompt.append("- Clear liability narrative (defendant's fault)\n\n");
                    prompt.append("**CITATION RULES - STRICT**:\n");
                    prompt.append("DO NOT cite case law precedents (no 'See Smith v. Jones, 123 [Reporter] 456').\n");
                    prompt.append("DO NOT cite court decisions or judicial opinions.\n");
                    prompt.append("You MAY cite 1-2 directly applicable STATUTES if essential (e.g., 'G.L. c. 231, § 6').\n");
                    prompt.append("You MAY reference general legal standards WITHOUT case names.\n\n");
                    prompt.append("**EXAMPLE - CORRECT**: 'Under state law, a rear-end collision creates a presumption of negligence on the part of the following driver. ");
                    prompt.append("Your insured failed to maintain a safe distance and proper control, directly causing this collision and our client's injuries.'\n\n");
                    prompt.append("**EXAMPLE - INCORRECT**: 'See Haddad v. Burns, 59 [Reporter] 582 (2003); Meuse v. Fox, 39 [Reporter] (1995)...'\n\n");
                    prompt.append("Remember: This is about BUSINESS and SETTLEMENT, not legal scholarship.\n\n");
                    break;

                case COMPREHENSIVE:
                    prompt.append("\nCITATION POLICY (THOROUGH MODE - Legal Brief/Motion):\n");
                    prompt.append("You MUST include real case law citations with proper Bluebook format and pin cites.\n");
                    prompt.append("Do NOT use [CITATION NEEDED] placeholders — include the actual cases you know.\n");
                    prompt.append("All citations will be automatically verified via CourtListener after generation.\n");
                    prompt.append("Cite controlling cases from the applicable jurisdiction (state supreme court, appellate courts, and the governing federal circuit).\n");
                    prompt.append("Include specific procedural rule citations (e.g., Tex. R. Civ. P. 91a, Fed. R. Civ. P. 12(b)(6)).\n");
                    prompt.append("If you are uncertain about a specific citation detail, include your best knowledge — verification will catch errors.\n\n");
                    break;
            }
        } else {
            // FAST mode: Keep strict anti-fabrication policy
            prompt.append("\nCRITICAL CITATION POLICY - PREVENT MALPRACTICE:\n");
            prompt.append("DO NOT include specific case citations, statute numbers, or regulatory citations.\n");
            prompt.append("Fabricated citations can result in court sanctions and attorney malpractice.\n\n");
            prompt.append("CITATION RULES:\n");
            prompt.append("ALLOWED:\n");
            prompt.append("  - General legal principles: 'Under state law...' or 'Federal courts have held...'\n");
            prompt.append("  - Descriptive placeholders: [CITE: state personal jurisdiction standard]\n");
            prompt.append("  - Generic references: 'Courts apply a three-part test [CITATION NEEDED: specific standard]'\n");
            prompt.append("  - Legal concepts: 'The purposeful availment doctrine requires...'\n\n");
            prompt.append("PROHIBITED:\n");
            prompt.append("  - Specific case names: 'Copy Cop, Inc. v. Task Printing, Inc., 325 F. Supp. 2d 242'\n");
            prompt.append("  - Statute numbers: '28 U.S.C. § 1331'\n");
            prompt.append("  - Regulatory citations: '8 C.F.R. § 1003.38'\n");
            prompt.append("  - ANY citation that could be fabricated or hallucinated\n\n");
            prompt.append("REMINDER: All citations must be added manually by attorney after verification with legal research tools.\n");
        }

        // FORMATTING: Template-based JSON vs letter vs markdown
        prompt.append("\nFORMATTING REQUIREMENTS:\n");
        if (documentTemplateEngine.supportsTemplateGeneration(documentType)) {
            // Template-based: AI returns ONLY variable content as JSON.
            // Resolve template key first to tailor intro for letter vs court filing
            String jsonTemplateKey = documentTemplateEngine.resolveDocumentTemplateKey(documentType);

            prompt.append("**CRITICAL: Return your response as a JSON object** (no markdown, no code fences).\n");
            if ("letter".equals(jsonTemplateKey)) {
                prompt.append("The template handles letterhead, date, signature block, and footer.\n");
                prompt.append("You generate: recipient address, RE block, salutation, letter body, and closing phrase.\n");
            } else if ("contract".equals(jsonTemplateKey)) {
                prompt.append("The template handles the centered title, dual signature blocks, and IN WITNESS WHEREOF clause.\n");
                prompt.append("You generate: title, preamble with party identification, and numbered contract sections.\n");
            } else {
                prompt.append("The template handles caption, preamble, introduction, prayer/conclusion, signature, and certificate of service.\n");
                prompt.append("You ONLY generate: title, relief description, facts, legal standard, and argument subsections.\n");
            }
            prompt.append("DO NOT wrap in ```json``` fences. Return ONLY the raw JSON object.\n\n");

            // Type-specific JSON schema example
            if ("discovery".equals(jsonTemplateKey)) {
                prompt.append("JSON SCHEMA (DISCOVERY):\n");
                prompt.append("{\n");
                prompt.append("  \"title\": \"PLAINTIFF'S FIRST REQUEST FOR PRODUCTION OF DOCUMENTS\",\n");
                prompt.append("  \"reliefSought\": \"\",\n");
                prompt.append("  \"facts\": \"As used herein, the term 'document' shall mean any writing...\\n\\nThe term 'identify' when used with respect to a person...\\n\\nPursuant to the applicable rules, you are required to produce...\",\n");
                prompt.append("  \"legalStandard\": \"These requests are propounded pursuant to Federal Rule of Civil Procedure 34.\",\n");
                prompt.append("  \"arguments\": [\n");
                prompt.append("    { \"letter\": \"1\", \"heading\": \"Communications Between Parties\", \"body\": \"All documents and communications between Plaintiff and Defendant relating to the subject matter of this litigation, from January 1, 2024 to the present.\" },\n");
                prompt.append("    { \"letter\": \"2\", \"heading\": \"Contracts and Agreements\", \"body\": \"All contracts, agreements, memoranda of understanding, or other written agreements between the parties.\" },\n");
                prompt.append("    { \"letter\": \"3\", \"heading\": \"Insurance Policies\", \"body\": \"Complete copies of all liability insurance policies that may provide coverage for the claims asserted in this action.\" }\n");
                prompt.append("  ],\n");
                prompt.append("  \"prayerItems\": []\n");
                prompt.append("}\n\n");
                prompt.append("RULES:\n");
                prompt.append("- 'title': ALL CAPS, include party designation (e.g., 'PLAINTIFF'S FIRST SET OF INTERROGATORIES' or 'DEFENDANT'S FIRST REQUEST FOR PRODUCTION')\n");
                prompt.append("- 'facts': Definitions and instructions section. Define key terms precisely. Reference applicable procedural rules.\n");
                prompt.append("- 'legalStandard': Brief rule reference only (1-2 sentences). Use jurisdiction-specific rule.\n");
                prompt.append("- 'arguments': Each is one numbered discovery request. 'heading' = topic name. 'body' = the actual request text with precise scope and time period.\n");
                prompt.append("- Generate 10-25 requests covering relevant categories for the case type.\n");
                prompt.append("- Observe jurisdiction's interrogatory limit if applicable (e.g., 30 including subparts in Massachusetts).\n");
            } else if ("complaint".equals(jsonTemplateKey)) {
                prompt.append("JSON SCHEMA (COMPLAINT):\n");
                prompt.append("{\n");
                prompt.append("  \"title\": \"COMPLAINT AND DEMAND FOR JURY TRIAL\",\n");
                prompt.append("  \"reliefSought\": \"files this Complaint for damages arising from Defendant's negligence\",\n");
                prompt.append("  \"facts\": \"1. On December 14, 2025, Plaintiff was traveling...\\n\\n2. Defendant ran a red light...\\n\\n3. As a direct result...\",\n");
                prompt.append("  \"legalStandard\": \"This Court has jurisdiction pursuant to... Venue is proper because...\",\n");
                prompt.append("  \"arguments\": [\n");
                prompt.append("    { \"letter\": \"I\", \"heading\": \"Negligence\", \"body\": \"Plaintiff incorporates paragraphs 1 through 5 above. Defendant owed a duty...\" },\n");
                prompt.append("    { \"letter\": \"II\", \"heading\": \"Negligence Per Se\", \"body\": \"Plaintiff incorporates paragraphs 1 through 5 above. Defendant violated...\" }\n");
                prompt.append("  ],\n");
                prompt.append("  \"prayerItems\": [\n");
                prompt.append("    \"Award compensatory damages in an amount to be determined at trial\",\n");
                prompt.append("    \"Award costs of suit and reasonable attorney's fees\"\n");
                prompt.append("  ]\n");
                prompt.append("}\n\n");
                prompt.append("RULES:\n");
                prompt.append("- 'title': ALL CAPS (e.g., 'COMPLAINT AND DEMAND FOR JURY TRIAL')\n");
                prompt.append("- 'reliefSought': completes the sentence 'files this Complaint to [reliefSought]'\n");
                prompt.append("- 'facts': numbered factual allegations separated by \\n\\n. Number every paragraph.\n");
                prompt.append("- 'legalStandard': jurisdiction and venue basis. Explain why this court has authority.\n");
                prompt.append("- 'arguments': each is a CAUSE OF ACTION (count). Heading = cause name, body = elements + incorporation by reference.\n");
                prompt.append("- 'prayerItems': specific relief items (the template adds 'grant other relief' automatically)\n");
            } else if ("brief".equals(jsonTemplateKey)) {
                prompt.append("JSON SCHEMA (BRIEF/MEMORANDUM):\n");
                prompt.append("{\n");
                prompt.append("  \"title\": \"MEMORANDUM OF LAW IN SUPPORT OF MOTION TO DISMISS\",\n");
                prompt.append("  \"reliefSought\": \"in support of Defendant's Motion to Dismiss\",\n");
                prompt.append("  \"facts\": \"On December 14, 2025... (factual narrative, use \\n\\n between paragraphs)\",\n");
                prompt.append("  \"legalStandard\": \"Under Federal Rule of Civil Procedure 12(b)(6), a court must dismiss...\",\n");
                prompt.append("  \"arguments\": [\n");
                prompt.append("    { \"letter\": \"A\", \"heading\": \"Plaintiff Fails to State a Claim\", \"body\": \"The Complaint fails to allege...\" },\n");
                prompt.append("    { \"letter\": \"B\", \"heading\": \"The Claims Are Time-Barred\", \"body\": \"Even if adequately pled...\" }\n");
                prompt.append("  ],\n");
                prompt.append("  \"prayerItems\": [\n");
                prompt.append("    \"Dismiss the Complaint in its entirety with prejudice\",\n");
                prompt.append("    \"Award Defendant its costs and reasonable attorney's fees\"\n");
                prompt.append("  ]\n");
                prompt.append("}\n\n");
                prompt.append("RULES:\n");
                prompt.append("- 'title': ALL CAPS (e.g., 'MEMORANDUM OF LAW IN SUPPORT OF MOTION TO DISMISS')\n");
                prompt.append("- 'reliefSought': describes what the memorandum supports (e.g., 'in support of Defendant\\'s Motion to Dismiss')\n");
                prompt.append("- 'facts': objective factual narrative. Use \\n\\n between paragraphs.\n");
                prompt.append("- 'legalStandard': applicable standard of review. 1-2 paragraphs.\n");
                prompt.append("- 'arguments': each is a major argument point. Apply law to facts.\n");
                prompt.append("- 'prayerItems': conclusion points — rendered as prose CONCLUSION, NOT a numbered list\n");
            } else if ("contract".equals(jsonTemplateKey)) {
                prompt.append("JSON SCHEMA (CONTRACT/AGREEMENT):\n");
                prompt.append("{\n");
                prompt.append("  \"title\": \"NON-DISCLOSURE AGREEMENT\",\n");
                prompt.append("  \"facts\": \"This Non-Disclosure Agreement (this \\\"Agreement\\\") is entered into as of [Date], by and between:\\n\\nABC Corporation, a Delaware corporation, with its principal place of business at 123 Main Street, Boston, MA 02101 (\\\"Disclosing Party\\\"); and\\n\\nXYZ Inc., a Massachusetts corporation, with its principal place of business at 456 Oak Avenue, Cambridge, MA 02139 (\\\"Receiving Party\\\").\\n\\nWHEREAS, the Disclosing Party possesses certain confidential and proprietary information relating to its business operations; and\\n\\nWHEREAS, the Receiving Party desires to receive such information for the purpose of evaluating a potential business relationship;\\n\\nNOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, the parties agree as follows:\",\n");
                prompt.append("  \"arguments\": [\n");
                prompt.append("    { \"letter\": \"1\", \"heading\": \"Definitions\", \"body\": \"\\\"Confidential Information\\\" shall mean all non-public information...\" },\n");
                prompt.append("    { \"letter\": \"2\", \"heading\": \"Obligations of Receiving Party\", \"body\": \"The Receiving Party shall: (a) hold all Confidential Information in strict confidence...\" },\n");
                prompt.append("    { \"letter\": \"3\", \"heading\": \"Exclusions\", \"body\": \"Confidential Information shall not include information that: (a) is or becomes publicly available...\" },\n");
                prompt.append("    { \"letter\": \"4\", \"heading\": \"Term and Termination\", \"body\": \"This Agreement shall remain in effect for a period of two (2) years...\" },\n");
                prompt.append("    { \"letter\": \"5\", \"heading\": \"Governing Law\", \"body\": \"This Agreement shall be governed by and construed in accordance with the laws of the Commonwealth of Massachusetts...\" }\n");
                prompt.append("  ],\n");
                prompt.append("  \"legalStandard\": \"\",\n");
                prompt.append("  \"prayerItems\": [],\n");
                prompt.append("  \"reliefSought\": \"\"\n");
                prompt.append("}\n\n");
                prompt.append("RULES:\n");
                prompt.append("- 'title': ALL CAPS document title matching the agreement type\n");
                prompt.append("- 'facts': PREAMBLE — effective date, full party identification with addresses, WHEREAS recitals, NOW THEREFORE clause. Use \\n\\n between paragraphs.\n");
                prompt.append("- 'arguments': Each is one NUMBERED SECTION. 'heading' = section title (e.g., 'DEFINITIONS'). 'body' = full section text with subsections using (a), (b), (c) format.\n");
                prompt.append("- Generate 7-12 sections covering all essential contract provisions for the agreement type.\n");
                prompt.append("- Use formal contract drafting language. Every obligation must be precisely defined.\n");
                prompt.append("- Include governing law, entire agreement, severability, and amendment provisions.\n");
            } else if ("letter".equals(jsonTemplateKey)) {
                prompt.append("JSON SCHEMA (LETTER):\n");
                prompt.append("{\n");
                prompt.append("  \"title\": \"Via Certified Mail, Return Receipt Requested\",\n");
                prompt.append("  \"recipientBlock\": \"Liberty Mutual Insurance\\nAttn: Jane Krause, Claims Adjuster\\n175 Berkeley Street\\nBoston, MA 02116\",\n");
                prompt.append("  \"reBlock\": \"Our Client: John Doe\\nClaim Number: LM-2025-12345\\nDate of Incident: March 15, 2025\",\n");
                prompt.append("  \"salutation\": \"Dear Ms. Krause:\",\n");
                prompt.append("  \"letterBody\": \"Please be advised that this firm has been retained to represent John Doe in connection with injuries sustained in a motor vehicle accident on March 15, 2025.\\n\\nMr. Doe was traveling westbound on Main Street when your insured ran a red light at the intersection of Main and Elm Streets, striking his vehicle on the driver's side.\\n\\nPlease direct all future communications regarding this matter to our office. Do not contact Mr. Doe directly.\",\n");
                prompt.append("  \"closing\": \"Very truly yours,\"\n");
                prompt.append("}\n\n");
                prompt.append("RULES:\n");
                prompt.append("- 'title': The VIA line if applicable (e.g., 'Via Certified Mail, Return Receipt Requested' or 'Via Email to mikrause@hanover.com'). Use empty string \"\" if no via line needed.\n");
                prompt.append("- 'recipientBlock': ONLY the mailing address. Each line separated by \\n. Include ONLY: company name, contact name/title, street address, city/state/zip. Do NOT put 'Re:' lines, insured names, or claim references here.\n");
                prompt.append("- 'reBlock': Case reference lines in label: value format, each separated by \\n. Include Our Client(s), Claim Number, Date of Incident as applicable. Do NOT prefix with 'Re:' — the template adds that.\n");
                prompt.append("- 'salutation': Professional greeting (e.g., 'Dear Ms. Krause,' or 'Dear Claims Adjuster:')\n");
                prompt.append("- 'letterBody': The letter body paragraphs ONLY. Follow the DOCUMENT-SPECIFIC CONTENT RULES above for exact paragraph count and content. Do NOT include date, address, RE block, salutation, or closing.\n");
                prompt.append("- 'closing': Only the closing phrase (e.g., 'Very truly yours,'). Do NOT include attorney name.\n");
                prompt.append("- All other fields (facts, legalStandard, arguments, prayerItems, reliefSought): omit or leave empty.\n");
            } else {
                prompt.append("JSON SCHEMA:\n");
                prompt.append("{\n");
                prompt.append("  \"title\": \"MOTION TO SUPPRESS BLOOD ALCOHOL EVIDENCE\",\n");
                prompt.append("  \"reliefSought\": \"suppress all blood alcohol evidence obtained on December 14, 2025, including the blood sample, BAC results of 0.11%, and all derivative evidence\",\n");
                prompt.append("  \"facts\": \"On December 14, 2025... (full factual narrative, use \\n\\n between paragraphs)\",\n");
                prompt.append("  \"legalStandard\": \"The Fourth Amendment... Article 38.23(a)... (governing law, 1-2 paragraphs)\",\n");
                prompt.append("  \"arguments\": [\n");
                prompt.append("    { \"letter\": \"A\", \"heading\": \"The Traffic Stop Lacked Reasonable Suspicion\", \"body\": \"A traffic stop constitutes a seizure...\" },\n");
                prompt.append("    { \"letter\": \"B\", \"heading\": \"The Blood Draw Violated Section 724.017\", \"body\": \"...\" }\n");
                prompt.append("  ],\n");
                prompt.append("  \"prayerItems\": [\n");
                prompt.append("    \"Suppress the blood sample and all BAC evidence\",\n");
                prompt.append("    \"Suppress all evidence derived from the unlawful traffic stop\",\n");
                prompt.append("    \"Set this Motion for an evidentiary hearing\"\n");
                prompt.append("  ]\n");
                prompt.append("}\n\n");
                prompt.append("RULES:\n");
                prompt.append("- 'title': ALL CAPS, short (e.g., 'MOTION TO SUPPRESS BLOOD ALCOHOL EVIDENCE')\n");
                prompt.append("- 'reliefSought': completes the sentence 'moves this Honorable Court to [reliefSought]' — lowercase, specific\n");
                prompt.append("- 'facts': factual narrative only. Use case data provided. Use \\n\\n between paragraphs.\n");
                prompt.append("- 'legalStandard': governing statutes and constitutional provisions. 1-2 paragraphs MAX.\n");
                prompt.append("- 'arguments': each is a separate GROUND for the motion. 2-4 arguments. Each has letter, heading, body.\n");
                prompt.append("- 'prayerItems': specific relief items (the template adds 'grant other relief' automatically)\n");
            }
            prompt.append("- Use plain text in all fields. Do NOT use markdown ** or # formatting.\n");
            if ("letter".equals(jsonTemplateKey)) {
                prompt.append("- Write professional legal correspondence. Be clear, concise, and specific.\n");
                prompt.append("- Follow the DOCUMENT-SPECIFIC CONTENT RULES above for exact paragraph count and word limit.\n");
                prompt.append("- Do NOT include date, recipient address, RE block, or closing in the letterBody field.\n");
                prompt.append("- Do NOT add paragraphs about medical records, evidence preservation, attorney liens, or insurance coverage details unless the DOCUMENT-SPECIFIC CONTENT RULES explicitly require them.\n");
            } else if ("contract".equals(jsonTemplateKey)) {
                prompt.append("- Use formal contract drafting language. Every term and obligation must be precisely defined.\n");
                prompt.append("- Use (a), (b), (c) subsections within sections for detailed provisions.\n");
                prompt.append("- MAXIMUM 2000-3000 words total across all fields. Contracts need detail.\n");
                prompt.append("- Do NOT include signature blocks — the template handles those.\n");
            } else {
                prompt.append("- Do NOT use [ATTORNEY TO INSERT: ...] placeholders. Write substantive content or omit.\n");
                prompt.append("- Cite 1-2 controlling cases per argument. Do NOT string-cite 5+ cases.\n");
                prompt.append("- MAXIMUM 1000-1500 words total across all fields. Be CONCISE.\n");
                prompt.append("- Write like a practicing attorney, not a law professor.\n");
            }
        } else if (isLetterType(documentType)
                   && !isDemandLetterType(documentType)
                   && !templateRegistry.templateExpectsSectionHeaders(documentType, practiceArea, jurisdiction)) {
            prompt.append("- This is a LETTER — do NOT use markdown headers (#, ##, ###) in the body\n");
            prompt.append("- Write as flowing prose paragraphs, not sections with headers\n");
        } else {
            prompt.append("- Use Markdown formatting for structure and emphasis\n");
            prompt.append("- Use # for main title, ## for sections, ### for subsections\n");
        }

        // STATIONERY RULE: For letter types without stationery, give softer guidance
        if (isLetterType(documentType) && (stationeryContext == null || stationeryContext.isEmpty())) {
            prompt.append("\n**FIRM INFO PLACEHOLDERS**: Do not write generic placeholders like [LAW FIRM NAME], [Firm Address], etc.\n");
            prompt.append("Use the actual firm/attorney name from context, or use structured [ATTORNEY TO INSERT: firm name] format.\n\n");
        }

        // PLACEHOLDER RULES: Different rules for different document types
        if (isDemandLetterType(documentType)) {
            prompt.append("\n**CRITICAL RULE FOR DEMAND LETTERS — ZERO PLACEHOLDERS**:\n");
            prompt.append("This is a demand letter with ALL case data provided. You MUST:\n");
            prompt.append("- Use ONLY real values from the case data — real names, real dates, real dollar amounts\n");
            prompt.append("- NEVER use $[Amount], [Date], [ATTORNEY TO INSERT: ...], [Name], or ANY square bracket placeholders\n");
            prompt.append("- If specific data is not available, write a reasonable narrative without brackets\n");
            prompt.append("- For dollar amounts, use the exact amounts from medical records and damage calculations\n");
            prompt.append("- For dates, use the actual dates from treatment records\n");
            prompt.append("- For provider names, use the actual provider names from medical records\n");
            prompt.append("- SELF-CHECK: Before submitting, scan your ENTIRE response for [ and ]. If you find ANY square brackets that are not part of legal citations, you have FAILED this rule.\n\n");
        } else if (isLetterType(documentType) && caseContext != null && !caseContext.isEmpty()) {
            prompt.append("\n**CRITICAL RULE — USE REAL CASE DATA, ZERO PLACEHOLDERS**:\n");
            prompt.append("Case data is provided above. You MUST use real values from the case data:\n");
            prompt.append("- Use the actual client name, defendant name, insurance company, dates, claim number\n");
            prompt.append("- NEVER use [Client Name], [Insurance Company], [Date of Incident], etc.\n");
            prompt.append("- If a specific value is not in the case data, write naturally without brackets (e.g., 'your insured' instead of '[Insured Name]')\n");
            prompt.append("- SELF-CHECK: Scan your response for [ and ]. Square brackets = FAILURE.\n\n");
        } else {
            prompt.append("\n**MANDATORY RULE - COMPLETE ALL LISTS WITH PLACEHOLDERS**:\n");
            prompt.append("When you write 'as follows:', 'including:', 'specifically:', 'demonstrates:', 'such as:', etc., ");
            prompt.append("you MUST complete the list immediately after.\n\n");
            prompt.append("**IF YOU HAVE SPECIFIC FACTS** → Use them.\n");
            prompt.append("**IF YOU DON'T HAVE SPECIFIC FACTS** → Use structured placeholders:\n");
            prompt.append("  [ATTORNEY TO INSERT: specific evidence from case file]\n\n");
            prompt.append("**PLACEHOLDER FORMATS**: $[Amount], [Date], [Defendant Name], [ATTORNEY TO INSERT: ...]\n\n");
            prompt.append("NEVER leave a list incomplete after a colon — always follow through with items or placeholders.\n\n");
        }

        // DYNAMIC CHECKLIST items based on document type
        prompt.append("**FINAL CHECKLIST**:\n");
        if (isDemandLetterType(documentType) || (isLetterType(documentType) && caseContext != null && !caseContext.isEmpty())) {
            prompt.append("✓ ZERO square brackets in the entire document — all values are real data from the case\n");
            prompt.append("✓ All dollar amounts are precise with cents (e.g., $5,234.50)\n");
        } else {
            prompt.append("✓ All tables have complete rows (use placeholder values like $[Amount] for unknown numbers)\n");
            prompt.append("✓ Used [ATTORNEY TO INSERT: ...] format for case-specific details you don't have\n");
        }
        if (isLetterType(documentType) && stationeryContext != null && !stationeryContext.isEmpty()) {
            prompt.append("✓ NO firm name, address, phone, or attorney name/signature in the body (stationery handles it)\n");
        }
        prompt.append("\n");

        return new DraftPrompt(systemMessage, prompt.toString());
    }

    /**
     * Parse AI response as structured JSON and render through HTML template.
     * Falls back by throwing an exception if JSON parsing fails (caller catches and uses raw content).
     */
    private String renderWithTemplate(String aiContent, LegalCase legalCase, String jurisdiction, String documentType,
                                       Long userId, Long orgId, String courtLevel,
                                       Long stationeryTemplateId, Long stationeryAttorneyId) {
        // Strip markdown code fences if the AI wrapped JSON in ```json ... ```
        // Also handle cases where AI prefixes with prose before the fence
        String jsonStr = aiContent.trim();
        if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").trim();
        } else if (jsonStr.contains("```")) {
            // AI may have prefixed with prose: "Here is the JSON:\n```json\n{...}\n```"
            int fenceStart = jsonStr.indexOf("```");
            jsonStr = jsonStr.substring(fenceStart);
            jsonStr = jsonStr.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").trim();
        }
        // Final fallback: if it still doesn't start with {, try to find the JSON object
        if (!jsonStr.startsWith("{") && jsonStr.contains("{")) {
            jsonStr = jsonStr.substring(jsonStr.indexOf("{"));
            // Find matching closing brace
            int lastBrace = jsonStr.lastIndexOf("}");
            if (lastBrace > 0) {
                jsonStr = jsonStr.substring(0, lastBrace + 1);
            }
        }

        // Parse JSON into AiDocumentResponse
        com.bostoneo.bostoneosolutions.dto.ai.AiDocumentResponse aiResponse;
        try {
            aiResponse = objectMapper.readValue(jsonStr, com.bostoneo.bostoneosolutions.dto.ai.AiDocumentResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("AI did not return valid JSON: " + e.getMessage());
        }

        // Route to letter template, contract template, or caption template
        if (documentTemplateEngine.isLetterDocumentType(documentType)) {
            // Letter validation: need letterBody at minimum
            if (aiResponse.getLetterBody() == null || aiResponse.getLetterBody().isBlank()) {
                throw new RuntimeException("AI JSON missing required letter field (letterBody)");
            }

            // Resolve stationery HTML (letterhead, signature, footer) if IDs are available
            DocumentTemplateEngine.StationeryHtmlParts stationeryHtml = resolveStationeryHtml(stationeryTemplateId, stationeryAttorneyId, orgId);

            return documentTemplateEngine.renderLetterDocument(aiResponse, userId, orgId, stationeryHtml);
        }

        if (documentTemplateEngine.isContractDocumentType(documentType)) {
            // Contract validation: need title and sections
            if (aiResponse.getTitle() == null || aiResponse.getTitle().isBlank()) {
                log.warn("AI JSON missing 'title' for contract — using default");
            }
            if (aiResponse.getArguments() == null || aiResponse.getArguments().isEmpty()) {
                log.warn("AI JSON missing 'arguments' (contract sections) — document will have no body sections");
            }

            return documentTemplateEngine.renderContractDocument(aiResponse, legalCase);
        }

        // Caption document validation
        if (aiResponse.getTitle() == null || aiResponse.getFacts() == null || aiResponse.getFacts().isBlank()) {
            throw new RuntimeException("AI JSON missing required fields (title, facts)");
        }
        if (aiResponse.getArguments() == null || aiResponse.getArguments().isEmpty()) {
            log.warn("AI JSON missing 'arguments' section — document will have no legal argument");
        }

        // Render through template engine (caption types: motion, complaint, brief, discovery)
        return documentTemplateEngine.renderDocument(aiResponse, legalCase, jurisdiction, documentType, userId, orgId, courtLevel);
    }

    /**
     * Resolve stationery HTML parts from template and attorney IDs.
     * Returns null if stationery is not configured.
     */
    private DocumentTemplateEngine.StationeryHtmlParts resolveStationeryHtml(Long templateId, Long attorneyId, Long orgId) {
        if (templateId == null || attorneyId == null) return null;
        try {
            var rendered = stationeryService.renderStationery(templateId, attorneyId, orgId);
            return new DocumentTemplateEngine.StationeryHtmlParts(
                    rendered.getLetterheadHtml(),
                    rendered.getSignatureBlockHtml(),
                    rendered.getFooterHtml()
            );
        } catch (Exception e) {
            log.warn("Could not render stationery for letter template: {}", e.getMessage());
            return null;
        }
    }

    /** Generic document prompt (non-demand-letter types) */
    private void appendGenericDocumentPrompt(StringBuilder prompt, String documentType, String practiceArea, String jurisdiction) {
        prompt.append("Generate a professional legal ").append(documentType).append(" document.\n\n");
        String documentTemplate = templateRegistry.getTemplateText(documentType, practiceArea, jurisdiction);
        if (!documentTemplate.isEmpty()) {
            prompt.append(documentTemplate).append("\n");
        } else {
            String hints = templateRegistry.getHints(documentType, practiceArea, jurisdiction);
            if (hints != null && !hints.isEmpty()) {
                prompt.append("**DOCUMENT STRUCTURE GUIDANCE**:\n");
                prompt.append(hints).append("\n\n");
            }
        }
    }

    private boolean isDemandLetterType(String documentType) {
        return templateRegistry.isDemandLetterType(documentType);
    }

    private boolean isLetterType(String documentType) {
        return templateRegistry.isLetterType(documentType);
    }

    /**
     * Rewrite the imported-template structural classes into native HTML markup that iText html2pdf
     * renders reliably. The class-based markup ({@code <p class="signature-line">...} and
     * {@code <div class="callout-box">...}) is what the import wizard saves so we can keep the
     * editor preview semantic, but iText's CSS class-selector engine doesn't honor {@code border}
     * properties on {@code <p>} consistently. Native {@code <hr>} and single-cell {@code <table>}
     * are the lowest-common-denominator markup both iText and CKEditor render with visible borders.
     *
     * <p>Idempotent — applies the rewrite once per render call. Backwards compatible — existing
     * imported templates need no re-import to get visible borders in the export.
     */
    private String rewriteImportStructuralMarkup(String html) {
        if (html == null || html.isEmpty()) return html;
        String out = html;

        // Promote the FIRST top-of-document <h2> to <h2 class="document-title">, regardless of
        // whether the inline {@code text-align:center} style survived the editor's sanitization
        // pass. Convention: the very first heading in an imported instrument is the document
        // title (e.g., "The Smith Family Trust"), and should render bigger + centered. Subsequent
        // <h2>s are ARTICLE / SECTION headings and stay left-aligned at body size. Use a regex
        // that allows leading whitespace + an optional inline style attribute on the first <h2>.
        out = out.replaceFirst(
            "(?is)\\A(\\s*)<h2(\\s[^>]*)?>(.*?)</h2>",
            "$1<h2 class=\"document-title\">$3</h2>"
        );

        // <p class="signature-line">CONTENT</p> → underscore rule + name paragraph.
        //
        // We tried <hr> with inline styles, <table> with cell borders, <table> with table-level
        // borders, and per-side border declarations — every approach failed in iText html2pdf
        // for one of three reasons: (a) iText skips border rendering on empty/small cells,
        // (b) `border:none` shorthand cancels subsequent `border-top` overrides, (c) the global
        // {@code td/hr} CSS rules interact unpredictably with our overrides.
        //
        // Solution: literal underscore characters in a serif font render as a solid horizontal
        // line in EVERY PDF/Word/HTML renderer with zero special handling. Visually identical
        // to a CSS-rule-based signature line; bulletproof across the matrix of renderers we
        // care about (iText, browser preview, CKEditor, MS Word import).
        //
        // 40 underscores at 12pt serif ≈ 3 inches ≈ 50% of letter-page content width.
        out = out.replaceAll(
            "(?is)<p\\s+class=\"signature-line\"\\s*>(.*?)</p>",
            "<p style=\"margin:28pt 0 0 0;font-family:'Times New Roman',Georgia,serif;letter-spacing:0;\">"
            + "________________________________________</p>"
            + "<p style=\"margin:0;\">$1</p>"
        );

        // <div class="callout-box"><p>CONTENT</p></div> → bordered single-cell table
        // iText renders <table> borders reliably (the existing th/td CSS already proves it),
        // and CKEditor renders tables with visible borders by default.
        out = out.replaceAll(
            "(?is)<div\\s+class=\"callout-box\"\\s*>(.*?)</div>",
            "<table style=\"border-collapse:collapse;width:100%;margin:12pt 0;\">" +
            "<tbody><tr><td style=\"border:1px solid #000;padding:8pt 12pt;\">$1</td></tr></tbody>" +
            "</table>"
        );

        // Safety net: if the body contains raw <hr/> elements (e.g., from earlier-prompt-version
        // imports that emitted <hr> directly instead of class-based markup), convert each to the
        // same underscore-rule that the .signature-line class produces. This makes the visible
        // result identical regardless of which prompt version generated the markup.
        out = out.replaceAll(
            "(?is)<hr\\s*/?\\s*>",
            "<p style=\"margin:24pt 0 0 0;font-family:'Times New Roman',Georgia,serif;\">"
            + "________________________________________</p>"
        );

        return out;
    }

    /**
     * Instruments (trusts, wills, contracts, settlements, deeds, operating agreements, etc.) are
     * the legal artifact itself — their ARTICLE/SECTION headings are body content and should read
     * left-aligned like prose, NOT centered like a court-filing case caption. Falls back to a
     * keyword scan when documentType is null/empty so freshly-imported templates without a
     * registered type still get the right styling.
     */
    private boolean isInstrumentType(String documentType) {
        if (documentType == null || documentType.isBlank()) return false;
        String t = documentType.toLowerCase();
        return t.contains("trust") || t.contains("will") || t.contains("contract")
            || t.contains("agreement") || t.contains("settlement") || t.contains("deed")
            || t.contains("operating") || t.contains("articles_of_incorporation")
            || t.contains("bylaws") || t.contains("power_of_attorney") || t.contains("retainer")
            || t.contains("engagement_letter");
    }

    /**
     * Get professional filename for document export
     * Extracts title from markdown content and sanitizes it
     */
    public String getDocumentFilename(Long documentId, Long userId, String extension) {
        // Fetch document with latest version
        Optional<Map<String, Object>> docData = getDocumentWithLatestVersion(documentId, userId);
        if (docData.isEmpty()) {
            return "Document." + extension;
        }

        Map<String, Object> data = docData.get();
        String title = (String) data.get("title");
        String content = (String) data.get("content");
        String documentType = (String) data.get("documentType");

        // Prefer database title (set from case-aware naming), fall back to content heading
        String filename;
        if (title != null && !title.trim().isEmpty() && !title.startsWith("conv_")) {
            filename = sanitizeFilename(title);
        } else {
            filename = extractDocumentTitle(content, documentType);
        }
        return filename + "." + extension;
    }

    /**
     * Extract document title from markdown content
     * Looks for first # heading in the content and sanitizes it for use as filename
     * Returns sanitized title or document type as fallback
     */
    private String extractDocumentTitle(String content, String documentType) {
        if (content == null || content.isEmpty()) {
            return sanitizeFilename(documentType != null ? documentType : "Legal_Document");
        }

        // Look for first markdown heading (# Title)
        String[] lines = content.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("#")) {
                // Extract heading text (remove all # symbols)
                String title = trimmed.replaceAll("^#+\\s*", "").trim();
                if (!title.isEmpty()) {
                    return sanitizeFilename(title);
                }
            }
        }

        // Fallback to document type
        return sanitizeFilename(documentType != null ? documentType : "Legal_Document");
    }

    /**
     * Sanitize string for use as filename
     * Converts to proper case, removes special characters, replaces spaces with underscores
     */
    private String sanitizeFilename(String input) {
        if (input == null || input.isEmpty()) {
            return "Document";
        }

        // Remove or replace special characters
        String sanitized = input
            .replaceAll("[^a-zA-Z0-9\\s-]", "") // Remove special chars except spaces and hyphens
            .replaceAll("\\s*-\\s*", " ") // Replace hyphens (with surrounding spaces) with a single space
            .replaceAll("\\s+", "_") // Replace spaces with underscores
            .replaceAll("_+", "_") // Collapse multiple underscores
            .replaceAll("^_|_$", ""); // Remove leading/trailing underscores

        // Capitalize first letter of each word for professional appearance
        String[] words = sanitized.split("_");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (!word.isEmpty()) {
                if (result.length() > 0) {
                    result.append("_");
                }
                // Capitalize first letter, lowercase the rest (unless it's an acronym)
                if (word.length() <= 3 && word.equals(word.toUpperCase())) {
                    // Keep short acronyms uppercase (e.g., "USA", "LLC")
                    result.append(word);
                } else {
                    result.append(word.substring(0, 1).toUpperCase())
                          .append(word.substring(1).toLowerCase());
                }
            }
        }

        // Limit length to 50 characters for filename compatibility
        String finalName = result.toString();
        if (finalName.length() > 50) {
            finalName = finalName.substring(0, 50);
            // Remove trailing underscore if truncation created one
            finalName = finalName.replaceAll("_$", "");
        }

        return finalName.isEmpty() ? "Document" : finalName;
    }

    /**
     * Public accessor for filename sanitization — used by controller for Content-Disposition headers
     */
    public String sanitizeFilenamePublic(String input) {
        return sanitizeFilename(input);
    }

    /**
     * Check if content starts with a markdown heading
     * Returns true if first non-empty line is a # heading
     */
    private boolean contentHasMarkdownTitle(String content) {
        if (content == null || content.isEmpty()) {
            return false;
        }

        String[] lines = content.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                return trimmed.startsWith("#");
            }
        }

        return false;
    }

    /**
     * Validate document content for incomplete list patterns
     * MONITORING ONLY - Does not block document generation
     * Returns info message if potential issues detected, null otherwise
     */
    private String validateDocumentCompleteness(String content) {
        if (content == null || content.isEmpty()) {
            return null;
        }

        // Simple check: Look for list introducers followed by suspicious gaps
        // This is for MONITORING/METRICS only - not blocking
        // Prompt improvements should prevent these issues via placeholders
        String[] listIntroducers = {
            "specifically:", "including:", "such as:", "namely:",
            "as follows:", "the following:", "demonstrates:"
        };

        String lowerContent = content.toLowerCase();
        for (String introducer : listIntroducers) {
            int index = lowerContent.indexOf(introducer);
            while (index != -1) {
                // Check next 150 characters for obvious gaps
                int endIndex = Math.min(index + introducer.length() + 150, lowerContent.length());
                String afterIntroducer = content.substring(index + introducer.length(), endIndex);

                // Simple heuristic: If introducer followed by 2+ blank lines then capitalized sentence
                // (likely jumped to new paragraph without list or placeholder)
                // Note: This will NOT catch tables, headers, or other valid structures (by design)
                if (afterIntroducer.matches("(?s)\\s*[\\n\\r]{2,}\\s*[A-Z][^\\n]{20,}")) {
                    log.info("📊 METRICS: Possible incomplete list after '{}' at position {}", introducer, index);
                    return "Info: Document may contain sections where attorney should verify completeness.";
                }

                // Find next occurrence
                index = lowerContent.indexOf(introducer, index + 1);
            }
        }

        return null; // No obvious issues detected
    }

    /**
     * Generate Word document (DOCX) from document content
     * Converts Markdown content to properly formatted Word document
     */
    public byte[] generateWordDocument(Long documentId, Long userId, boolean includeMetadata) {
        log.info("Generating Word document for documentId={}, userId={}", documentId, userId);

        // Fetch document with latest version
        Optional<Map<String, Object>> docData = getDocumentWithLatestVersion(documentId, userId);
        if (docData.isEmpty()) {
            throw new IllegalArgumentException("Document not found or access denied");
        }

        Map<String, Object> data = docData.get();
        String content = (String) data.get("content");
        String title = (String) data.get("title");
        String approvalStatus = (String) data.get("approvalStatus");

        try {
            // Create Word document
            XWPFDocument document = new XWPFDocument();

            // §6.1 gating — stamp every page via VML text-path in default header (Word renders diagonally).
            addDocxWatermark(document, resolveWatermarkText(approvalStatus));

            // Only add title if content doesn't already have a markdown title
            // This prevents user prompt from appearing in the document
            if (!contentHasMarkdownTitle(content)) {
                log.info("Content has no markdown title, adding document title: {}", title);
                XWPFParagraph titlePara = document.createParagraph();
                titlePara.setAlignment(ParagraphAlignment.CENTER);
                titlePara.setSpacingAfter(400);
                XWPFRun titleRun = titlePara.createRun();
                titleRun.setText(title);
                titleRun.setBold(true);
                titleRun.setFontSize(18);
                titleRun.setFontFamily("Georgia");
            } else {
                log.info("Content has markdown title, skipping title injection");
            }

            // Convert Markdown content to Word
            convertMarkdownToWord(content, document);

            // Add metadata footer if requested
            if (includeMetadata) {
                addMetadataFooter(document, data);
            }

            // Convert to byte array
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.write(out);
            document.close();

            log.info("Successfully generated Word document ({} bytes)", out.size());
            return out.toByteArray();

        } catch (IOException e) {
            log.error("Error generating Word document", e);
            throw new RuntimeException("Failed to generate Word document", e);
        }
    }

    /**
     * Convert HTML content directly to Word document elements.
     * Parses HTML with regex and creates XWPFParagraph/XWPFTable objects directly,
     * avoiding the lossy HTML→markdown→Word pipeline.
     */
    private void convertHtmlToWord(String html, XWPFDocument document) {
        if (html == null || html.isEmpty()) return;

        // Extract and remove stationery footer (will be appended at end)
        String footerText = null;
        String processedHtml = html;
        int fStart = html.indexOf("<!--STATIONERY_FOOTER_START-->");
        int fEnd = html.indexOf("<!--STATIONERY_FOOTER_END-->");
        if (fStart != -1 && fEnd != -1) {
            String footerBlock = html.substring(fStart, fEnd + "<!--STATIONERY_FOOTER_END-->".length());
            footerText = footerBlock.replaceAll("<[^>]+>", "").replaceAll("<!--[^>]+-->", "")
                .replace("&middot;", "\u00B7").replace("&nbsp;", " ").replace("&amp;", "&").trim();
            processedHtml = html.replace(footerBlock, "");
        }

        // Decode HTML entities first
        processedHtml = processedHtml.replace("&nbsp;", " ").replace("&amp;", "&")
            .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
            .replace("&#39;", "'").replace("&middot;", "\u00B7");

        // Process HTML tables first — extract them and replace with placeholders
        java.util.List<String> tableHtmlBlocks = new java.util.ArrayList<>();
        String lowerHtml = processedHtml.toLowerCase();
        StringBuilder withPlaceholders = new StringBuilder();
        int searchFrom = 0;
        while (true) {
            int tableStart = lowerHtml.indexOf("<table", searchFrom);
            if (tableStart == -1) break;
            int tableEndTag = lowerHtml.indexOf("</table>", tableStart);
            if (tableEndTag == -1) break;
            int tableEnd = tableEndTag + 8;

            // Check if table is inside a <figure> — include the figure tag
            String before = processedHtml.substring(Math.max(0, tableStart - 100), tableStart);
            int figureStart = before.toLowerCase().lastIndexOf("<figure");
            int actualStart = tableStart;
            int actualEnd = tableEnd;
            if (figureStart != -1) {
                actualStart = tableStart - (before.length() - figureStart);
                int figEnd = lowerHtml.indexOf("</figure>", tableEnd);
                if (figEnd != -1) actualEnd = figEnd + 9;
            }

            withPlaceholders.append(processedHtml, searchFrom, actualStart);
            // Wrap the placeholder in newlines so it lands on its own line after HTML tag
            // stripping — otherwise CKEditor's unbroken `<p>…</p><figure><table>…</table></figure><p>…</p>`
            // sequence merges the placeholder with trailing paragraph text, and the line-level
            // `trimmed.matches("__TABLE_PLACEHOLDER_\\d+__")` check fails, leaking the raw token.
            withPlaceholders.append("\n__TABLE_PLACEHOLDER_").append(tableHtmlBlocks.size()).append("__\n");
            tableHtmlBlocks.add(processedHtml.substring(tableStart, tableEnd));
            searchFrom = actualEnd;
        }
        if (searchFrom < processedHtml.length()) {
            withPlaceholders.append(processedHtml.substring(searchFrom));
        }

        String textContent = withPlaceholders.toString();

        // Strip remaining HTML tags but preserve structure via newlines
        textContent = textContent.replaceAll("(?i)</p>\\s*<p[^>]*>", "\n\n");
        textContent = textContent.replaceAll("(?i)<h1[^>]*>(.*?)</h1>", "\n__H1__$1__/H1__\n");
        textContent = textContent.replaceAll("(?i)<h2[^>]*>(.*?)</h2>", "\n__H2__$1__/H2__\n");
        textContent = textContent.replaceAll("(?i)<h3[^>]*>(.*?)</h3>", "\n__H3__$1__/H3__\n");
        textContent = textContent.replaceAll("(?i)<h4[^>]*>(.*?)</h4>", "\n__H4__$1__/H4__\n");
        textContent = textContent.replaceAll("(?i)<h5[^>]*>(.*?)</h5>", "\n__H5__$1__/H5__\n");
        textContent = textContent.replaceAll("(?i)<h6[^>]*>(.*?)</h6>", "\n__H6__$1__/H6__\n");
        textContent = textContent.replaceAll("(?i)<strong[^>]*>(.*?)</strong>", "__BOLD__$1__/BOLD__");
        textContent = textContent.replaceAll("(?i)<b[^>]*>(.*?)</b>", "__BOLD__$1__/BOLD__");
        textContent = textContent.replaceAll("(?i)<em[^>]*>(.*?)</em>", "__ITALIC__$1__/ITALIC__");
        textContent = textContent.replaceAll("(?i)<i[^>]*>(.*?)</i>", "__ITALIC__$1__/ITALIC__");
        textContent = textContent.replaceAll("(?i)<u[^>]*>(.*?)</u>", "__UNDERLINE__$1__/UNDERLINE__");
        textContent = textContent.replaceAll("(?i)<li[^>]*>", "\n__LI__");
        textContent = textContent.replaceAll("(?i)</li>", "__/LI__");
        textContent = textContent.replaceAll("(?i)<hr[^>]*/?>", "\n__HR__\n");
        textContent = textContent.replaceAll("(?i)<br\\s*/?>", "\n");
        textContent = textContent.replaceAll("(?i)<p[^>]*>", "");
        textContent = textContent.replaceAll("(?i)</p>", "\n");
        textContent = textContent.replaceAll("(?i)</?[uo]l[^>]*>", "\n");
        textContent = textContent.replaceAll("<[^>]+>", ""); // Strip all remaining HTML tags
        textContent = textContent.replaceAll("[ \\t]+", " ");
        textContent = textContent.replaceAll("\n{3,}", "\n\n");

        // Process line by line, inserting tables at placeholders
        String[] lines = textContent.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            // Check for table placeholder
            if (trimmed.matches("__TABLE_PLACEHOLDER_\\d+__")) {
                int idx = Integer.parseInt(trimmed.replaceAll("\\D+", ""));
                if (idx < tableHtmlBlocks.size()) {
                    addHtmlTableToWord(document, tableHtmlBlocks.get(idx));
                }
                continue;
            }

            // Headings
            java.util.regex.Matcher hMatcher = java.util.regex.Pattern.compile("__H(\\d)__(.*)__/H\\d__").matcher(trimmed);
            if (hMatcher.find()) {
                int level = Integer.parseInt(hMatcher.group(1));
                String text = stripFormattingMarkers(hMatcher.group(2)).trim();
                if (text.isEmpty()) continue;
                XWPFParagraph para = document.createParagraph();
                para.setSpacingBefore(level == 1 ? 400 : 300);
                para.setSpacingAfter(200);
                XWPFRun run = para.createRun();
                run.setText(text);
                run.setBold(true);
                run.setFontFamily("Georgia");
                run.setFontSize(level == 1 ? 16 : (level == 2 ? 14 : 12));
                continue;
            }

            // Horizontal rule
            if (trimmed.equals("__HR__")) {
                XWPFParagraph para = document.createParagraph();
                para.setSpacingBefore(200);
                para.setSpacingAfter(200);
                para.setBorderBottom(Borders.SINGLE);
                continue;
            }

            // List items
            if (trimmed.startsWith("__LI__")) {
                String itemText = trimmed.replace("__LI__", "").replace("__/LI__", "").trim();
                itemText = stripFormattingMarkers(itemText);
                XWPFParagraph para = document.createParagraph();
                para.setIndentationLeft(720);
                XWPFRun bullet = para.createRun();
                bullet.setText("\u2022 ");
                bullet.setFontFamily("Georgia");
                bullet.setFontSize(12);
                XWPFRun run = para.createRun();
                run.setText(itemText);
                run.setFontFamily("Georgia");
                run.setFontSize(12);
                continue;
            }

            // Regular paragraph with inline formatting
            XWPFParagraph para = document.createParagraph();
            para.setSpacingAfter(150);
            addFormattedRuns(para, trimmed);
        }

        // Append footer at end
        if (footerText != null && !footerText.isBlank()) {
            XWPFParagraph spacer = document.createParagraph();
            spacer.setSpacingBefore(600);
            XWPFParagraph sep = document.createParagraph();
            sep.setBorderBottom(Borders.SINGLE);
            XWPFParagraph footerPara = document.createParagraph();
            footerPara.setAlignment(ParagraphAlignment.CENTER);
            footerPara.setSpacingBefore(100);
            XWPFRun footerRun = footerPara.createRun();
            footerRun.setText(footerText);
            footerRun.setFontSize(8);
            footerRun.setColor("555555");
            footerRun.setFontFamily("Times New Roman");
        }
    }

    /**
     * Parse an HTML table and add it to the Word document as XWPFTable
     */
    private void addHtmlTableToWord(XWPFDocument document, String tableHtml) {
        // Extract rows
        java.util.regex.Pattern rowPat = java.util.regex.Pattern.compile(
            "(?i)<tr[^>]*>(.*?)</tr>", java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher rowMatcher = rowPat.matcher(tableHtml);

        java.util.List<java.util.List<String>> allRows = new java.util.ArrayList<>();
        while (rowMatcher.find()) {
            String rowContent = rowMatcher.group(1);
            java.util.regex.Pattern cellPat = java.util.regex.Pattern.compile(
                "(?i)<t([hd])[^>]*>(.*?)</t[hd]>", java.util.regex.Pattern.DOTALL);
            java.util.regex.Matcher cellMatcher = cellPat.matcher(rowContent);

            java.util.List<String> cells = new java.util.ArrayList<>();
            while (cellMatcher.find()) {
                String cellContent = cellMatcher.group(2);
                // Convert <p> tags to newlines, strip remaining HTML
                cellContent = cellContent.replaceAll("(?i)</p>\\s*<p[^>]*>", "\n");
                cellContent = cellContent.replaceAll("(?i)<br\\s*/?>", "\n");
                cellContent = cellContent.replaceAll("<[^>]+>", "");
                cellContent = cellContent.replace("&nbsp;", " ").replace("&amp;", "&").trim();
                cells.add(cellContent);
            }
            if (!cells.isEmpty()) {
                allRows.add(cells);
            }
        }

        if (allRows.isEmpty()) return;

        int colCount = allRows.stream().mapToInt(java.util.List::size).max().orElse(0);
        if (colCount == 0) return;

        // Create table
        XWPFTable table = document.createTable(allRows.size(), colCount);

        // Set proper widths via XML
        int cellWidthTwips = 9360 / colCount;
        CTTbl ctTbl = table.getCTTbl();
        CTTblPr tblPr = ctTbl.getTblPr();
        if (tblPr == null) tblPr = ctTbl.addNewTblPr();

        // CRITICAL: Set FIXED layout — without this Word auto-fits and ignores widths
        CTTblLayoutType layout = tblPr.getTblLayout();
        if (layout == null) layout = tblPr.addNewTblLayout();
        layout.setType(STTblLayoutType.FIXED);

        CTTblWidth tblWidth = tblPr.getTblW();
        if (tblWidth == null) tblWidth = tblPr.addNewTblW();
        tblWidth.setType(STTblWidth.DXA);
        tblWidth.setW(java.math.BigInteger.valueOf(9360));

        // Rebuild grid columns with proper widths
        CTTblGrid grid = ctTbl.getTblGrid();
        if (grid == null) grid = ctTbl.addNewTblGrid();
        // Clear existing grid cols
        while (grid.sizeOfGridColArray() > 0) {
            grid.removeGridCol(0);
        }
        // Add grid cols with correct widths
        for (int i = 0; i < colCount; i++) {
            grid.addNewGridCol().setW(java.math.BigInteger.valueOf(cellWidthTwips));
        }

        for (int r = 0; r < allRows.size(); r++) {
            java.util.List<String> cells = allRows.get(r);
            XWPFTableRow tableRow = table.getRow(r);
            boolean isHeader = r == 0;

            for (int c = 0; c < colCount; c++) {
                String cellText = c < cells.size() ? cells.get(c) : "";
                XWPFTableCell cell = tableRow.getCell(c);

                // Set cell width
                CTTc ctTc = cell.getCTTc();
                CTTcPr tcPr = ctTc.getTcPr();
                if (tcPr == null) tcPr = ctTc.addNewTcPr();
                CTTblWidth cw = tcPr.getTcW();
                if (cw == null) cw = tcPr.addNewTcW();
                cw.setType(STTblWidth.DXA);
                cw.setW(java.math.BigInteger.valueOf(cellWidthTwips));

                // Clear default paragraph
                cell.removeParagraph(0);

                // Cell content may have multiple lines (from <p> elements)
                String[] cellLines = cellText.split("\n");
                for (String cellLine : cellLines) {
                    String trimmedLine = cellLine.trim();
                    if (trimmedLine.isEmpty() && cellLines.length > 1) continue;
                    XWPFParagraph cellPara = cell.addParagraph();
                    XWPFRun run = cellPara.createRun();
                    run.setText(trimmedLine);
                    run.setFontFamily("Georgia");
                    run.setFontSize(11);
                    if (isHeader) {
                        run.setBold(true);
                    }
                }

                // Ensure at least one paragraph
                if (cell.getParagraphs().isEmpty()) {
                    cell.addParagraph();
                }

                if (isHeader) {
                    cell.setColor("E8E8E8");
                }
            }
        }
    }

    /**
     * Strip formatting markers (__BOLD__, __ITALIC__, __UNDERLINE__) and return plain text
     */
    private String stripFormattingMarkers(String text) {
        return text.replaceAll("__(BOLD|ITALIC|UNDERLINE|/BOLD|/ITALIC|/UNDERLINE)__", "");
    }

    /**
     * Add formatted runs to a paragraph, parsing __BOLD__, __ITALIC__, __UNDERLINE__ markers
     */
    private void addFormattedRuns(XWPFParagraph para, String text) {
        // Simple approach: process bold markers
        String cleaned = text.replaceAll("__(ITALIC|/ITALIC|UNDERLINE|/UNDERLINE)__", "");
        String[] parts = cleaned.split("__(?:BOLD|/BOLD)__");

        boolean isBold = cleaned.startsWith("__BOLD__");
        for (int i = 0; i < parts.length; i++) {
            if (parts[i].isEmpty()) {
                isBold = !isBold;
                continue;
            }
            XWPFRun run = para.createRun();
            run.setText(parts[i]);
            run.setFontFamily("Georgia");
            run.setFontSize(12);
            if (isBold) {
                run.setBold(true);
            }
            isBold = !isBold;
        }

        // If no parts were added, add the raw text
        if (para.getRuns().isEmpty()) {
            XWPFRun run = para.createRun();
            run.setText(stripFormattingMarkers(text));
            run.setFontFamily("Georgia");
            run.setFontSize(12);
        }
    }

    /**
     * Convert Markdown content to Word document paragraphs
     * Handles headers (#, ##, ###), bold (**text**), lists, and paragraphs
     */
    private void convertMarkdownToWord(String markdown, XWPFDocument document) {
        if (markdown == null || markdown.isEmpty()) {
            return;
        }

        String[] lines = markdown.split("\n");
        int i = 0;

        while (i < lines.length) {
            String trimmed = lines[i].trim();

            if (trimmed.isEmpty()) {
                i++;
                continue;
            }

            // Check for markdown table rows (| col1 | col2 |)
            if (isMarkdownTableRow(trimmed)) {
                // Collect consecutive table rows
                java.util.List<String> tableRows = new java.util.ArrayList<>();
                while (i < lines.length) {
                    String t = lines[i].trim();
                    if (isMarkdownTableRow(t) || isMarkdownTableSeparator(t)) {
                        if (!isMarkdownTableSeparator(t)) {
                            tableRows.add(t);
                        }
                        i++;
                    } else if (t.isEmpty()) {
                        i++;
                        break;
                    } else {
                        break;
                    }
                }
                if (!tableRows.isEmpty()) {
                    addMarkdownTableToWord(document, tableRows);
                }
                continue;
            }

            // Check for headers (# H1, ## H2, ### H3)
            if (trimmed.startsWith("#")) {
                int level = 0;
                while (level < trimmed.length() && trimmed.charAt(level) == '#') {
                    level++;
                }

                String headerText = trimmed.substring(level).trim();
                XWPFParagraph para = document.createParagraph();
                para.setSpacingBefore(level == 1 ? 400 : 300);
                para.setSpacingAfter(200);

                XWPFRun run = para.createRun();
                run.setText(headerText);
                run.setBold(true);
                run.setFontFamily("Georgia");
                run.setFontSize(level == 1 ? 16 : (level == 2 ? 14 : 12));

                i++;
                continue;
            }

            // Check for numbered lists (1. Item)
            if (trimmed.matches("^\\d+\\.\\s+.+")) {
                String itemText = trimmed.replaceFirst("^\\d+\\.\\s+", "");
                XWPFParagraph para = document.createParagraph();
                para.setNumID(java.math.BigInteger.ONE); // Simple numbering
                XWPFRun run = para.createRun();
                run.setText(processInlineFormatting(itemText));
                run.setFontFamily("Georgia");
                run.setFontSize(12);

                i++;
                continue;
            }

            // Check for bullet lists (- Item or * Item)
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                String itemText = trimmed.substring(2).trim();
                XWPFParagraph para = document.createParagraph();
                para.setIndentationLeft(720); // Indent bullet items

                XWPFRun bullet = para.createRun();
                bullet.setText("• ");
                bullet.setFontFamily("Georgia");
                bullet.setFontSize(12);

                XWPFRun run = para.createRun();
                run.setText(processInlineFormatting(itemText));
                run.setFontFamily("Georgia");
                run.setFontSize(12);

                i++;
                continue;
            }

            // Check for horizontal rule (--- or ___ or ***)
            if (trimmed.matches("^[-_*]{3,}$")) {
                XWPFParagraph para = document.createParagraph();
                para.setSpacingBefore(200);
                para.setSpacingAfter(200);
                para.setBorderBottom(Borders.SINGLE);
                i++;
                continue;
            }

            // Regular paragraph
            XWPFParagraph para = document.createParagraph();
            para.setSpacingAfter(150);
            para.setAlignment(ParagraphAlignment.LEFT);

            // Process inline formatting (bold, italic)
            processInlineFormattingAdvanced(trimmed, para);
            i++;
        }
    }

    /**
     * Check if a line looks like a markdown table row (contains pipes)
     */
    private boolean isMarkdownTableRow(String line) {
        if (line == null || line.isEmpty()) return false;
        String t = line.trim();
        return t.contains("|") && t.split("\\|").length >= 3;
    }

    /**
     * Check if a line is a markdown table separator (|---|---|)
     */
    private boolean isMarkdownTableSeparator(String line) {
        if (line == null || line.isEmpty()) return false;
        return line.trim().matches("^[|\\s\\-:]+$");
    }

    /**
     * Add a markdown table to the Word document using Apache POI XWPFTable
     */
    private void addMarkdownTableToWord(XWPFDocument document, java.util.List<String> rows) {
        if (rows.isEmpty()) return;

        // Parse first row to determine column count
        String[] firstCells = parseMarkdownTableCells(rows.get(0));
        int colCount = firstCells.length;
        if (colCount == 0) return;

        // Create table
        XWPFTable table = document.createTable(rows.size(), colCount);

        // Set table width to full page width (9360 twips = 6.5 inches)
        int cellWidthTwips = 9360 / colCount;

        table.setTableAlignment(TableRowAlign.CENTER);
        CTTbl ctTbl = table.getCTTbl();
        CTTblPr tblPr = ctTbl.getTblPr();
        if (tblPr == null) tblPr = ctTbl.addNewTblPr();

        // CRITICAL: Set FIXED layout — without this Word auto-fits and ignores widths
        CTTblLayoutType layout = tblPr.getTblLayout();
        if (layout == null) layout = tblPr.addNewTblLayout();
        layout.setType(STTblLayoutType.FIXED);

        // Override table width
        CTTblWidth tblWidth = tblPr.getTblW();
        if (tblWidth == null) tblWidth = tblPr.addNewTblW();
        tblWidth.setType(STTblWidth.DXA);
        tblWidth.setW(java.math.BigInteger.valueOf(9360));

        // Rebuild grid columns with proper widths
        CTTblGrid grid = ctTbl.getTblGrid();
        if (grid == null) grid = ctTbl.addNewTblGrid();
        while (grid.sizeOfGridColArray() > 0) {
            grid.removeGridCol(0);
        }
        for (int i = 0; i < colCount; i++) {
            grid.addNewGridCol().setW(java.math.BigInteger.valueOf(cellWidthTwips));
        }

        for (int r = 0; r < rows.size(); r++) {
            String[] cells = parseMarkdownTableCells(rows.get(r));
            XWPFTableRow tableRow = table.getRow(r);

            for (int c = 0; c < colCount; c++) {
                String cellText = c < cells.length ? cells[c] : "";
                XWPFTableCell cell = tableRow.getCell(c);

                // Set cell width explicitly
                CTTc ctTc = cell.getCTTc();
                CTTcPr tcPr = ctTc.getTcPr();
                if (tcPr == null) tcPr = ctTc.addNewTcPr();
                CTTblWidth cw = tcPr.getTcW();
                if (cw == null) cw = tcPr.addNewTcW();
                cw.setType(STTblWidth.DXA);
                cw.setW(java.math.BigInteger.valueOf(cellWidthTwips));

                // Clear default paragraph and create styled one
                cell.removeParagraph(0);
                XWPFParagraph cellPara = cell.addParagraph();
                XWPFRun run = cellPara.createRun();
                run.setText(processInlineFormatting(cellText));
                run.setFontFamily("Georgia");
                run.setFontSize(11);

                // Bold for header row
                if (r == 0) {
                    run.setBold(true);
                    cell.setColor("E8E8E8");
                }
            }
        }
    }

    /**
     * Parse cells from a markdown table row string
     */
    private String[] parseMarkdownTableCells(String row) {
        // Split by pipe and trim
        String[] parts = row.split("\\|");
        java.util.List<String> cells = new java.util.ArrayList<>();
        for (int i = 0; i < parts.length; i++) {
            String cell = parts[i].trim();
            // Skip empty leading/trailing cells from pipes
            if (i == 0 && cell.isEmpty()) continue;
            if (i == parts.length - 1 && cell.isEmpty()) continue;
            cells.add(cell);
        }
        return cells.toArray(new String[0]);
    }

    /**
     * Process inline Markdown formatting (bold **text**, italic *text*, links [text](url))
     * Returns plain text with formatting stripped (simplified version)
     */
    private String processInlineFormatting(String text) {
        // Convert Markdown links [text](url) to just the text
        text = text.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");
        // Remove Markdown bold **
        text = text.replaceAll("\\*\\*(.+?)\\*\\*", "$1");
        // Remove Markdown italic *
        text = text.replaceAll("\\*(.+?)\\*", "$1");
        return text;
    }

    /**
     * Convert HTML content to plain text with basic formatting preserved.
     * Handles common HTML elements from rich text editors.
     */
    private String convertHtmlToPlainText(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        String text = html;

        // First, decode HTML entities (do this early to help with pattern matching)
        text = text.replace("&amp;", "&");
        text = text.replace("&lt;", "<");
        text = text.replace("&gt;", ">");
        text = text.replace("&quot;", "\"");
        text = text.replace("&apos;", "'");
        text = text.replace("&nbsp;", " ");
        text = text.replace("&#39;", "'");
        text = text.replace("&#124;", "|");   // Pipe character (decimal)
        text = text.replace("&#x7c;", "|");   // Pipe character (hex)
        text = text.replace("&#x7C;", "|");   // Pipe character (hex uppercase)
        text = text.replace("&vert;", "|");   // Pipe character (named entity)
        text = text.replace("&verbar;", "|"); // Pipe character (another named entity)
        text = text.replace("&#8739;", "|");  // Unicode pipe

        // Handle HTML tables FIRST - convert to proper markdown table format
        text = convertHtmlTablesToMarkdown(text);

        // Also detect and preserve markdown-style tables that might be wrapped in HTML tags
        // Pattern: lines that look like "| something | something |" possibly inside <p> tags
        text = text.replaceAll("<p[^>]*>\\s*(\\|[^<]+\\|)\\s*</p>", "\n$1\n");

        // Handle table rows separated by <br> within a single paragraph
        // This converts inline table rows to separate lines
        java.util.regex.Pattern tableInParagraph = java.util.regex.Pattern.compile(
            "<p[^>]*>((?:\\|[^|<]+)+\\|(?:<br\\s*/?>(?:\\|[^|<]+)+\\|)+)</p>",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher tableMatcher = tableInParagraph.matcher(text);
        while (tableMatcher.find()) {
            String tableContent = tableMatcher.group(1);
            String converted = tableContent.replaceAll("<br\\s*/?>", "\n");
            text = text.replace(tableMatcher.group(0), "\n" + converted + "\n");
        }

        // Preserve line breaks from block elements
        text = text.replaceAll("</p>\\s*<p[^>]*>", "\n\n");  // Paragraph breaks
        text = text.replaceAll("<p[^>]*>", "");               // Opening p tags
        text = text.replaceAll("</p>", "\n");                 // Closing p tags
        text = text.replaceAll("<br\\s*/?>", "\n");           // Line breaks
        text = text.replaceAll("</div>\\s*<div[^>]*>", "\n"); // Div breaks
        text = text.replaceAll("<div[^>]*>", "");             // Opening div tags
        text = text.replaceAll("</div>", "\n");               // Closing div tags

        // Convert headers to markdown-style for processing
        text = text.replaceAll("(?i)<h1[^>]*>(.*?)</h1>", "\n# $1\n");
        text = text.replaceAll("(?i)<h2[^>]*>(.*?)</h2>", "\n## $1\n");
        text = text.replaceAll("(?i)<h3[^>]*>(.*?)</h3>", "\n### $1\n");
        text = text.replaceAll("(?i)<h4[^>]*>(.*?)</h4>", "\n#### $1\n");

        // Convert bold/strong to markdown (using (?s) for multiline and non-greedy)
        text = text.replaceAll("(?i)<strong[^>]*>(.*?)</strong>", "**$1**");
        text = text.replaceAll("(?i)<b[^>]*>(.*?)</b>", "**$1**");

        // Convert italic/em to markdown
        text = text.replaceAll("(?i)<em[^>]*>(.*?)</em>", "*$1*");
        text = text.replaceAll("(?i)<i[^>]*>(.*?)</i>", "*$1*");

        // Extract link text (remove href)
        text = text.replaceAll("(?i)<a[^>]*>(.*?)</a>", "$1");

        // Convert list items
        text = text.replaceAll("(?i)<li[^>]*>", "\n• ");
        text = text.replaceAll("(?i)</li>", "");
        text = text.replaceAll("(?i)</?[uo]l[^>]*>", "\n");

        // Remove span tags but keep content
        text = text.replaceAll("(?i)</?span[^>]*>", "");

        // Remove all remaining HTML tags
        text = text.replaceAll("<[^>]+>", "");

        // Clean up extra whitespace
        text = text.replaceAll("[ \\t]+", " ");           // Multiple spaces to single
        text = text.replaceAll("\n[ \\t]+", "\n");        // Leading whitespace on lines
        text = text.replaceAll("[ \\t]+\n", "\n");        // Trailing whitespace on lines
        text = text.replaceAll("\n{3,}", "\n\n");         // Max 2 consecutive newlines

        return text.trim();
    }

    /**
     * Convert HTML tables to markdown table format
     */
    private String convertHtmlTablesToMarkdown(String html) {
        // Simple approach: find table sections and convert row by row
        StringBuilder result = new StringBuilder();
        String remaining = html;
        String lowerHtml = html.toLowerCase();

        log.info("PDF Export: Looking for HTML tables in content (length={})", html.length());
        log.info("PDF Export: Contains <table>: {}, contains ql-table: {}, contains <tr>: {}",
            lowerHtml.contains("<table"), lowerHtml.contains("ql-table"), lowerHtml.contains("<tr"));

        // Log a sample of the content for debugging
        if (html.length() > 0) {
            log.info("PDF Export: Content sample (first 500 chars): {}",
                html.substring(0, Math.min(500, html.length())).replace("\n", "\\n"));
        }

        // Case-insensitive search for table tags
        int searchFrom = 0;
        while (true) {
            int tableStart = lowerHtml.indexOf("<table", searchFrom);
            if (tableStart == -1) break;

            int tableEndTag = lowerHtml.indexOf("</table>", tableStart);
            if (tableEndTag == -1) break;

            log.info("PDF Export: Found HTML table at position {}", tableStart);

            // Add content before table
            result.append(remaining.substring(searchFrom, tableStart));

            // Extract table content (use original case)
            String tableHtml = remaining.substring(tableStart, tableEndTag + 8);
            log.info("PDF Export: Table HTML length: {}", tableHtml.length());

            String markdownTable = convertSingleHtmlTable(tableHtml);
            log.info("PDF Export: Converted table to markdown: {}", markdownTable.substring(0, Math.min(200, markdownTable.length())));

            result.append("\n");
            result.append(markdownTable);
            result.append("\n");

            searchFrom = tableEndTag + 8;
        }

        // Append remaining content after last table (or all content if no tables)
        if (searchFrom < remaining.length()) {
            result.append(remaining.substring(searchFrom));
        }

        return result.toString();
    }

    /**
     * Consolidate table rows that might be separated by blank lines.
     * This handles cases where markdown tables have extra spacing between rows.
     */
    private String consolidateTableRows(String content) {
        String[] lines = content.split("\n");
        StringBuilder result = new StringBuilder();
        List<String> pendingTableRows = new ArrayList<>();
        boolean lastWasTableRow = false;

        for (String line : lines) {
            String trimmed = line.trim();
            boolean isTableRow = trimmed.contains("|") && trimmed.split("\\|").length >= 2;
            boolean isSeparatorRow = trimmed.matches("^\\|?[\\s\\-:|]+\\|?$") && trimmed.contains("-");
            boolean isEmpty = trimmed.isEmpty();

            if (isTableRow || isSeparatorRow) {
                // Flush any non-table content first
                if (!pendingTableRows.isEmpty() && !lastWasTableRow) {
                    for (String pending : pendingTableRows) {
                        result.append(pending).append("\n");
                    }
                    pendingTableRows.clear();
                }
                result.append(trimmed).append("\n");
                lastWasTableRow = true;
            } else if (isEmpty && lastWasTableRow) {
                // Skip blank lines between table rows - don't add to output yet
                // This consolidates the table
                continue;
            } else {
                // Non-table content
                if (lastWasTableRow) {
                    result.append("\n"); // Add one blank line after table
                }
                result.append(line).append("\n");
                lastWasTableRow = false;
            }
        }

        return result.toString();
    }

    /**
     * Convert a single HTML table to markdown format
     * Handles standard HTML tables and Quill editor table format
     */
    private String convertSingleHtmlTable(String tableHtml) {
        StringBuilder markdown = new StringBuilder();
        log.info("PDF Export: Converting HTML table, length={}", tableHtml.length());

        // Extract rows - handle both <tr> and <tbody><tr> patterns
        java.util.regex.Pattern rowPattern = java.util.regex.Pattern.compile(
            "(?i)<tr[^>]*>(.*?)</tr>",
            java.util.regex.Pattern.DOTALL
        );
        java.util.regex.Matcher rowMatcher = rowPattern.matcher(tableHtml);

        boolean isFirstRow = true;
        int columnCount = 0;
        int rowCount = 0;

        while (rowMatcher.find()) {
            String rowContent = rowMatcher.group(1);
            rowCount++;

            // Extract cells (th or td) - Quill uses both
            java.util.regex.Pattern cellPattern = java.util.regex.Pattern.compile(
                "(?i)<t[hd][^>]*>(.*?)</t[hd]>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher cellMatcher = cellPattern.matcher(rowContent);

            StringBuilder row = new StringBuilder("| ");
            int cellCount = 0;

            while (cellMatcher.find()) {
                String cellContent = cellMatcher.group(1);
                // Strip any remaining HTML tags from cell content (including Quill's <p>, <strong>, etc.)
                cellContent = cellContent.replaceAll("<[^>]+>", "");
                // Decode HTML entities
                cellContent = cellContent.replace("&nbsp;", " ")
                                        .replace("&amp;", "&")
                                        .replace("&lt;", "<")
                                        .replace("&gt;", ">")
                                        .trim();
                // Replace newlines with space
                cellContent = cellContent.replaceAll("\\s+", " ");
                row.append(cellContent).append(" | ");
                cellCount++;
            }

            if (cellCount > 0) {
                markdown.append(row.toString().trim()).append("\n");

                // After first row (header), add separator
                if (isFirstRow) {
                    columnCount = cellCount;
                    StringBuilder separator = new StringBuilder("|");
                    for (int i = 0; i < columnCount; i++) {
                        separator.append("---|");
                    }
                    markdown.append(separator).append("\n");
                    isFirstRow = false;
                }
            }
        }

        log.info("PDF Export: Converted {} rows with {} columns", rowCount, columnCount);
        return markdown.toString();
    }

    /**
     * Process inline formatting and apply to Word paragraph
     * Handles bold (**text**) by creating separate runs
     */
    private void processInlineFormattingAdvanced(String text, XWPFParagraph para) {
        // Simple implementation: split by ** for bold
        String[] parts = text.split("\\*\\*");

        for (int i = 0; i < parts.length; i++) {
            if (parts[i].isEmpty()) continue;

            XWPFRun run = para.createRun();
            run.setText(parts[i]);
            run.setFontFamily("Georgia");
            run.setFontSize(12);

            // Odd indices are bold (between **)
            if (i % 2 == 1) {
                run.setBold(true);
            }
        }
    }

    /**
     * Add metadata footer to Word document
     */
    private void addMetadataFooter(XWPFDocument document, Map<String, Object> docData) {
        XWPFParagraph footer = document.createParagraph();
        footer.setSpacingBefore(600);
        footer.setBorderTop(Borders.SINGLE);

        XWPFRun footerRun = footer.createRun();
        footerRun.setFontSize(9);
        footerRun.setColor("666666");
        footerRun.setFontFamily("Arial");

        // Format metadata
        LocalDateTime generatedAt = docData.get("generatedAt") != null
                ? (LocalDateTime) docData.get("generatedAt")
                : LocalDateTime.now();

        String footerText = String.format(
                "Generated: %s | Version: %s | Words: %s | Generated by Legience",
                generatedAt.format(DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")),
                docData.get("version"),
                docData.get("wordCount")
        );

        footerRun.setText(footerText);
    }

    /**
     * Generate PDF document from Markdown content using iText
     */
    public byte[] generatePdfDocument(Long documentId, Long userId, boolean includeMetadata) {
        // Fetch document with latest version
        Optional<Map<String, Object>> docData = getDocumentWithLatestVersion(documentId, userId);
        if (docData.isEmpty()) {
            throw new IllegalArgumentException("Document not found or access denied");
        }

        Map<String, Object> data = docData.get();
        String content = (String) data.get("content");
        String title = (String) data.get("title");
        String documentType = (String) data.get("documentType");
        String approvalStatus = (String) data.get("approvalStatus");

        // For HTML content (AI HTML-template flow, from-template substitution, CKEditor-edited
        // saves), route through the SAME styled-HTML pipeline that generatePdfDocumentFromContent
        // uses for unsaved previews. Without this, the saved-document PDF download would render
        // via the low-level iText markdown converter below — which doesn't honor the letterhead /
        // body / line-height CSS in buildStyledHtmlDocument, so the PDF would look nothing like
        // the in-editor preview the attorney just saw.
        boolean isHtml = content != null && (
            content.contains("<p") || content.contains("<div") ||
            content.contains("<strong") || content.contains("<h1") ||
            content.contains("<h2") || content.contains("<table")
        );
        if (isHtml) {
            String watermark = resolveWatermarkText(approvalStatus);
            return generateStyledHtmlPdf(content, title, documentType, watermark);
        }

        // Markdown / plain-text legacy path — kept for older AI-generated drafts that
        // were saved as markdown before the HTML-template pipeline existed.
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc, PageSize.LETTER);
            document.setMargins(72, 72, 72, 72);

            // Create fonts
            PdfFont titleFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont headerFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont normalFont = PdfFontFactory.createFont(StandardFonts.HELVETICA);

            // Add page numbers to every page
            addPageNumberHandler(pdfDoc);

            // §6.1 gating — stamp every page unless attorney has approved.
            String watermark = resolveWatermarkText(approvalStatus);
            if (watermark != null) {
                addDraftWatermarkHandler(pdfDoc, watermark);
            }

            // Always inject the title — the first H1 in markdown will be skipped
            Paragraph titleParagraph = new Paragraph(title)
                    .setFont(titleFont)
                    .setFontSize(13)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMultipliedLeading(1.15f)
                    .setMarginBottom(6);
            document.add(titleParagraph);

            // Thin horizontal rule under title
            SolidLine titleLine = new SolidLine(0.5f);
            titleLine.setColor(new DeviceRgb(180, 180, 180));
            LineSeparator titleRule = new LineSeparator(titleLine);
            titleRule.setMarginBottom(10);
            document.add(titleRule);

            // Convert Markdown content to PDF, skipping the first H1 (title already rendered above)
            convertMarkdownToPdf(content, document, headerFont, normalFont, true);

            // Add metadata footer if requested
            if (includeMetadata) {
                addPdfMetadataFooter(document, data, normalFont);
            }

            document.close();

            log.info("Successfully generated PDF document ({} bytes)", baos.size());
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("Error generating PDF document", e);
            throw new RuntimeException("Failed to generate PDF document", e);
        }
    }

    public byte[] generateWordDocumentFromContent(String content, String title) {
        return generateWordDocumentFromContent(content, title, null);
    }

    /**
     * Generate Word document from raw content (no document ID required).
     * §6.1 gating — `approvalStatus` drives the DOCX watermark; null defaults to DRAFT.
     */
    public byte[] generateWordDocumentFromContent(String content, String title, String approvalStatus) {
        log.info("Generating Word document from content, title={}, status={}", title, approvalStatus);

        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Content cannot be empty");
        }

        // Detect HTML content (same check as PDF path)
        boolean isHtml = content.contains("<p") || content.contains("<div") ||
                         content.contains("<strong") || content.contains("<h1") ||
                         content.contains("<h2") || content.contains("<table");

        try {
            XWPFDocument document = new XWPFDocument();

            // §6.1 gating — VML text-path in default header stamps every page in Word.
            addDocxWatermark(document, resolveWatermarkText(approvalStatus));

            if (isHtml) {
                log.info("Detected HTML content — using direct HTML-to-Word conversion");
                convertHtmlToWord(content, document);
            } else {
                // Markdown content — use existing pipeline
                if (!contentHasMarkdownTitle(content)) {
                    XWPFParagraph titlePara = document.createParagraph();
                    titlePara.setAlignment(ParagraphAlignment.CENTER);
                    titlePara.setSpacingAfter(400);
                    XWPFRun titleRun = titlePara.createRun();
                    titleRun.setText(title);
                    titleRun.setBold(true);
                    titleRun.setFontSize(18);
                    titleRun.setFontFamily("Georgia");
                }
                convertMarkdownToWord(content, document);
            }

            // Convert to byte array
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.write(out);
            document.close();

            log.info("Successfully generated Word document from content ({} bytes)", out.size());
            return out.toByteArray();

        } catch (IOException e) {
            log.error("Error generating Word document from content", e);
            throw new RuntimeException("Failed to generate Word document", e);
        }
    }

    /**
     * Generate PDF document from raw content (no document ID required)
     * Uses iText HtmlConverter to render styled HTML → PDF that matches the preview exactly.
     * Falls back to markdown pipeline for non-HTML content.
     */
    public byte[] generatePdfDocumentFromContent(String content, String title) {
        return generatePdfDocumentFromContent(content, title, null, null);
    }

    public byte[] generatePdfDocumentFromContent(String content, String title, String documentType) {
        return generatePdfDocumentFromContent(content, title, documentType, null);
    }

    /**
     * §6.1 gating — `approvalStatus` drives the export watermark. Pass null and the
     * default "draft" stamp applies (safer default for workflow drafts that bypass the
     * document-ID lookup). Pass "attorney_reviewed" to export clean paper.
     */
    public byte[] generatePdfDocumentFromContent(String content, String title, String documentType, String approvalStatus) {
        log.info("Generating PDF document from content, title={}, type={}, status={}", title, documentType, approvalStatus);

        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Content cannot be empty");
        }

        String watermark = resolveWatermarkText(approvalStatus);

        // If content is HTML, use HtmlConverter for WYSIWYG PDF matching the preview
        boolean isHtml = content.contains("<p") || content.contains("<div") ||
                         content.contains("<strong") || content.contains("<h1") ||
                         content.contains("<h2") || content.contains("<table");

        if (isHtml) {
            return generateStyledHtmlPdf(content, title, documentType, watermark);
        }

        // Fallback: markdown pipeline for plain text content
        return generateMarkdownPdf(content, title, watermark);
    }

    private byte[] generateStyledHtmlPdf(String htmlContent, String title) {
        return generateStyledHtmlPdf(htmlContent, title, null, resolveWatermarkText(null));
    }

    private byte[] generateStyledHtmlPdf(String htmlContent, String title, String documentType) {
        return generateStyledHtmlPdf(htmlContent, title, documentType, resolveWatermarkText(null));
    }

    /**
     * Generate PDF from HTML content using iText HtmlConverter.
     * Wraps the editor HTML in a styled HTML document that matches the frontend preview.
     */
    private byte[] generateStyledHtmlPdf(String htmlContent, String title, String documentType, String watermarkText) {
        try {
            // Extract footer from HTML — it will be drawn at absolute page bottom via PdfCanvas
            String footerText = null;
            int fStart = htmlContent.indexOf("<!--STATIONERY_FOOTER_START-->");
            int fEnd = htmlContent.indexOf("<!--STATIONERY_FOOTER_END-->");
            if (fStart != -1 && fEnd != -1) {
                String footerBlock = htmlContent.substring(fStart, fEnd + "<!--STATIONERY_FOOTER_END-->".length());
                footerText = footerBlock.replaceAll("<[^>]+>", "").replaceAll("<!--[^>]+-->", "")
                    .replace("&middot;", "\u00B7").replace("&nbsp;", " ").replace("&amp;", "&").trim();
                htmlContent = htmlContent.replace(footerBlock, "");
            }
            boolean hasFooter = footerText != null && !footerText.isBlank();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            pdfDoc.setDefaultPageSize(PageSize.LETTER);

            // Add page numbers
            addPageNumberHandler(pdfDoc);

            // §6.1 gating — diagonal DRAFT/IN REVIEW stamp on every page
            if (watermarkText != null) {
                addDraftWatermarkHandler(pdfDoc, watermarkText);
            }

            // Preprocess: rewrite imported-template structural classes into native HTML markup
            // that iText html2pdf renders reliably. iText's CSS class-selector engine has a soft
            // spot for `border` properties on <p> elements — `<hr>` and `<table>` borders, by
            // contrast, are rock-solid in iText AND in CKEditor's default rendering. Doing the
            // rewrite here means existing imported templates work without re-import.
            htmlContent = rewriteImportStructuralMarkup(htmlContent);

            // Preprocess: wrap heading+content groups in keep-together divs for page breaks
            htmlContent = wrapSectionsForPageBreaks(htmlContent);

            // Build a complete HTML document with embedded CSS matching the frontend
            String styledHtml = buildStyledHtmlDocument(htmlContent, title, hasFooter, documentType);

            // Use iText HtmlConverter to render the styled HTML → PDF
            java.io.ByteArrayInputStream htmlStream = new java.io.ByteArrayInputStream(
                styledHtml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            HtmlConverter.convertToPdf(htmlStream, pdfDoc, new ConverterProperties());

            byte[] pdfBytes = baos.toByteArray();
            log.info("Successfully generated styled HTML PDF ({} bytes)", pdfBytes.length);

            // Draw footer at absolute bottom of last page using PdfCanvas
            if (hasFooter) {
                pdfBytes = addFooterToLastPage(pdfBytes, footerText);
            }

            return pdfBytes;

        } catch (Exception e) {
            log.error("Error generating styled HTML PDF, falling back to markdown pipeline", e);
            // Fallback to markdown pipeline if HtmlConverter fails
            return generateMarkdownPdf(htmlContent, title, watermarkText);
        }
    }

    /**
     * Build a complete HTML document with CSS that matches the frontend preview styling.
     */
    private String buildStyledHtmlDocument(String bodyHtml, String title) {
        return buildStyledHtmlDocument(bodyHtml, title, false, null);
    }

    private String buildStyledHtmlDocument(String bodyHtml, String title, boolean hasFooter) {
        return buildStyledHtmlDocument(bodyHtml, title, hasFooter, null);
    }

    private String buildStyledHtmlDocument(String bodyHtml, String title, boolean hasFooter, String documentType) {
        // Extra bottom padding when footer will be drawn at page bottom via PdfCanvas
        String bottomPadding = hasFooter ? "96px" : "64px";
        // Detect letter type from documentType or title fallback
        boolean isLetter = isLetterType(documentType)
            || (documentType == null && title != null && (title.toLowerCase().contains("demand") || title.toLowerCase().contains("letter")));
        // Trusts, wills, contracts, agreements: their ARTICLE/SECTION headings are body content
        // and should read left-aligned like prose, not centered like a court-filing caption.
        boolean isInstrument = isInstrumentType(documentType)
            || (title != null && (title.toLowerCase().contains("trust")
                || title.toLowerCase().contains("will")
                || title.toLowerCase().contains("agreement")
                || title.toLowerCase().contains("contract")));
        // Use the same left-aligned headings as letters for instruments so ARTICLE-N section
        // headings don't render centered. The document title (Claude marks it with inline
        // text-align:center) still centers because inline style beats stylesheet.
        boolean leftAlignHeadings = isLetter || isInstrument;
        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/>"
             + "<style>"
             // Body: serif font, 12pt.
             // Court filings → 1" top + 1" sides (court rule requirement) + 2.0 line-height.
             // Letters     → 1/3" top + 2/3" sides + 1.5 line-height + 12pt paragraph margin.
             //               Modern compact letterhead density — keeps the body content
             //               substantially closer to the page edges than the old 1" margins.
             + "body { font-family: 'Times New Roman', Georgia, serif; "
             + "font-size: 12pt; "
             + (isLetter ? "line-height: 1.5; " : "line-height: 2.0; ")
             + "color: #212529; margin: 0; "
             + (isLetter
                ? "padding: 24px 48px " + bottomPadding + " 48px;"
                : "padding: 72px 72px " + bottomPadding + " 72px;")
             + " }"
             // Headings: uniform 12pt, no indent
             // Court filings: h1/h2 centered. Letters AND instruments (trusts/wills/contracts):
             // h1/h2 left-aligned — instrument ARTICLE/SECTION headings are body content, not
             // case captions.
             + (leftAlignHeadings
                ? "h1 { font-size: 12pt; font-weight: 700; margin: 20px 0 10px; color: #212529; text-indent: 0; }"
                  + "h2 { font-size: 12pt; font-weight: 700; margin: 18px 0 8px; color: #212529; text-indent: 0; }"
                : "h1 { font-size: 12pt; font-weight: 700; margin: 20px 0 10px; color: #212529; text-align: center; text-indent: 0; text-decoration: underline; }"
                  + "h2 { font-size: 12pt; font-weight: 700; margin: 18px 0 8px; color: #212529; text-align: center; text-indent: 0; }"
             )
             + "h3 { font-size: 12pt; font-weight: 700; margin: 16px 0 8px; color: #212529; text-indent: 0; }"
             + "h4 { font-size: 12pt; font-weight: 600; margin: 14px 0 6px; color: #212529; text-indent: 0; }"
             // Paragraphs: no global indent — body paragraph indent applied via inline style in template.
             // Court filings: zero margin (continuous flow, indentation is via text-indent).
             // Letters: 12pt bottom margin so paragraphs are visually separated by an empty line —
             // matches the CKEditor preview, where each <p> has its default block margin.
             + (isLetter
                ? "p { margin: 0 0 12pt 0; }"
                : "p { margin: 0 0 0; }")
             // Tables: dark header matching CKEditor preview, clean body rows.
             // Bottom margin is a full double-spaced line (~36px at 12pt/line-height 2.0) so the
             // paragraph that follows a table has an unambiguous visual gap — body `p` margin is 0,
             // so the figure alone carries the break. 24px is below one line-height and reads as
             // "butting up against" rather than "separated".
             + "table { width: 100%; border-collapse: collapse; margin: 16px 0 36px 0; font-size: 11pt; }"
             + "th, td { border: 1px solid #dee2e6; padding: 10px 12px; text-align: left; vertical-align: top; }"
             + "th { background-color: #2d2d2d; font-weight: 700; color: #ffffff; text-transform: uppercase; }"
             + "tr:nth-child(even) td { background-color: #ffffff; }"
             // Lists: proper indentation matching CKEditor
             + "ul, ol { margin: 8px 0 12px 0; padding-left: 24px; }"
             + "li { margin-bottom: 6px; line-height: 1.5; }"
             // Blockquote
             + "blockquote { border-left: 4px solid #dee2e6; margin: 16px 0; "
             + "padding: 12px 20px; color: #6c757d; background: #f8f9fa; }"
             // Inline formatting
             + "strong { font-weight: 600; }"
             + "em { font-style: italic; }"
             + "a { color: #405189; text-decoration: underline; }"
             // Horizontal rule
             + "hr { border: none; border-top: 1px solid #dee2e6; margin: 24px 0; }"
             // CKEditor figure/table wrapper. Extra bottom margin ensures a clear gap between the table and the
             // next paragraph (body `p` has zero margin, so the figure alone carries the visual break).
             + "figure.table { margin: 16px 0 36px 0; display: block; }"
             + "figure { margin: 16px 0 36px 0; }"
             // Legal document specific
             + ".exhibit-ref { color: #405189; text-decoration: underline; text-decoration-style: dotted; }"
             // Imported-template structural elements (preserved across CKEditor sanitization via class attributes,
             // not inline styles — CKEditor's default config strips style="" but keeps class="").
             // .signature-line: paragraph rendered with a top border so the signatory's name reads as if it sits
             // on a "sign here" rule. .callout-box: black-bordered div around notary disclaimers / sworn-statement
             // preambles / important-notice blocks the original PDF rendered in a bordered rectangle.
             // .document-title: centered, larger title at the top of an instrument (trust name, will title, etc.).
             + ".signature-line { border-top: 1px solid #000; margin-top: 24pt; padding-top: 4pt; }"
             + ".callout-box { border: 1px solid #000; padding: 8pt 12pt; margin: 12pt 0; border-radius: 2pt; }"
             + ".callout-box > p { margin: 4pt 0; }"
             + ".document-title { font-size: 18pt !important; font-weight: 700 !important; "
             +   "text-align: center !important; margin: 24pt 0 18pt 0 !important; text-decoration: none !important; }"
             // Stationery frames: borderless tables, serif font (must match CKEditor frame CSS)
             + ".stationery-letterhead table, .stationery-signature table, .stationery-footer table "
             + "{ border: none !important; border-collapse: collapse !important; margin: 0; }"
             + ".stationery-letterhead td, .stationery-letterhead th, "
             + ".stationery-signature td, .stationery-signature th, "
             + ".stationery-footer td, .stationery-footer th "
             + "{ border: none !important; padding: 2px 4px; background: none !important; }"
             + ".stationery-letterhead img, .stationery-signature img, .stationery-footer img "
             + "{ max-width: 100%; height: auto; }"
             // Letterhead spacing — modern compact density.
             // 12pt bottom = ~1/6" between letterhead and date. The body's top padding
             // already handles the page-top margin, so no margin-top here.
             + ".stationery-letterhead { margin-top: 0; margin-bottom: 12pt; padding-bottom: 2px; }"
             + ".stationery-letterhead p, .stationery-letterhead td, .stationery-letterhead span, "
             + ".stationery-letterhead div, .stationery-letterhead th "
             + "{ font-family: 'Times New Roman', Georgia, serif !important; }"
             // MIDDLE-align letterhead cells so the right-side info anchors against the
             // vertical CENTER of the (typically taller) logo instead of its top edge.
             // For a logo that's ~5 large lines tall and right info that's 4-6 small lines,
             // top-align leaves the right block looking truncated against the logo. Center
             // alignment makes them visually balance regardless of line counts.
             + ".stationery-letterhead td, .stationery-letterhead th { vertical-align: middle !important; }"
             // Right-side info (attorney name, address, phone, fax, email).
             // 12pt + line-height 2.0 = 24pt per line. With 5 typical lines that's ~120pt
             // of vertical extent, comparable to a 4-line large logo. This is the only
             // honest way to make the right block "fill" the logo's height without
             // truncating the visual against a much taller logo.
             // !important defeats any inline font-size StationeryService injects via {{}}.
             + ".stationery-letterhead td:last-child, "
             + ".stationery-letterhead td:last-child p, "
             + ".stationery-letterhead td:last-child div, "
             + ".stationery-letterhead td:last-child span "
             + "{ font-size: 12pt !important; line-height: 2.0 !important; text-align: right !important; }"
             // Signature: body-matching font size, color, and line-height
             + ".stationery-signature p, .stationery-signature span, .stationery-signature div "
             + "{ font-size: 12pt !important; font-family: 'Times New Roman', Georgia, serif !important; "
             + "color: #212529 !important; line-height: 1.6 !important; }"
             // Footer: professional dark text, readable font size, matching serif font
             + ".stationery-footer { text-align: center !important; }"
             + ".stationery-footer p, .stationery-footer td, .stationery-footer span, "
             + ".stationery-footer div, .stationery-footer th "
             + "{ font-family: 'Times New Roman', Georgia, serif !important; "
             + "font-size: 9pt !important; color: #333333 !important; "
             + "text-align: center !important; }"
             // Page-break rules: keep headings with their following content
             + "h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }"
             + "p { orphans: 2; widows: 2; }"
             // Caption headers & document titles: iText's Div object ignores text-align entirely.
             // preprocessForPdf() converts centered <div> to <p class="tc"> — Paragraph supports alignment.
             + ".tc { text-align: center !important; line-height: 1.3; margin: 0 0 8px 0; }"
             // Caption tables: borderless, single-spaced, 12pt (override body double-spacing)
             // Do NOT override width or margin — caption templates use width="85%" + margin:auto for centering
             + "table[border=\"0\"] { border: none !important; font-size: 12pt !important; line-height: 1.3 !important; }"
             + "table[border=\"0\"] td, table[border=\"0\"] th { border: none !important; padding: 2px 4px; font-size: 12pt !important; text-indent: 0 !important; }"
             // Table pagination — row-level rigidity only.
             //   - `tr { page-break-inside: avoid }` keeps each row intact.
             //   - `tr:last-child { page-break-before: avoid }` pulls the last row (typically the
             //     bold "Total" row in summary tables) to its predecessor, preventing the Total
             //     from being orphaned alone at the top of the next page.
             // Do NOT add `table { page-break-inside: avoid }` — stacked rigidity causes iText
             // to strand paragraphs/headings on blank pages when a table can't fit.
             + "tr { page-break-inside: avoid; }"
             + "tr:last-child { page-break-before: avoid; }"
             + "ul, ol { page-break-inside: avoid; }"
             + "li { page-break-inside: avoid; }"
             + "blockquote { page-break-inside: avoid; }"
             + "</style>"
             + "</head><body>"
             + preprocessForPdf(bodyHtml, leftAlignHeadings)
             + "</body></html>";
    }

    /**
     * Preprocess HTML body for iText PDF rendering.
     * iText's {@code Div} layout object does not support text-align at all — not via
     * inline styles, HTML align attribute, or CSS class rules. Only {@code Paragraph}
     * (mapped from {@code <p>}) and heading elements handle text-align correctly.
     * Convert centered {@code <div>} to {@code <p>} so iText renders the alignment.
     *
     * <p>Letters AND instruments (trusts/wills/contracts) skip the court-caption centering
     * pass — neither has a court caption to center, AND instruments may legitimately contain
     * mid-document tables (notary callout boxes, fee schedules) that would otherwise be
     * mistaken for a caption boundary, accidentally centering every paragraph above them.
     * Only court filings (motions, briefs, complaints) need the caption-area treatment.
     */
    private String preprocessForPdf(String html, boolean skipCaptionCentering) {
        if (skipCaptionCentering) return html;

        // CKEditor strips ALL alignment styles from both <div> and <p> elements.
        // Re-add centering based on document structure:
        // 1. Everything before <figure> = caption header (court name, case number) → center
        // 2. First <p> after </figure> containing <strong><u> = document title → center
        int captionEnd = html.indexOf("<figure>");
        if (captionEnd == -1) captionEnd = html.indexOf("<table");
        if (captionEnd > 0) {
            String captionArea = html.substring(0, captionEnd);
            String rest = html.substring(captionEnd);

            // Center all block elements in caption area (could be <p> or <div>)
            captionArea = captionArea
                    .replace("<p>", "<p style=\"text-align:center; line-height:1.3; margin:0 0 4px 0;\">")
                    .replace("<div>", "<p style=\"text-align:center; line-height:1.3; margin:0 0 4px 0;\">")
                    .replace("</div>", "</p>");

            html = captionArea + rest;
        }

        // Document title: <p><strong><u>TITLE</u></strong></p> right after </figure>
        html = html.replace(
                "<p><strong><u>",
                "<p style=\"text-align:center; margin:20px 0 16px 0;\"><strong><u>"
        );

        return html;
    }

    /**
     * Preprocess HTML to prevent page-break orphans on headings.
     * Wraps each heading + its first following SMALL block (p/ul/ol/blockquote) in a
     * keep-together div. iText html2pdf reliably respects page-break-inside:avoid on
     * container divs for small elements, whereas page-break-after:avoid on individual
     * heading elements is only a weak hint. Also injects inline page-break-after:avoid
     * on each heading for redundancy.
     *
     * Tables/figures are intentionally excluded from the wrapper — see HEADING_BLOCK_PAIR
     * comment for why rigid wrappers around potentially-oversized blocks cause regressions.
     */
    // Intentionally EXCLUDES table/figure/div: wrapping a heading with a potentially-oversized block
    // in page-break-inside:avoid causes iText to strand the heading on its own page whenever the
    // inner block cannot fit (the wrapper fails, iText falls back to breaking between children, and
    // the heading ends up alone). For heading→table cases we rely instead on the inline
    // page-break-after:avoid injected by Step 2 below, plus tr{page-break-inside:avoid} in the CSS,
    // which together keep the heading with the first row while allowing large tables to flow.
    private static final java.util.regex.Pattern HEADING_BLOCK_PAIR = java.util.regex.Pattern.compile(
        "(<h[1-6][^>]*>.*?</h[1-6]>)(\\s*)(<(p|ul|ol|blockquote)[^>]*>.*?</\\4>)",
        java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.DOTALL
    );
    private static final java.util.regex.Pattern HEADING_WITH_STYLE = java.util.regex.Pattern.compile(
        "(<h[1-6]\\b[^>]*?)style=\"([^\"]*?)\"", java.util.regex.Pattern.CASE_INSENSITIVE
    );
    private static final java.util.regex.Pattern HEADING_WITHOUT_STYLE = java.util.regex.Pattern.compile(
        "<(h[1-6])\\b(?![^>]*style=)([^>]*)>", java.util.regex.Pattern.CASE_INSENSITIVE
    );

    private String wrapSectionsForPageBreaks(String html) {
        if (html == null || html.isBlank()) return html;

        // Step 1: Wrap each heading + first following SMALL block in a keep-together div.
        // See HEADING_BLOCK_PAIR for why table/figure/div are excluded here — those rely on
        // Step 2's inline page-break-after:avoid plus CSS tr{page-break-inside:avoid} instead.
        html = HEADING_BLOCK_PAIR.matcher(html).replaceAll(
            "<div style=\"page-break-inside:avoid;\">$1$2$3</div>"
        );

        // Step 2: Inject inline page-break-after:avoid on headings (iText respects inline styles more reliably).
        // Headings WITH an existing style attribute — append to it (skip if already present)
        html = HEADING_WITH_STYLE.matcher(html).replaceAll(m -> {
            if (m.group(2).contains("page-break-after")) return m.group(0); // already has it
            return m.group(1) + "style=\"" + m.group(2) + ";page-break-after:avoid\"";
        });
        // Headings WITHOUT a style attribute — add one
        html = HEADING_WITHOUT_STYLE.matcher(html).replaceAll(
            "<$1 style=\"page-break-after:avoid\"$2>"
        );

        return html;
    }

    private byte[] generateMarkdownPdf(String content, String title) {
        return generateMarkdownPdf(content, title, resolveWatermarkText(null));
    }

    /**
     * Fallback: Generate PDF from markdown/plain-text content using the manual iText pipeline.
     */
    private byte[] generateMarkdownPdf(String content, String title, String watermarkText) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc, PageSize.LETTER);
            document.setMargins(72, 72, 72, 72);

            PdfFont titleFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont headerFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont normalFont = PdfFontFactory.createFont(StandardFonts.HELVETICA);

            addPageNumberHandler(pdfDoc);

            // §6.1 gating — stamp every page when the caller flagged it as unapproved.
            if (watermarkText != null) {
                addDraftWatermarkHandler(pdfDoc, watermarkText);
            }

            Paragraph titleParagraph = new Paragraph(title)
                    .setFont(titleFont)
                    .setFontSize(13)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMultipliedLeading(1.15f)
                    .setMarginBottom(6);
            document.add(titleParagraph);

            SolidLine titleLine = new SolidLine(0.5f);
            titleLine.setColor(new DeviceRgb(180, 180, 180));
            LineSeparator titleRule = new LineSeparator(titleLine);
            titleRule.setMarginBottom(10);
            document.add(titleRule);

            convertMarkdownToPdf(content, document, headerFont, normalFont, true);

            document.close();

            log.info("Successfully generated markdown PDF ({} bytes)", baos.size());
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("Error generating markdown PDF", e);
            throw new RuntimeException("Failed to generate PDF document", e);
        }
    }

    /**
     * Convert Markdown or HTML content to PDF paragraphs
     * Handles headers, lists, tables, bold/italic formatting, and links
     * Automatically detects HTML content and converts it appropriately
     */
    private void convertMarkdownToPdf(String content, Document document, PdfFont headerFont, PdfFont normalFont, boolean skipFirstH1) throws IOException {
        if (content == null || content.isEmpty()) {
            return;
        }

        // Detect if content is HTML (contains common HTML tags)
        boolean isHtml = content.contains("<p") || content.contains("<div") ||
                         content.contains("<strong") || content.contains("<span") ||
                         content.contains("<br") || content.contains("<a ");

        String processedContent = content;
        if (isHtml) {
            log.info("PDF Export: Detected HTML content, converting to plain text");
            log.info("PDF Export: Content contains <table>: {}", content.contains("<table"));
            processedContent = convertHtmlToPlainText(content);
            log.info("PDF Export: After HTML conversion, contains pipe: {}", processedContent.contains("|"));
            // Log first 500 chars of processed content for debugging
            log.info("PDF Export: Processed content preview: {}",
                processedContent.substring(0, Math.min(500, processedContent.length())));
        }

        // Pre-process: remove blank lines between table rows to consolidate tables
        processedContent = consolidateTableRows(processedContent);

        String[] lines = processedContent.split("\n");
        List<String> tableRows = new ArrayList<>();
        boolean inTable = false;
        boolean isFirstH1 = true;

        // Detect H1 title text to skip duplicate headers
        String h1TitleText = null;
        for (String l : lines) {
            String t = l.trim();
            if (t.startsWith("# ") && !t.startsWith("## ")) {
                h1TitleText = processInlineFormatting(t.substring(2).trim());
                break;
            }
        }

        for (int lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            String line = lines[lineIndex];
            String trimmed = line.trim();

            // Check if this is a table row (contains | and has multiple columns)
            boolean isTableRow = trimmed.contains("|") && (trimmed.split("\\|").length >= 2);
            boolean isSeparatorRow = trimmed.matches("^\\|?[\\s\\-:|]+\\|?$") && trimmed.contains("-");

            if (isTableRow && !isSeparatorRow) {
                if (!inTable) {
                    inTable = true;
                    tableRows.clear();
                }
                tableRows.add(trimmed);
                continue;
            } else if (isSeparatorRow && inTable) {
                // Skip separator row (---|---|---)
                continue;
            } else if (inTable && tableRows.size() > 0) {
                // End of table - render it
                renderPdfTable(document, tableRows, headerFont, normalFont);
                tableRows.clear();
                inTable = false;
            }

            if (trimmed.isEmpty()) {
                document.add(new Paragraph("").setMarginBottom(6).setFontSize(6));
                continue;
            }

            // Check for headers (# H1, ## H2, ### H3)
            if (trimmed.startsWith("#")) {
                int level = 0;
                while (level < trimmed.length() && trimmed.charAt(level) == '#') {
                    level++;
                }

                String headerText = processInlineFormatting(trimmed.substring(level).trim());

                // Skip duplicate: if an H2/H3 text matches the H1 title, skip it
                if (level >= 2 && h1TitleText != null && headerText.equalsIgnoreCase(h1TitleText)) {
                    continue;
                }

                float fontSize;
                float marginTop;
                float marginBottom;

                if (level == 1 && isFirstH1) {
                    isFirstH1 = false;
                    // Skip the first H1 entirely if title was already injected
                    if (skipFirstH1) {
                        continue;
                    }
                    // First H1 = document title: 13pt centered, no top margin
                    fontSize = 13;
                    marginTop = 0;
                    marginBottom = 10;
                } else if (level == 1) {
                    fontSize = 14;
                    marginTop = 20;
                    marginBottom = 8;
                } else if (level == 2) {
                    fontSize = 13;
                    marginTop = 14;
                    marginBottom = 6;
                } else {
                    fontSize = 12;
                    marginTop = 8;
                    marginBottom = 4;
                }

                Paragraph para = new Paragraph(headerText)
                        .setFont(headerFont)
                        .setFontSize(fontSize)
                        .setMultipliedLeading(1.3f)
                        .setMarginTop(marginTop)
                        .setMarginBottom(marginBottom)
                        .setKeepTogether(true)
                        .setKeepWithNext(level >= 3);

                document.add(para);
                continue;
            }

            // Check for numbered lists (1. Item)
            if (trimmed.matches("^\\d+\\.\\s+.+")) {
                String itemText = trimmed.replaceFirst("^\\d+\\.\\s+", "");
                Paragraph para = new Paragraph(processInlineFormatting(itemText))
                        .setFont(normalFont)
                        .setFontSize(12)
                        .setMultipliedLeading(1.4f)
                        .setMarginLeft(20)
                        .setMarginBottom(3);
                document.add(para);
                continue;
            }

            // Check for bullet lists (- Item or * Item) - but not if it looks like a table separator
            if ((trimmed.startsWith("- ") || trimmed.startsWith("* ")) && !trimmed.contains("|")) {
                String itemText = trimmed.substring(2).trim();
                Paragraph para = new Paragraph("\u2022 " + processInlineFormatting(itemText))
                        .setFont(normalFont)
                        .setFontSize(12)
                        .setMultipliedLeading(1.4f)
                        .setMarginLeft(20)
                        .setMarginBottom(3);
                document.add(para);
                continue;
            }

            // Regular paragraph with bold formatting and link processing
            addFormattedParagraph(document, trimmed, normalFont);
        }

        // Handle table at end of document
        if (inTable && tableRows.size() > 0) {
            renderPdfTable(document, tableRows, headerFont, normalFont);
        }
    }

    /**
     * Render a markdown table as a PDF table
     */
    private void renderPdfTable(Document document, List<String> rows, PdfFont headerFont, PdfFont normalFont) throws IOException {
        if (rows.isEmpty()) return;

        // Parse first row to determine column count
        String[] headerCells = parseTableRow(rows.get(0));
        int columnCount = headerCells.length;

        if (columnCount == 0) return;

        // Create table with equal column widths
        Table table = new Table(UnitValue.createPercentArray(columnCount)).useAllAvailableWidth();
        table.setMarginTop(10);
        table.setMarginBottom(10);

        // Add header row — dark background matching CKEditor preview
        for (String cell : headerCells) {
            Cell headerCell = new Cell()
                    .add(new Paragraph(processInlineFormatting(cell.trim()).toUpperCase())
                            .setFont(headerFont)
                            .setFontSize(11)
                            .setFontColor(new DeviceRgb(255, 255, 255)))
                    .setBackgroundColor(new DeviceRgb(45, 45, 45))
                    .setPadding(5);
            table.addHeaderCell(headerCell);
        }

        // Add data rows
        for (int i = 1; i < rows.size(); i++) {
            String[] cells = parseTableRow(rows.get(i));
            for (int j = 0; j < columnCount; j++) {
                String cellText = j < cells.length ? cells[j].trim() : "";
                Cell dataCell = new Cell()
                        .add(new Paragraph(processInlineFormatting(cellText))
                                .setFont(normalFont)
                                .setFontSize(11))
                        .setPadding(5);
                table.addCell(dataCell);
            }
        }

        document.add(table);
    }

    /**
     * Parse a markdown table row into cells
     */
    private String[] parseTableRow(String row) {
        // Remove leading/trailing pipes and split by pipe
        String cleaned = row.trim();
        if (cleaned.startsWith("|")) cleaned = cleaned.substring(1);
        if (cleaned.endsWith("|")) cleaned = cleaned.substring(0, cleaned.length() - 1);
        return cleaned.split("\\|");
    }

    /**
     * Add a formatted paragraph with bold text and proper link handling
     */
    private void addFormattedParagraph(Document document, String text, PdfFont normalFont) throws IOException {
        // Only strip markdown links, NOT bold formatting (we need ** markers for bold rendering)
        text = text.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");

        Paragraph para = new Paragraph()
                .setFont(normalFont)
                .setFontSize(12)
                .setMultipliedLeading(1.4f)
                .setMarginBottom(6)
                .setTextAlignment(TextAlignment.JUSTIFIED);

        // Process bold formatting (**text**)
        String[] parts = text.split("\\*\\*");
        for (int i = 0; i < parts.length; i++) {
            if (i % 2 == 0) {
                // Normal text
                if (!parts[i].isEmpty()) {
                    para.add(new Text(parts[i]).setFont(normalFont));
                }
            } else {
                // Bold text
                try {
                    PdfFont boldFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
                    para.add(new Text(parts[i]).setFont(boldFont));
                } catch (IOException e) {
                    para.add(new Text(parts[i]).setFont(normalFont));
                }
            }
        }

        document.add(para);
    }

    /**
     * Add metadata footer to PDF
     */
    private void addPdfMetadataFooter(Document document, Map<String, Object> docData, PdfFont font) throws IOException {
        LocalDateTime generatedAt = docData.get("generatedAt") != null
                ? (LocalDateTime) docData.get("generatedAt")
                : LocalDateTime.now();

        String footerText = String.format(
                "Generated: %s | Version: %s | Words: %s | Generated by Legience",
                generatedAt.format(DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")),
                docData.get("version"),
                docData.get("wordCount")
        );

        Paragraph footer = new Paragraph(footerText)
                .setFont(font)
                .setFontSize(8)
                .setMarginTop(30)
                .setTextAlignment(TextAlignment.CENTER);

        document.add(footer);
    }

    /**
     * Add centered page numbers at the bottom of every page
     */
    private void addPageNumberHandler(PdfDocument pdfDoc) {
        pdfDoc.addEventHandler(PdfDocumentEvent.END_PAGE, new IEventHandler() {
            @Override
            public void handleEvent(Event event) {
                PdfDocumentEvent docEvent = (PdfDocumentEvent) event;
                PdfPage page = docEvent.getPage();
                int pageNumber = docEvent.getDocument().getPageNumber(page);
                Rectangle pageSize = page.getPageSize();

                try {
                    PdfFont font = PdfFontFactory.createFont(StandardFonts.HELVETICA);
                    PdfCanvas canvas = new PdfCanvas(page);
                    String pageText = String.valueOf(pageNumber);
                    float textWidth = font.getWidth(pageText, 10);

                    // Subtle gray page number, centered at bottom
                    canvas.setFillColor(new DeviceRgb(150, 150, 150))
                            .beginText()
                            .setFontAndSize(font, 10)
                            .moveText((pageSize.getWidth() - textWidth) / 2, 32)
                            .showText(pageText)
                            .endText();
                    canvas.release();
                } catch (IOException e) {
                    log.error("Error adding page number", e);
                }
            }
        });
    }

    /**
     * §6.1 gating — resolve the watermark text that should appear on exported pages
     * for a given approval status. Returns null for statuses that should render clean.
     *
     * <p>Mirrors the in-app tiled SVG stamp on the CKEditor surface so what-you-see is
     * what-you-export: DRAFT (slate) for unreviewed states, IN REVIEW (amber) while an
     * attorney is looking at it, and no stamp once approved.
     */
    private String resolveWatermarkText(String approvalStatus) {
        if ("attorney_reviewed".equalsIgnoreCase(approvalStatus)) {
            return null; // clean paper once approved
        }
        if ("in_review".equalsIgnoreCase(approvalStatus)) {
            return "IN REVIEW";
        }
        return "DRAFT"; // draft, changes_requested, null, legacy — all watermark
    }

    /**
     * §6.1 gating — attach an iText page-event handler that stamps a rotated, faded
     * watermark diagonally across every page. Colors pair with the in-app CSS:
     * slate-600 (#475569) for DRAFT, amber-700 (#b45309) for IN REVIEW.
     *
     * <p>We intentionally use the body page-canvas (not the header/footer) so the stamp
     * sits behind text at roughly 10% opacity — still readable but unmistakable.
     */
    private void addDraftWatermarkHandler(PdfDocument pdfDoc, String watermarkText) {
        final DeviceRgb color = "IN REVIEW".equals(watermarkText)
                ? new DeviceRgb(180, 83, 9)    // amber-700 — draws eye to "under active review"
                : new DeviceRgb(71, 85, 105);  // slate-600 — calm, legal-professional DRAFT
        pdfDoc.addEventHandler(PdfDocumentEvent.END_PAGE, new IEventHandler() {
            @Override
            public void handleEvent(Event event) {
                PdfDocumentEvent docEvent = (PdfDocumentEvent) event;
                PdfPage page = docEvent.getPage();
                Rectangle pageSize = page.getPageSize();
                try {
                    PdfFont font = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
                    PdfCanvas canvas = new PdfCanvas(page);

                    float fontSize = 128f;
                    float textWidth = font.getWidth(watermarkText, fontSize);
                    float cx = pageSize.getWidth() / 2f;
                    float cy = pageSize.getHeight() / 2f;
                    double angle = Math.toRadians(-30);
                    float cos = (float) Math.cos(angle);
                    float sin = (float) Math.sin(angle);

                    PdfExtGState gState = new PdfExtGState().setFillOpacity(0.10f);
                    canvas.saveState()
                            .setExtGState(gState)
                            .setFillColor(color)
                            .beginText()
                            .setFontAndSize(font, fontSize)
                            .setTextMatrix(
                                    cos, sin, -sin, cos,
                                    cx - (textWidth / 2f) * cos + (fontSize / 3f) * sin,
                                    cy - (textWidth / 2f) * sin - (fontSize / 3f) * cos
                            )
                            .showText(watermarkText)
                            .endText()
                            .restoreState();
                    canvas.release();
                } catch (IOException e) {
                    log.error("Error adding watermark to PDF page", e);
                }
            }
        });
    }

    /**
     * §6.1 gating — DOCX companion to {@link #addDraftWatermarkHandler}.
     * Injects a VML text-path watermark shape into the default section header so Microsoft
     * Word renders a true diagonal stamp at the center of every page (identical mechanism
     * Word's own Design → Watermark uses). Falls back to a simple faded header paragraph
     * if the VML injection fails for any reason — never let watermarking break an export.
     */
    private void addDocxWatermark(XWPFDocument document, String watermarkText) {
        if (watermarkText == null || watermarkText.isBlank()) return;
        String fillHex = "IN REVIEW".equals(watermarkText) ? "B45309" : "475569";
        try {
            org.apache.poi.xwpf.usermodel.XWPFHeader header = document.createHeader(
                    org.apache.poi.wp.usermodel.HeaderFooterType.DEFAULT);
            // Ensure a paragraph exists to hang the pict on.
            org.apache.poi.xwpf.usermodel.XWPFParagraph para = header.getParagraphArray(0);
            if (para == null) {
                para = header.createParagraph();
            }

            String pictXml = ""
                + "<w:r xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
                +     "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
                +     "xmlns:o=\"urn:schemas-microsoft-com:office:office\">"
                +   "<w:rPr><w:noProof/></w:rPr>"
                +   "<w:pict>"
                +     "<v:shapetype id=\"_x0000_t136\" coordsize=\"21600,21600\" o:spt=\"136\" adj=\"10800\" "
                +                    "path=\"m@7,l@8,m@5,21600l@6,21600e\">"
                +       "<v:formulas>"
                +         "<v:f eqn=\"sum #0 0 10800\"/><v:f eqn=\"prod #0 2 1\"/>"
                +         "<v:f eqn=\"sum 21600 0 @1\"/><v:f eqn=\"sum 0 0 @2\"/>"
                +         "<v:f eqn=\"sum 21600 0 @3\"/><v:f eqn=\"if @0 @3 0\"/>"
                +         "<v:f eqn=\"if @0 21600 @1\"/><v:f eqn=\"if @0 0 @2\"/>"
                +         "<v:f eqn=\"if @0 @4 21600\"/><v:f eqn=\"mid @5 @6\"/>"
                +         "<v:f eqn=\"mid @8 @5\"/><v:f eqn=\"mid @7 @8\"/>"
                +         "<v:f eqn=\"mid @6 @7\"/><v:f eqn=\"sum @6 0 @5\"/>"
                +       "</v:formulas>"
                +       "<v:path o:extrusionok=\"f\" gradientshapeok=\"t\" o:connecttype=\"custom\" "
                +              "o:connectlocs=\"@9,0;@10,10800;@11,21600;@12,10800\" "
                +              "o:connectangles=\"270,180,90,0\" textpathok=\"t\"/>"
                +       "<v:textpath on=\"t\" fitshape=\"t\"/>"
                +     "</v:shapetype>"
                +     "<v:shape id=\"LegienceDraftWatermark\" type=\"#_x0000_t136\" "
                +            "style=\"position:absolute;margin-left:0;margin-top:0;"
                +                    "width:468pt;height:234pt;z-index:-251658240;"
                +                    "mso-position-horizontal:center;mso-position-horizontal-relative:margin;"
                +                    "mso-position-vertical:center;mso-position-vertical-relative:margin;"
                +                    "rotation:-30\" "
                +            "fillcolor=\"#" + fillHex + "\" stroked=\"f\">"
                +       "<v:fill opacity=\".14\"/>"
                +       "<v:textpath style=\"font-family:&amp;quot;Georgia&amp;quot;;font-weight:bold;"
                +                         "font-style:italic;v-text-kern:t\" "
                +                   "string=\"" + watermarkText + "\"/>"
                +     "</v:shape>"
                +   "</w:pict>"
                + "</w:r>";

            org.apache.xmlbeans.XmlObject xml = org.apache.xmlbeans.XmlObject.Factory.parse(pictXml);
            para.getCTP().set(
                    org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP.Factory.parse(
                            para.getCTP().xmlText().replace("</w:p>",
                                    xml.xmlText() + "</w:p>")));
        } catch (Exception e) {
            // Fallback: ensure we still mark the doc even if VML parsing fails.
            log.warn("VML watermark injection failed, falling back to faded header text", e);
            try {
                org.apache.poi.xwpf.usermodel.XWPFHeader header = document.createHeader(
                        org.apache.poi.wp.usermodel.HeaderFooterType.DEFAULT);
                org.apache.poi.xwpf.usermodel.XWPFParagraph para = header.getParagraphArray(0);
                if (para == null) para = header.createParagraph();
                para.setAlignment(ParagraphAlignment.CENTER);
                XWPFRun run = para.createRun();
                run.setText(watermarkText);
                run.setBold(true);
                run.setItalic(true);
                run.setFontSize(48);
                run.setColor("IN REVIEW".equals(watermarkText) ? "FDE68A" : "CBD5E1");
                run.setFontFamily("Georgia");
            } catch (Exception inner) {
                log.error("DOCX watermark fallback also failed", inner);
            }
        }
    }

    /**
     * Draw footer text at the absolute bottom of the last page using PdfCanvas.
     * iText's HtmlConverter doesn't support CSS positioning, so we post-process
     * the PDF to place the footer precisely — above the page number, below the body.
     */
    private byte[] addFooterToLastPage(byte[] pdfBytes, String footerText) {
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(pdfBytes);
            ByteArrayOutputStream result = new ByteArrayOutputStream();
            PdfReader reader = new PdfReader(bais);
            PdfWriter writer = new PdfWriter(result);
            PdfDocument pdfDoc = new PdfDocument(reader, writer);

            PdfPage lastPage = pdfDoc.getPage(pdfDoc.getNumberOfPages());
            Rectangle pageSize = lastPage.getPageSize();

            PdfFont font = PdfFontFactory.createFont(StandardFonts.TIMES_ROMAN);
            PdfCanvas canvas = new PdfCanvas(lastPage);

            // Draw separator line (matching body left/right padding: x=64 to x=pageWidth-64)
            float lineY = 62;
            canvas.setStrokeColor(new DeviceRgb(200, 200, 200))
                  .setLineWidth(0.5f)
                  .moveTo(64, lineY)
                  .lineTo(pageSize.getWidth() - 64, lineY)
                  .stroke();

            // Draw footer text centered at y=48, font: Times Roman 8pt, color: #555555
            float fontSize = 8;
            float textWidth = font.getWidth(footerText, fontSize);
            float textX = (pageSize.getWidth() - textWidth) / 2;
            // Clamp to left margin if footer text is very wide
            if (textX < 64) textX = 64;

            canvas.setFillColor(new DeviceRgb(0x55, 0x55, 0x55))
                  .beginText()
                  .setFontAndSize(font, fontSize)
                  .moveText(textX, 48)
                  .showText(footerText)
                  .endText();

            canvas.release();
            pdfDoc.close();

            log.info("Added footer to last page of PDF");
            return result.toByteArray();

        } catch (Exception e) {
            log.error("Error adding footer to last page, returning PDF without footer", e);
            return pdfBytes;
        }
    }

    // ========================================
    // DIFF-BASED TRANSFORMATION METHODS
    // Token-efficient transformations that return find/replace pairs
    // instead of regenerating entire documents (80-90% token savings)
    // ========================================

    /**
     * Determine if diff mode should be used for this transformation
     * Only SIMPLIFY and CONDENSE are eligible for diff mode
     * Only documents > 500 chars benefit from diff mode (smaller docs don't save much)
     */
    public boolean shouldUseDiffMode(String transformationType, String content) {
        if (transformationType == null || content == null) {
            return false;
        }

        boolean isEligibleType = DIFF_ELIGIBLE_TRANSFORMATIONS.contains(transformationType.toUpperCase());
        boolean isLargeEnough = content.length() >= MIN_CONTENT_LENGTH_FOR_DIFF_MODE;

        log.info("📊 Diff mode check: type={}, eligible={}, contentLength={}, largeEnough={}",
                transformationType, isEligibleType, content.length(), isLargeEnough);

        return isEligibleType && isLargeEnough;
    }

    /**
     * Build prompt for diff-based transformation
     * Instructs AI to return JSON array of find/replace pairs instead of full document
     */
    private String buildDiffTransformationPrompt(String transformationType, String content) {
        String instruction = switch (transformationType.toUpperCase()) {
            case "SIMPLIFY" -> """
                Analyze this legal document and identify phrases/sentences that can be simplified.
                For each change, provide the EXACT original text and its simplified replacement.
                Focus on:
                - Complex legal jargon that can be replaced with clearer terms
                - Long, convoluted sentences that can be made more direct
                - Redundant phrases that can be shortened

                IMPORTANT: Preserve legal accuracy. Only simplify language, not meaning.
                """;
            case "CONDENSE" -> """
                Analyze this legal document and identify sections that can be condensed.
                For each change, provide the EXACT original text and its condensed replacement.
                Focus on:
                - Redundant or repetitive statements
                - Overly verbose explanations that can be shortened
                - Phrases that can be combined or eliminated

                IMPORTANT: Preserve all legal meaning and key points. Remove only filler, not substance.
                """;
            default -> "Analyze and improve this document.";
        };

        return String.format("""
            You are a legal document editor. %s

            DOCUMENT TO TRANSFORM:
            ```
            %s
            ```

            RESPONSE FORMAT:
            Return ONLY a valid JSON object with a "changes" array. No markdown, no explanations, just JSON.
            Each change must have:
            - "find": The EXACT text from the document (copy-paste precision required)
            - "replace": The improved text

            Example response format:
            {"changes":[{"find":"pursuant to the aforementioned provisions","replace":"under these provisions"},{"find":"It is important to note that","replace":"Note:"}]}

            CRITICAL RULES:
            1. The "find" text MUST appear EXACTLY in the document (case-sensitive, whitespace-sensitive)
            2. Keep changes surgical - don't rewrite entire paragraphs, just the phrases that need improvement
            3. Aim for 5-15 targeted changes for typical documents
            4. If no changes are needed, return: {"changes":[]}
            5. Do NOT include any text before or after the JSON

            Return your JSON response now:
            """, instruction, content);
    }

    /**
     * Parse the AI response containing JSON diff array
     * Handles various response formats and extracts the changes array
     */
    public List<DocumentChange> parseDiffResponse(String aiResponse) {
        if (aiResponse == null || aiResponse.trim().isEmpty()) {
            log.warn("⚠️ Empty AI response for diff parsing");
            return Collections.emptyList();
        }

        try {
            // Try to extract JSON from the response (AI might include markdown or extra text)
            String jsonStr = extractJsonFromResponse(aiResponse);
            if (jsonStr == null) {
                log.warn("⚠️ Could not extract JSON from AI response");
                return Collections.emptyList();
            }

            JsonNode root = objectMapper.readTree(jsonStr);
            JsonNode changesNode = root.get("changes");

            if (changesNode == null || !changesNode.isArray()) {
                log.warn("⚠️ No 'changes' array found in response");
                return Collections.emptyList();
            }

            List<DocumentChange> changes = new ArrayList<>();
            for (JsonNode changeNode : changesNode) {
                String find = changeNode.has("find") ? changeNode.get("find").asText() : null;
                String replace = changeNode.has("replace") ? changeNode.get("replace").asText() : null;

                if (find != null && !find.isEmpty() && replace != null) {
                    changes.add(DocumentChange.builder()
                            .find(find)
                            .replace(replace)
                            .build());
                }
            }

            log.info("✅ Parsed {} changes from AI response", changes.size());
            return changes;

        } catch (Exception e) {
            log.error("❌ Failed to parse diff response: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Extract JSON object from AI response that might contain markdown or extra text
     */
    private String extractJsonFromResponse(String response) {
        // Try direct parsing first
        String trimmed = response.trim();
        if (trimmed.startsWith("{")) {
            // Find the matching closing brace
            int depth = 0;
            int endIndex = -1;
            for (int i = 0; i < trimmed.length(); i++) {
                char c = trimmed.charAt(i);
                if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
            if (endIndex > 0) {
                return trimmed.substring(0, endIndex);
            }
        }

        // Try to find JSON in markdown code blocks
        Pattern codeBlockPattern = Pattern.compile("```(?:json)?\\s*\\n?([\\s\\S]*?)\\n?```");
        Matcher matcher = codeBlockPattern.matcher(response);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        // Try to find bare JSON object
        Pattern jsonPattern = Pattern.compile("\\{[\\s\\S]*\"changes\"[\\s\\S]*\\}");
        matcher = jsonPattern.matcher(response);
        if (matcher.find()) {
            return matcher.group();
        }

        // Last resort: find first { and try brace matching from there
        int firstBrace = response.indexOf('{');
        if (firstBrace >= 0) {
            String fromBrace = response.substring(firstBrace);
            int depth = 0;
            int endIndex = -1;
            for (int i = 0; i < fromBrace.length(); i++) {
                char c = fromBrace.charAt(i);
                if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) { endIndex = i + 1; break; }
                }
            }
            if (endIndex > 0) return fromBrace.substring(0, endIndex);
        }

        return null;
    }

    /**
     * Check if the AI response contains a valid JSON diff structure (even if changes array is empty).
     * Returns true for {"changes":[]} (valid, no changes needed).
     * Returns false if JSON parsing fails completely.
     */
    private boolean isValidDiffJson(String aiResponse) {
        try {
            String jsonStr = extractJsonFromResponse(aiResponse);
            if (jsonStr == null) return false;
            JsonNode root = objectMapper.readTree(jsonStr);
            return root.has("changes") && root.get("changes").isArray();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Apply diff changes to original content
     * Returns the transformed content with all changes applied
     */
    public String applyDiffsToContent(String originalContent, List<DocumentChange> changes) {
        if (changes == null || changes.isEmpty()) {
            return originalContent;
        }

        String result = originalContent;
        int successfulChanges = 0;
        int failedChanges = 0;

        for (DocumentChange change : changes) {
            if (change.getFind() == null || change.getReplace() == null) {
                continue;
            }

            // Check if the find text exists in the content
            if (result.contains(change.getFind())) {
                result = result.replace(change.getFind(), change.getReplace());
                successfulChanges++;
                log.debug("✅ Applied change: '{}...' -> '{}...'",
                        truncate(change.getFind(), 30),
                        truncate(change.getReplace(), 30));
            } else {
                failedChanges++;
                log.warn("⚠️ Could not find text to replace: '{}'", truncate(change.getFind(), 50));
            }
        }

        log.info("📊 Diff application complete: {} successful, {} failed", successfulChanges, failedChanges);
        return result;
    }

    /**
     * Truncate string for logging
     */
    private String truncate(String str, int maxLength) {
        if (str == null) return "";
        if (str.length() <= maxLength) return str;
        return str.substring(0, maxLength) + "...";
    }

    /**
     * Transform document using diff mode (returns changes array instead of full content)
     * Called by controller when diff mode is appropriate
     */
    @Transactional
    public Map<String, Object> transformFullDocumentDiffMode(
            Long documentId,
            Long userId,
            String transformationType,
            String currentContent
    ) {
        log.info("🔄 Transforming document {} using DIFF MODE (type={})", documentId, transformationType);

        // Verify document ownership
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Build diff-based prompt
        String prompt = buildDiffTransformationPrompt(transformationType, currentContent);

        // Check for cancellation
        if (document.getSessionId() != null && cancellationService.isCancelled(document.getSessionId())) {
            log.warn("🛑 Diff transformation cancelled for document {}", documentId);
            cancellationService.clearCancellation(document.getSessionId());
            throw new IllegalStateException("Transformation cancelled by user");
        }

        // Call Claude API
        String aiResponse;
        if (USE_MOCK_MODE) {
            aiResponse = generateMockDiffResponse(transformationType);
        } else {
            com.bostoneo.bostoneosolutions.enumeration.AIOperationType opType = isSimpleTransformation(transformationType)
                    ? com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_SIMPLE
                    : com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_COMPLEX;
            CompletableFuture<String> aiRequest = aiRequestRouter.routeSimple(
                    opType, prompt, null, false, document.getSessionId());
            try {
                aiResponse = aiRequest.join();
            } catch (Exception e) {
                log.error("AI call failed for diff transformation: {}", e.getMessage());
                throw e;
            }
        }

        // Parse the diff response
        List<DocumentChange> changes = parseDiffResponse(aiResponse);

        // Apply diffs to get the transformed content (for version storage)
        String transformedContent = applyDiffsToContent(currentContent, changes);

        // Calculate metrics
        int tokensUsed = estimateTokens(aiResponse); // Much smaller than full document
        BigDecimal cost = calculateCost(tokensUsed);
        int wordCount = countWords(transformedContent);

        // Create new version
        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
                .document(document)
                .organizationId(document.getOrganizationId())
                .versionNumber(newVersionNumber)
                .content(transformedContent)
                .wordCount(wordCount)
                .transformationType(transformationType)
                .transformationScope("FULL_DOCUMENT")
                .createdByUser(false)
                .tokensUsed(tokensUsed)
                .costEstimate(cost)
                .build();

        newVersion = versionRepository.save(newVersion);

        // Update document's current version
        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        log.info("✅ Diff mode transformation complete: {} changes, {} tokens (vs ~{} full mode estimate)",
                changes.size(), tokensUsed, estimateTokens(currentContent));

        // Return result with changes array for frontend to apply
        Map<String, Object> result = new HashMap<>();
        result.put("documentId", documentId);
        result.put("newVersion", newVersionNumber);
        result.put("transformedContent", transformedContent);
        result.put("changes", changes);
        result.put("useDiffMode", true);
        result.put("tokensUsed", tokensUsed);
        result.put("costEstimate", cost);
        result.put("wordCount", wordCount);
        result.put("transformationType", transformationType);
        result.put("transformationScope", "FULL_DOCUMENT");

        return result;
    }

    /**
     * Generate mock diff response for testing
     */
    private String generateMockDiffResponse(String transformationType) {
        return """
            {"changes":[
                {"find":"pursuant to","replace":"under"},
                {"find":"aforementioned","replace":"above-mentioned"},
                {"find":"heretofore","replace":"previously"},
                {"find":"It is important to note that","replace":"Note:"}
            ]}
            """;
    }

    // ========================================
    // CUSTOM DIFF MODE FOR CHAT TRANSFORMATIONS
    // Extends diff mode to user's natural language requests
    // ========================================

    // Keywords that indicate structural changes requiring full document replacement
    private static final Set<String> STRUCTURAL_CHANGE_KEYWORDS = Set.of(
        "add section", "add paragraph", "add a new", "insert section", "insert paragraph",
        "restructure", "reorganize", "reorder", "rearrange",
        "move section", "move paragraph", "relocate",
        "merge", "split", "combine", "separate",
        "completely rewrite", "start over", "rewrite from scratch",
        "create new", "draft new", "write new",
        "delete section", "remove section", "remove paragraph"
    );

    // Minimum content length for custom diff mode to be beneficial
    private static final int MIN_CONTENT_LENGTH_FOR_CUSTOM_DIFF = 1500;

    /**
     * Determine if a custom transformation request should use diff mode
     * Returns true if:
     * 1. Document is large enough (>1500 chars)
     * 2. Request doesn't contain structural change keywords
     */
    public boolean shouldUseCustomDiffMode(String userPrompt, String content) {
        if (userPrompt == null || content == null) {
            return false;
        }

        // Check document size
        boolean isLargeEnough = content.length() >= MIN_CONTENT_LENGTH_FOR_CUSTOM_DIFF;
        if (!isLargeEnough) {
            log.info("📊 Custom diff mode: document too small ({} chars), using full mode", content.length());
            return false;
        }

        // Check for structural change keywords
        String promptLower = userPrompt.toLowerCase();
        for (String keyword : STRUCTURAL_CHANGE_KEYWORDS) {
            if (promptLower.contains(keyword)) {
                log.info("📊 Custom diff mode: detected structural keyword '{}', using full mode", keyword);
                return false;
            }
        }

        log.info("📊 Custom diff mode: eligible - large document ({} chars), no structural keywords", content.length());
        return true;
    }

    /**
     * Build prompt for diff-based custom transformation
     * Instructs AI to return JSON array of find/replace pairs for user's natural language request
     */
    private String buildCustomDiffTransformationPrompt(String userPrompt, String documentContent) {
        return String.format("""
            You are an expert legal document editor. The user has requested specific changes to their document.

            USER'S REQUEST:
            %s

            CURRENT DOCUMENT:
            ```
            %s
            ```

            IMPORTANT: Because this is a large document, you must respond with ONLY a JSON object containing find/replace pairs.
            Do NOT return the full document. Only return the specific changes.

            RESPONSE FORMAT:
            Return ONLY a valid JSON object with a "changes" array. No markdown, no explanations, just JSON.
            Each change must have:
            - "find": The EXACT text from the document that needs to change (copy-paste precision required)
            - "replace": The new text to replace it with

            Example response format:
            {"changes":[{"find":"[INSERT COURT NAME]","replace":"Suffolk County Superior Court"},{"find":"[CLIENT NAME]","replace":"John M. Richardson"}]}

            CRITICAL RULES:
            1. The "find" text MUST appear EXACTLY in the document (case-sensitive, whitespace-sensitive)
            2. Find ALL occurrences in the document that match the user's request
            3. If the user asks to change placeholders like [COURT NAME], find the exact placeholder text
            4. If the user asks to fix dates, find each date that needs changing
            5. Include enough context in "find" to make each match unique
            6. If no changes are needed or you cannot determine specific replacements, return: {"changes":[]}
            7. Do NOT include any text before or after the JSON
            8. Do NOT replace placeholders with longer instructions or explanations. If a placeholder cannot be filled with real data, do NOT include it in the changes array.
            9. Each "replace" value must be actual content, not meta-instructions like "[ATTORNEY TO INSERT: describe what goes here]"

            Return your JSON response now:
            """, userPrompt, documentContent);
    }

    /**
     * Transform document using diff mode for custom user requests
     * Called when user makes a natural language transformation request via chat
     */
    @Transactional
    public Map<String, Object> transformFullDocumentCustomDiffMode(
            Long documentId,
            Long userId,
            String customPrompt,
            String currentContent
    ) {
        log.info("🔄 Transforming document {} using CUSTOM DIFF MODE", documentId);
        log.info("📝 User prompt: {}", customPrompt.substring(0, Math.min(100, customPrompt.length())) + "...");

        // Verify document ownership
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Build diff-based prompt for custom transformation
        String prompt = buildCustomDiffTransformationPrompt(customPrompt, currentContent);

        // Check for cancellation
        if (document.getSessionId() != null && cancellationService.isCancelled(document.getSessionId())) {
            log.warn("🛑 Custom diff transformation cancelled for document {}", documentId);
            cancellationService.clearCancellation(document.getSessionId());
            throw new IllegalStateException("Transformation cancelled by user");
        }

        // Call Claude API
        String aiResponse;
        if (USE_MOCK_MODE) {
            aiResponse = generateMockCustomDiffResponse(customPrompt);
        } else {
            CompletableFuture<String> aiRequest = aiRequestRouter.routeSimple(
                    com.bostoneo.bostoneosolutions.enumeration.AIOperationType.TRANSFORMATION_COMPLEX,
                    prompt, null, false, document.getSessionId());
            try {
                aiResponse = aiRequest.join();
            } catch (Exception e) {
                log.error("AI call failed for custom diff transformation: {}", e.getMessage());
                throw e;
            }
        }

        // Parse the diff response
        List<DocumentChange> changes = parseDiffResponse(aiResponse);

        // If no changes found, distinguish "AI found nothing to change" from "JSON parsing failed"
        if (changes.isEmpty()) {
            if (isValidDiffJson(aiResponse)) {
                // AI understood the request but found nothing to change — return success, no fallback
                log.info("✅ Custom diff mode: AI found no changes needed");
                Map<String, Object> result = new HashMap<>();
                result.put("fallbackRequired", false);
                result.put("noChangesNeeded", true);
                result.put("useDiffMode", true);
                result.put("transformedContent", currentContent);
                result.put("changes", Collections.emptyList());
                result.put("newVersion", document.getCurrentVersion());
                result.put("tokensUsed", estimateTokens(aiResponse));
                result.put("costEstimate", calculateCost(estimateTokens(aiResponse)));
                result.put("wordCount", countWords(currentContent));
                return result;
            } else {
                // JSON parsing failed — flag for full-document fallback
                log.warn("⚠️ Custom diff mode: JSON parsing failed, flagging for fallback");
                Map<String, Object> result = new HashMap<>();
                result.put("useDiffMode", false);
                result.put("fallbackRequired", true);
                result.put("reason", "No valid changes extracted from AI response");
                return result;
            }
        }

        // Apply diffs to get the transformed content
        String transformedContent = applyDiffsToContent(currentContent, changes);

        // Calculate metrics
        int tokensUsed = estimateTokens(aiResponse);
        BigDecimal cost = calculateCost(tokensUsed);
        int wordCount = countWords(transformedContent);

        // Create new version
        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
                .document(document)
                .organizationId(document.getOrganizationId())
                .versionNumber(newVersionNumber)
                .content(transformedContent)
                .wordCount(wordCount)
                .transformationType("CUSTOM")
                .transformationScope("FULL_DOCUMENT")
                .createdByUser(false)
                .tokensUsed(tokensUsed)
                .costEstimate(cost)
                .build();

        newVersion = versionRepository.save(newVersion);

        // Update document's current version
        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        log.info("✅ Custom diff mode transformation complete: {} changes, {} tokens (vs ~{} full mode estimate)",
                changes.size(), tokensUsed, estimateTokens(currentContent));

        // Return result with changes array for frontend to apply
        Map<String, Object> result = new HashMap<>();
        result.put("documentId", documentId);
        result.put("newVersion", newVersionNumber);
        result.put("transformedContent", transformedContent);
        result.put("changes", changes);
        result.put("useDiffMode", true);
        result.put("fallbackRequired", false);
        result.put("tokensUsed", tokensUsed);
        result.put("costEstimate", cost);
        result.put("wordCount", wordCount);
        result.put("transformationType", "CUSTOM");
        result.put("transformationScope", "FULL_DOCUMENT");

        return result;
    }

    /**
     * Enhance a rough user prompt into a detailed, structured legal document prompt.
     * Stateless — no DB writes. Just calls Claude with a prompt-engineering system message.
     */
    public String enhancePrompt(String roughPrompt, String documentType, String jurisdiction, Long caseId) {
        getRequiredOrganizationId(); // tenant guard

        String systemMessage = buildPromptEnhancerSystemMessage(documentType, jurisdiction, caseId);
        String userMessage = "Transform this rough idea into a detailed, structured prompt for generating a legal document:\n\n" + roughPrompt;

        CompletableFuture<String> result = aiRequestRouter.routeSimple(
                com.bostoneo.bostoneosolutions.enumeration.AIOperationType.QUESTION_ANSWERING,
                userMessage, systemMessage, false, null);
        return result.join();
    }

    /**
     * Build system message for the prompt enhancer.
     * Instructs Claude to refine a rough idea into a structured prompt — NOT to generate the document itself.
     */
    private String buildPromptEnhancerSystemMessage(String documentType, String jurisdiction, Long caseId) {
        StringBuilder sb = new StringBuilder();

        sb.append("You are an expert legal document specialist helping attorneys structure their document generation requests.\n\n");

        sb.append("YOUR TASK: Transform the attorney's rough idea into a detailed, well-structured prompt that will produce a high-quality legal document. ");
        sb.append("You are NOT generating the document itself — you are crafting the perfect instruction for another AI to generate it.\n\n");

        // If case data is available, inject it and tell AI to use real values
        String caseData = null;
        if (caseId != null) {
            try {
                caseData = buildFullCaseData(caseId);
            } catch (Exception e) {
                log.debug("Could not fetch case data for prompt enhancement: {}", e.getMessage());
            }
        }

        if (caseData != null && !caseData.isEmpty()) {
            sb.append("OUTPUT RULES:\n");
            sb.append("- Output ONLY the enhanced prompt text, no preamble or explanation\n");
            sb.append("- Use REAL VALUES from the case data below — actual names, dates, insurance companies, claim numbers\n");
            sb.append("- Do NOT use generic [PLACEHOLDER] for values that exist in the case data\n");
            sb.append("- Keep under 400 words\n");
            sb.append("- Be specific and actionable\n");
            sb.append("- Include relevant legal elements specific to the document type\n");
            sb.append("- Structure the prompt so it reads as a clear instruction\n\n");
            sb.append(caseData).append("\n");
        } else {
            sb.append("OUTPUT RULES:\n");
            sb.append("- Output ONLY the enhanced prompt text, no preamble or explanation\n");
            sb.append("- Use [PLACEHOLDER] format for names, dates, amounts, and case-specific details (e.g., [Client Name], [Opposing Party], [Date of Incident])\n");
            sb.append("- Keep under 400 words\n");
            sb.append("- Be specific and actionable\n");
            sb.append("- Include relevant legal elements specific to the document type\n");
            sb.append("- Structure the prompt so it reads as a clear instruction\n\n");
        }

        if (jurisdiction != null && !jurisdiction.isEmpty()) {
            sb.append("JURISDICTION: ").append(jurisdiction).append("\n");
            sb.append("Include jurisdiction-specific considerations where relevant.\n\n");
        }

        if (documentType != null && !documentType.isEmpty()) {
            sb.append("DOCUMENT TYPE: ").append(documentType).append("\n");
            sb.append(getDocumentTypeHints(documentType, jurisdiction));
            sb.append("\n");
        }

        return sb.toString();
    }

    private String getDocumentTypeHints(String documentType, String jurisdiction) {
        return templateRegistry.getHints(documentType, jurisdiction);
    }

    /**
     * Generate mock custom diff response for testing
     */
    private String generateMockCustomDiffResponse(String userPrompt) {
        // Generate mock based on common placeholder patterns
        return """
            {"changes":[
                {"find":"[INSERT COURT NAME]","replace":"Suffolk County Superior Court"},
                {"find":"[CLIENT NAME]","replace":"John M. Richardson"},
                {"find":"[COUNTY]","replace":"Suffolk County"},
                {"find":"[Case Number]","replace":"2024-CV-1234"},
                {"find":"[ATTORNEY NAME]","replace":"Sarah J. Thompson, Esq."}
            ]}
            """;
    }

    /**
     * Update stationery association on a document.
     * Pass null for both IDs to clear stationery.
     */
    @Transactional
    public void updateDocumentStationery(Long documentId, Long userId, Long stationeryTemplateId, Long stationeryAttorneyId) {
        Long orgId = getRequiredOrganizationId();
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, orgId)
                .orElseThrow(() -> new RuntimeException("Document not found or access denied"));
        document.setStationeryTemplateId(stationeryTemplateId);
        document.setStationeryAttorneyId(stationeryAttorneyId);
        documentRepository.save(document);
    }
}
