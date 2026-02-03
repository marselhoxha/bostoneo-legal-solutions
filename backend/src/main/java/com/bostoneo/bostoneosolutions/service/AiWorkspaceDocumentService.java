package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.DocumentChange;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationResponse;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocument;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentVersion;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.repository.AiConversationSessionRepository;
import com.bostoneo.bostoneosolutions.repository.AiWorkspaceDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.AiWorkspaceDocumentVersionRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;

// iText PDF imports
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

@Service
@RequiredArgsConstructor
@Slf4j
public class AiWorkspaceDocumentService {

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
    private final AiConversationSessionRepository conversationRepository;
    private final LegalCaseRepository caseRepository;
    private final ClaudeSonnet4Service claudeService;
    private final LegalResearchConversationService conversationService;
    private final GenerationCancellationService cancellationService;
    private final AILegalResearchService legalResearchService;  // For citation verification
    private final CitationUrlInjector citationUrlInjector;       // For URL injection
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

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
            prompt = buildCustomTransformationPrompt(customPrompt, currentContent);
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
            // Pass sessionId for proper cancellation support
            CompletableFuture<String> aiRequest = claudeService.generateCompletion(prompt, null, false, document.getSessionId());

            try {
                transformedContent = aiRequest.join();
            } catch (Exception e) {
                throw e;
            }
        }

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
        Integer selectionEndIndex
    ) {
        log.info("Transforming selection in document id={}, type={}, selection={}...{}",
            documentId, transformationType, selectionStartIndex, selectionEndIndex);

        // Verify document ownership
        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Build transformation prompt for selection with full document context
        String prompt = buildTransformationPrompt(transformationType, selectedText, "selection", fullDocumentContent);

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
            // Pass sessionId for proper cancellation support
            CompletableFuture<String> aiRequest = claudeService.generateCompletion(prompt, null, false, document.getSessionId());

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
     * Save manual edit as new version with optional note
     */
    @Transactional
    public AiWorkspaceDocumentVersion saveManualEdit(
        Long documentId,
        Long userId,
        String newContent,
        String versionNote
    ) {
        log.info("Saving manual edit for document id={} with note: {}", documentId, versionNote);

        AiWorkspaceDocument document = documentRepository.findByIdAndUserIdAndOrganizationId(documentId, userId, getRequiredOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

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

        document.setCurrentVersion(newVersionNumber);
        document.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(document);

        return newVersion;
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
            if ("demand_letter".equals(doc.getDocumentType())) {
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
        // For selection transformations, provide full document context
        if ("selection".equals(scope) && fullDocumentContent != null && !fullDocumentContent.isEmpty()) {
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
    private String buildCustomTransformationPrompt(String userPrompt, String documentContent) {
        return String.format(
            """
            You are an expert legal document editor. The user has requested specific changes to their document.

            USER'S REQUEST:
            %s

            CURRENT DOCUMENT:
            %s

            INSTRUCTIONS:
            1. Apply the user's requested changes to the document
            2. Maintain the document's legal formatting and structure
            3. Preserve section numbering and references
            4. Keep consistent legal terminology and tone
            5. Return the COMPLETE modified document (not just the changed sections)
            6. Do not add explanations or commentary - return only the revised document content

            Please provide the complete revised document:
            """,
            userPrompt, documentContent
        );
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
        String researchMode
    ) {
        log.info("Generating draft with conversation: userId={}, caseId={}, type={}, conversationId={}, researchMode={}",
                 userId, caseId, documentType, conversationId, researchMode);

        // 1. Fetch case context if caseId provided - SECURITY: Use tenant-filtered query
        Long orgId = getRequiredOrganizationId();
        String caseContext = "";
        LegalCase legalCase = null;
        if (caseId != null) {
            legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId).orElse(null);
            if (legalCase != null) {
                caseContext = buildCaseContext(legalCase);
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

        // 4. Build AI prompt with case context
        String fullPrompt = buildDraftPromptWithCaseContext(prompt, documentType, jurisdiction, caseContext, legalCase, researchMode);

        // 5. Check if generation has been cancelled
        if (cancellationService.isCancelled(conversation.getId())) {
            log.warn("🛑 Generation cancelled for conversation {} before AI call", conversation.getId());
            cancellationService.clearCancellation(conversation.getId());
            throw new IllegalStateException("Generation cancelled by user");
        }

        // 6. Generate document content using Claude with cancellation support
        CompletableFuture<String> aiRequest = claudeService.generateCompletion(fullPrompt, null, false, conversation.getId());

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

                    // Step 2: Inject URLs for statutory/rule citations (FRCP, M.G.L., CFR, etc.)
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
        Long docOrgId = getRequiredOrganizationId();
        AiWorkspaceDocument document = AiWorkspaceDocument.builder()
            .userId(userId)
            .organizationId(docOrgId)  // SECURITY: Set organization ID for tenant isolation
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

        // 10. Update conversation with relatedDraftId
        conversation.setRelatedDraftId(document.getId().toString());
        conversationRepository.save(conversation);

        // 11. Add AI response message
        String aiResponse = "I've generated your " + documentType +
            (caseId != null && legalCase != null ? " for Case #" + legalCase.getCaseNumber() : "") +
            ". You can view it in the document preview panel.";
        conversationService.addMessage(conversation.getId(), userId, "assistant", aiResponse, null);

        // 11. Build response
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
                result.put("content", latestVersion.getContent());
                result.put("wordCount", latestVersion.getWordCount());
                result.put("version", latestVersion.getVersionNumber());
                result.put("tokensUsed", latestVersion.getTokensUsed());
                result.put("costEstimate", latestVersion.getCostEstimate());
                result.put("generatedAt", latestVersion.getCreatedAt());
                return result;
            });
    }

    /**
     * Build case context string for AI prompt
     */
    private String buildCaseContext(LegalCase legalCase) {
        return String.format("""

            CASE CONTEXT:
            Case Number: %s
            Case Title: %s
            Case Type: %s
            Court: %s
            Status: %s
            Client: %s
            Filing Date: %s

            Case Description:
            %s
            """,
            legalCase.getCaseNumber(),
            legalCase.getTitle(),
            legalCase.getType(),
            legalCase.getCountyName(),
            legalCase.getStatus(),
            legalCase.getClientName(),
            legalCase.getFilingDate(),
            legalCase.getDescription()
        );
    }

    /**
     * Determine citation level based on document type
     */
    private CitationLevel getCitationLevel(String documentType) {
        if (documentType == null) {
            return CitationLevel.COMPREHENSIVE; // Default to comprehensive if not specified
        }

        String type = documentType.toLowerCase();

        // NO CITATIONS: Contracts and transactional documents
        if (type.contains("contract") ||
            type.contains("nda") ||
            type.contains("amendment") ||
            type.contains("clause") && !type.contains("legal") ||
            type.contains("employment") && type.contains("agreement") ||
            type.contains("purchase") && type.contains("agreement") ||
            type.contains("service") && type.contains("agreement")) {
            return CitationLevel.NONE;
        }

        // MINIMAL CITATIONS: Correspondence, discovery, business documents
        if (type.contains("letter") ||
            type.contains("demand") ||
            type.contains("email") ||
            type.contains("correspondence") ||
            type.contains("settlement-offer") ||
            type.contains("opinion-letter") ||
            type.contains("opposing-counsel") ||
            type.contains("client-email") ||
            type.contains("interrogator") ||
            type.contains("rfp") ||
            type.contains("rfa") ||
            type.contains("request") && type.contains("production") ||
            type.contains("request") && type.contains("admission") ||
            type.contains("subpoena") ||
            type.contains("deposition") && type.contains("notice") ||
            type.contains("notice") ||
            type.contains("stipulation") ||
            type.contains("affidavit") ||
            type.contains("settlement-agreement")) {
            return CitationLevel.MINIMAL;
        }

        // COMPREHENSIVE CITATIONS: Legal arguments, motions, briefs, pleadings, memos
        // This includes: complaint, answer, counterclaim, motion-*, appellate-*, legal-memo, legal-argument
        return CitationLevel.COMPREHENSIVE;
    }

    /**
     * Build draft prompt with case context
     */
    private String buildDraftPromptWithCaseContext(
        String userPrompt,
        String documentType,
        String jurisdiction,
        String caseContext,
        LegalCase legalCase,
        String researchMode
    ) {
        StringBuilder prompt = new StringBuilder();

        // CRITICAL CONTEXT: Establish attorney-client relationship
        prompt.append("**ATTORNEY-CLIENT CONTEXT**:\n");
        prompt.append("You are assisting a licensed attorney who is representing a client.\n");
        prompt.append("This is a law firm document management system.\n");
        prompt.append("The attorney is already retained and representing the client in this matter.\n");
        prompt.append("All documents MUST be drafted from the attorney's perspective representing the client.\n");
        prompt.append("DO NOT draft as if the client is representing themselves (pro se).\n\n");

        prompt.append("Generate a professional legal ").append(documentType).append(" document.\n\n");

        // Indicate research mode for token allocation and citation behavior
        if ("THOROUGH".equalsIgnoreCase(researchMode)) {
            prompt.append("**RESEARCH MODE**: THOROUGH - Include verified citations from case law databases\n");
            prompt.append("**TOOL USAGE**: Use citation verification tools to validate all legal citations\n\n");
        }

        prompt.append("JURISDICTION: ").append(jurisdiction).append("\n\n");

        if (caseContext != null && !caseContext.isEmpty()) {
            prompt.append(caseContext).append("\n");
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

        // DETERMINE CITATION POLICY based on document type
        CitationLevel citationLevel = getCitationLevel(documentType);
        log.info("📋 Document type '{}' has citation level: {}", documentType, citationLevel);

        // CONDITIONAL CITATION POLICY based on research mode AND document type
        if ("THOROUGH".equalsIgnoreCase(researchMode)) {
            switch (citationLevel) {
                case NONE:
                    // NO CITATIONS: Contracts and transactional documents
                    prompt.append("\n**📋 CITATION POLICY - NONE (Transactional/Contract Document)**:\n");
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
                    prompt.append("✗ DO NOT cite any case law\n");
                    prompt.append("✗ DO NOT cite any statutes\n");
                    prompt.append("✗ DO NOT include legal precedents\n");
                    prompt.append("✓ Use standard contract language and business terms\n\n");
                    break;

                case MINIMAL:
                    // MINIMAL CITATIONS: Demand letters, correspondence, discovery
                    prompt.append("\n**📋 CITATION POLICY - MINIMAL (Business/Demand Document)**:\n");
                    prompt.append("This is a business/demand document, NOT a legal brief or motion.\n");
                    prompt.append("Insurance adjusters and business parties care about FACTS and DAMAGES, not case law.\n\n");

                    prompt.append("**FOCUS YOUR WRITING ON**:\n");
                    prompt.append("- Specific factual allegations (what happened, when, where, how)\n");
                    prompt.append("- Documented damages (medical bills, lost wages, repair costs)\n");
                    prompt.append("- Settlement value and business pressure\n");
                    prompt.append("- Clear liability narrative (defendant's fault)\n\n");

                    prompt.append("**CITATION RULES - STRICT**:\n");
                    prompt.append("✗ DO NOT cite case law precedents (no 'See Smith v. Jones, 123 Mass. 456')\n");
                    prompt.append("✗ DO NOT cite court decisions or judicial opinions\n");
                    prompt.append("✓ You MAY cite 1-2 directly applicable STATUTES if essential (e.g., 'G.L. c. 231, § 6')\n");
                    prompt.append("✓ You MAY reference general legal standards WITHOUT case names (e.g., 'Under Massachusetts law, rear-end collisions create a presumption of negligence')\n\n");

                    prompt.append("**EXAMPLE - CORRECT APPROACH** (No case citations):\n");
                    prompt.append("'Under Massachusetts law, a rear-end collision creates a presumption of negligence on the part of the following driver. ");
                    prompt.append("Your insured failed to maintain a safe distance and proper control, directly causing this collision and our client's injuries.'\n\n");

                    prompt.append("**EXAMPLE - INCORRECT APPROACH** (Avoid this):\n");
                    prompt.append("'Under Massachusetts law, a rear-end collision creates a rebuttable presumption of negligence. See Haddad v. Burns, 59 Mass. App. Ct. 582 (2003); ");
                    prompt.append("Meuse v. Fox, 39 Mass. App. Ct. (1995). The operator has a duty... See G.L. c. 89, § 7A; Mass. Model Civil Jury Instruction 5.10.'\n\n");

                    prompt.append("Remember: This is about BUSINESS and SETTLEMENT, not legal scholarship. Keep it focused and persuasive.\n\n");
                    break;

                case COMPREHENSIVE:
                    // COMPREHENSIVE CITATIONS: Motions, briefs, pleadings, memos
                    prompt.append("\n✓ CITATION VERIFICATION ENABLED (THOROUGH MODE - Legal Brief/Motion):\n");
                    prompt.append("You may include verified case citations and legal precedents to support your arguments.\n");
                    prompt.append("All citations will be automatically verified via CourtListener and legal databases.\n");
                    prompt.append("Generate complete lists and detailed legal analysis with proper citations.\n");
                    prompt.append("You have permission to cite controlling case law, statutes, and regulations.\n\n");
                    break;
            }
        } else {
            // FAST mode: Keep strict anti-fabrication policy
            prompt.append("\n⚠️ CRITICAL CITATION POLICY - PREVENT MALPRACTICE:\n");
            prompt.append("DO NOT include specific case citations, statute numbers, or regulatory citations.\n");
            prompt.append("Fabricated citations can result in court sanctions and attorney malpractice.\n\n");
            prompt.append("CITATION RULES:\n");
            prompt.append("✓ ALLOWED:\n");
            prompt.append("  - General legal principles: 'Under Massachusetts law...' or 'Federal courts have held...'\n");
            prompt.append("  - Descriptive placeholders: [CITE: Massachusetts personal jurisdiction standard]\n");
            prompt.append("  - Generic references: 'Courts apply a three-part test [CITATION NEEDED: specific standard]'\n");
            prompt.append("  - Legal concepts: 'The purposeful availment doctrine requires...'\n\n");
            prompt.append("✗ PROHIBITED:\n");
            prompt.append("  - Specific case names: 'Copy Cop, Inc. v. Task Printing, Inc., 325 F. Supp. 2d 242'\n");
            prompt.append("  - Statute numbers: '28 U.S.C. § 1331'\n");
            prompt.append("  - Regulatory citations: '8 C.F.R. § 1003.38'\n");
            prompt.append("  - ANY citation that could be fabricated or hallucinated\n\n");
            prompt.append("EXAMPLES:\n");
            prompt.append("✓ CORRECT: 'To establish personal jurisdiction, Massachusetts courts apply a three-part test [CITE: personal jurisdiction standard]. The plaintiff must demonstrate...'\n");
            prompt.append("✗ INCORRECT: 'To establish personal jurisdiction, see Copy Cop, Inc., 325 F. Supp. 2d at 247.'\n\n");
            prompt.append("REMINDER: All citations must be added manually by attorney after verification with legal research tools.\n");
        }

        prompt.append("\nFORMATTING REQUIREMENTS:\n");
        prompt.append("- Use Markdown formatting for structure and emphasis\n");
        prompt.append("- Use # for main title, ## for sections, ### for subsections\n");
        prompt.append("- Use **bold** for important terms and emphasis\n");
        prompt.append("- Use numbered lists (1. 2. 3.) for sequential items\n");
        prompt.append("- Use bullet lists (- ) for non-sequential items\n");
        prompt.append("- Use proper paragraph breaks for readability\n");

        // MANDATORY RULE: COMPLETE ALL LISTS WITH PLACEHOLDERS
        prompt.append("\n**⚠️ MANDATORY RULE - COMPLETE ALL LISTS WITH PLACEHOLDERS**:\n");
        prompt.append("When you write 'as follows:', 'including:', 'specifically:', 'demonstrates:', 'such as:', etc., ");
        prompt.append("you MUST complete the list immediately after.\n");
        prompt.append("This is the #1 most common error. You MUST follow this rule strictly.\n\n");

        prompt.append("**IF YOU HAVE SPECIFIC FACTS** → Use them:\n");
        prompt.append("✓ CORRECT:\n");
        prompt.append("'The evidence demonstrates:\n");
        prompt.append("1. Dashcam footage showing defendant ran red light at 45mph\n");
        prompt.append("2. Police report #12345 confirming defendant's fault\n");
        prompt.append("3. Witness testimony from [Witness Name] corroborating collision sequence'\n\n");

        prompt.append("**IF YOU DON'T HAVE SPECIFIC FACTS** → Use structured placeholders:\n");
        prompt.append("✓ CORRECT:\n");
        prompt.append("'The evidence demonstrates:\n");
        prompt.append("1. [ATTORNEY TO INSERT: specific evidence from case file]\n");
        prompt.append("2. [ATTORNEY TO INSERT: supporting documentation]\n");
        prompt.append("3. [ATTORNEY TO INSERT: witness testimony or expert reports]'\n\n");

        prompt.append("**PLACEHOLDER FORMATS BY CONTEXT**:\n");
        prompt.append("- Dollar amounts: $[Amount] or [Dollar Amount]\n");
        prompt.append("- Dates: [Date] or [MM/DD/YYYY]\n");
        prompt.append("- Names: [Defendant Name], [Witness Name], [Doctor Name]\n");
        prompt.append("- Evidence: [ATTORNEY TO INSERT: specific evidence]\n");
        prompt.append("- Medical: [ATTORNEY TO INSERT: medical records and bills]\n");
        prompt.append("- Tables: Use [Amount], [Date], [Description] in table cells\n\n");

        prompt.append("**❌ ABSOLUTELY PROHIBITED - INCOMPLETE LISTS**:\n");
        prompt.append("✗ WRONG: 'The damages include:'\n");
        prompt.append("          [blank space or jumps to new topic]\n\n");
        prompt.append("✗ WRONG: 'Dashcam footage that conclusively documents:'\n");
        prompt.append("          [next paragraph starts without list items]\n\n");
        prompt.append("✗ WRONG: 'Total damages as follows:'\n");
        prompt.append("          [table with empty cells or missing rows]\n\n");

        prompt.append("**✓ ALWAYS ACCEPTABLE - COMPLETE WITH PLACEHOLDERS**:\n");
        prompt.append("✓ RIGHT: 'The damages include:\n");
        prompt.append("1. Medical expenses: $[Amount]\n");
        prompt.append("2. Lost wages: $[Amount]\n");
        prompt.append("3. Pain and suffering: $[Amount]'\n\n");

        prompt.append("✓ RIGHT: 'Total damages as follows:\n");
        prompt.append("| Category | Amount |\n");
        prompt.append("|----------|--------|\n");
        prompt.append("| Medical | $[Amount] |\n");
        prompt.append("| Lost Wages | $[Amount] |\n");
        prompt.append("| Pain & Suffering | $[Amount] |'\n\n");

        prompt.append("**ALTERNATIVE**: If you don't have facts, rephrase to avoid the colon:\n");
        prompt.append("✓ RIGHT: 'The dashcam footage provides conclusive evidence of defendant's liability.'\n");
        prompt.append("✓ RIGHT: 'Medical documentation supports the claimed injuries.'\n\n");

        // ATTORNEY REPRESENTATION REQUIREMENTS
        prompt.append("**ATTORNEY REPRESENTATION REQUIREMENTS - CRITICAL**:\n");
        prompt.append("All documents MUST be drafted from the attorney's perspective representing the client.\n");
        prompt.append("DO NOT draft as if the client is representing themselves (pro se).\n\n");

        prompt.append("MANDATORY REQUIREMENTS:\n");
        prompt.append("- Draft from attorney's perspective: 'This office represents...', 'On behalf of my client...'\n");
        prompt.append("- Signature blocks must show attorney information, NOT client as self-represented\n");
        prompt.append("- DO NOT include pro se disclaimers or suggestions to 'consider retaining an attorney'\n");
        prompt.append("- The attorney IS already retained - do not suggest hiring one\n");
        prompt.append("- DO NOT discuss contingency fees or attorney costs\n");
        prompt.append("- Use professional attorney-to-opposing-party tone\n\n");

        prompt.append("✓ CORRECT ATTORNEY REPRESENTATION:\n");
        prompt.append("  - 'This office represents Mr. Hoxha in connection with the collision on [date]'\n");
        prompt.append("  - 'On behalf of my client, I demand full compensation for all damages sustained'\n");
        prompt.append("  - 'Please contact the undersigned to discuss settlement'\n");
        prompt.append("  - Signature: 'Respectfully, [Attorney Name] / [Law Firm] / Attorney for Plaintiff Marsel Hoxha'\n\n");

        prompt.append("✗ PROHIBITED - NEVER INCLUDE:\n");
        prompt.append("  - 'This demand letter is drafted as a pro se document (claimant representing self)'\n");
        prompt.append("  - 'If the case becomes more complex, you should consider retaining an attorney'\n");
        prompt.append("  - 'Personal injury attorneys typically work on contingency (33-40% of recovery)'\n");
        prompt.append("  - Any suggestion that the claimant is self-represented\n");
        prompt.append("  - Signature showing client's name only without attorney representation\n");
        prompt.append("  - Disclaimers about attorney fees or suggesting to hire counsel\n\n");

        // FINAL CHECKLIST BEFORE GENERATION
        prompt.append("**📋 FINAL CHECKLIST BEFORE SUBMITTING YOUR RESPONSE**:\n");
        prompt.append("Before you submit, verify:\n");
        prompt.append("✓ Every 'as follows:', 'including:', 'specifically:', etc. is followed by list items or placeholders\n");
        prompt.append("✓ All tables have complete rows with placeholder values like $[Amount] for unknown numbers\n");
        prompt.append("✓ No blank spaces after colons - every list is complete\n");
        prompt.append("✓ Used [ATTORNEY TO INSERT: ...] format for case-specific details you don't have\n");
        prompt.append("✓ Document is drafted from attorney's perspective, not pro se\n");
        prompt.append("✓ All citations properly formatted (if in THOROUGH mode)\n\n");

        return prompt.toString();
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
        String content = (String) data.get("content");
        String documentType = (String) data.get("documentType");

        // Extract and sanitize title from content
        String filename = extractDocumentTitle(content, documentType);
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

        try {
            // Create Word document
            XWPFDocument document = new XWPFDocument();

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
     * Convert Markdown content to Word document paragraphs
     * Handles headers (#, ##, ###), bold (**text**), lists, and paragraphs
     */
    private void convertMarkdownToWord(String markdown, XWPFDocument document) {
        if (markdown == null || markdown.isEmpty()) {
            return;
        }

        String[] lines = markdown.split("\n");
        boolean inList = false;
        XWPFNumbering numbering = null;

        for (String line : lines) {
            String trimmed = line.trim();

            if (trimmed.isEmpty()) {
                // Skip empty lines
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

                inList = false;
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

                inList = true;
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

                inList = true;
                continue;
            }

            // Regular paragraph
            inList = false;
            XWPFParagraph para = document.createParagraph();
            para.setSpacingAfter(150);
            para.setAlignment(ParagraphAlignment.LEFT);

            // Process inline formatting (bold, italic)
            processInlineFormattingAdvanced(trimmed, para);
        }
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

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);

            // Create fonts
            PdfFont titleFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            PdfFont headerFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            PdfFont normalFont = PdfFontFactory.createFont(StandardFonts.TIMES_ROMAN);

            // Only add title if content doesn't already have a markdown title
            // This prevents user prompt from appearing in the document
            if (!contentHasMarkdownTitle(content)) {
                log.info("Content has no markdown title, adding document title: {}", title);
                Paragraph titleParagraph = new Paragraph(title)
                        .setFont(titleFont)
                        .setFontSize(18)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMarginBottom(20);
                document.add(titleParagraph);
            } else {
                log.info("Content has markdown title, skipping title injection");
            }

            // Convert Markdown content to PDF
            convertMarkdownToPdf(content, document, headerFont, normalFont);

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

    /**
     * Generate Word document from raw content (no document ID required)
     * Used for workflow drafts that haven't been saved to GeneratedDocuments table
     */
    public byte[] generateWordDocumentFromContent(String content, String title) {
        log.info("Generating Word document from content, title={}", title);

        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Content cannot be empty");
        }

        try {
            XWPFDocument document = new XWPFDocument();

            // Only add title if content doesn't already have a markdown title
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
     * Used for workflow drafts that haven't been saved to GeneratedDocuments table
     */
    public byte[] generatePdfDocumentFromContent(String content, String title) {
        log.info("Generating PDF document from content, title={}", title);

        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Content cannot be empty");
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);

            // Create fonts
            PdfFont titleFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            PdfFont headerFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            PdfFont normalFont = PdfFontFactory.createFont(StandardFonts.TIMES_ROMAN);

            // Only add title if content doesn't already have a markdown title
            if (!contentHasMarkdownTitle(content)) {
                log.info("Content has no markdown title, adding document title: {}", title);
                Paragraph titleParagraph = new Paragraph(title)
                        .setFont(titleFont)
                        .setFontSize(18)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMarginBottom(20);
                document.add(titleParagraph);
            } else {
                log.info("Content has markdown title, skipping title injection");
            }

            // Convert Markdown content to PDF
            convertMarkdownToPdf(content, document, headerFont, normalFont);

            document.close();

            log.info("Successfully generated PDF document from content ({} bytes)", baos.size());
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("Error generating PDF document from content", e);
            throw new RuntimeException("Failed to generate PDF document", e);
        }
    }

    /**
     * Convert Markdown or HTML content to PDF paragraphs
     * Handles headers, lists, tables, bold/italic formatting, and links
     * Automatically detects HTML content and converts it appropriately
     */
    private void convertMarkdownToPdf(String content, Document document, PdfFont headerFont, PdfFont normalFont) throws IOException {
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
                continue;
            }

            // Check for headers (# H1, ## H2, ### H3)
            if (trimmed.startsWith("#")) {
                int level = 0;
                while (level < trimmed.length() && trimmed.charAt(level) == '#') {
                    level++;
                }

                String headerText = processInlineFormatting(trimmed.substring(level).trim());
                float fontSize = level == 1 ? 16 : (level == 2 ? 14 : 12);

                Paragraph para = new Paragraph(headerText)
                        .setFont(headerFont)
                        .setFontSize(fontSize)
                        .setMarginTop(level == 1 ? 20 : 15)
                        .setMarginBottom(10)
                        .setKeepTogether(true);
                document.add(para);
                continue;
            }

            // Check for numbered lists (1. Item)
            if (trimmed.matches("^\\d+\\.\\s+.+")) {
                String itemText = trimmed.replaceFirst("^\\d+\\.\\s+", "");
                Paragraph para = new Paragraph(processInlineFormatting(itemText))
                        .setFont(normalFont)
                        .setFontSize(12)
                        .setMarginLeft(20)
                        .setMarginBottom(5);
                document.add(para);
                continue;
            }

            // Check for bullet lists (- Item or * Item) - but not if it looks like a table separator
            if ((trimmed.startsWith("- ") || trimmed.startsWith("* ")) && !trimmed.contains("|")) {
                String itemText = trimmed.substring(2).trim();
                Paragraph para = new Paragraph("• " + processInlineFormatting(itemText))
                        .setFont(normalFont)
                        .setFontSize(12)
                        .setMarginLeft(20)
                        .setMarginBottom(5);
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

        // Add header row
        for (String cell : headerCells) {
            Cell headerCell = new Cell()
                    .add(new Paragraph(processInlineFormatting(cell.trim()))
                            .setFont(headerFont)
                            .setFontSize(10))
                    .setBackgroundColor(new DeviceRgb(240, 240, 240))
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
                                .setFontSize(10))
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
                .setMarginBottom(10)
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
                    PdfFont boldFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
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

        return null;
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
            CompletableFuture<String> aiRequest = claudeService.generateCompletion(prompt, null, false, document.getSessionId());
            try {
                aiResponse = aiRequest.join();
            } catch (Exception e) {
                log.error("❌ AI call failed for diff transformation: {}", e.getMessage());
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
            6. If no changes are needed, return: {"changes":[]}
            7. Do NOT include any text before or after the JSON

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
            CompletableFuture<String> aiRequest = claudeService.generateCompletion(prompt, null, false, document.getSessionId());
            try {
                aiResponse = aiRequest.join();
            } catch (Exception e) {
                log.error("❌ AI call failed for custom diff transformation: {}", e.getMessage());
                throw e;
            }
        }

        // Parse the diff response
        List<DocumentChange> changes = parseDiffResponse(aiResponse);

        // If parsing failed or no changes found, return with fallback flag
        if (changes.isEmpty()) {
            log.warn("⚠️ Custom diff mode returned no changes, flagging for fallback");
            Map<String, Object> result = new HashMap<>();
            result.put("useDiffMode", false);
            result.put("fallbackRequired", true);
            result.put("reason", "No valid changes extracted from AI response");
            return result;
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
}
