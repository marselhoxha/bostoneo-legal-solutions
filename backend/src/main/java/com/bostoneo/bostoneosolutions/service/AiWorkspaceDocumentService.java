package com.bostoneo.bostoneosolutions.service;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;

// iText PDF imports
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.io.font.constants.StandardFonts;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiWorkspaceDocumentService {

    private final AiWorkspaceDocumentRepository documentRepository;
    private final AiWorkspaceDocumentVersionRepository versionRepository;
    private final AiConversationSessionRepository conversationRepository;
    private final LegalCaseRepository caseRepository;
    private final ClaudeSonnet4Service claudeService;
    private final LegalResearchConversationService conversationService;

    // MOCK MODE DISABLED - Using real API
    private static final boolean USE_MOCK_MODE = false;

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
        AiWorkspaceDocument document = AiWorkspaceDocument.builder()
            .userId(userId)
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
     */
    @Transactional
    public AiWorkspaceDocumentVersion transformFullDocument(
        Long documentId,
        Long userId,
        String transformationType,
        String currentContent
    ) {
        log.info("Transforming full document id={}, type={}", documentId, transformationType);

        // Verify document ownership
        AiWorkspaceDocument document = documentRepository.findByIdAndUserId(documentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Build transformation prompt
        String prompt = buildTransformationPrompt(transformationType, currentContent, null, null);

        // Call Claude API or use mock
        String transformedContent;
        if (USE_MOCK_MODE) {
            transformedContent = generateMockTransformation(transformationType, currentContent, "full");
            log.info("Using MOCK response for transformation (no API cost)");
        } else {
            transformedContent = claudeService.generateCompletion(prompt, false).join();
        }

        // Calculate tokens and cost (simplified - should use actual metrics)
        int tokensUsed = estimateTokens(transformedContent);
        BigDecimal cost = calculateCost(tokensUsed);

        // Create new version
        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
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
        AiWorkspaceDocument document = documentRepository.findByIdAndUserId(documentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        // Build transformation prompt for selection with full document context
        String prompt = buildTransformationPrompt(transformationType, selectedText, "selection", fullDocumentContent);

        // Call Claude API or use mock
        String transformedSelection;
        if (USE_MOCK_MODE) {
            transformedSelection = generateMockTransformation(transformationType, selectedText, "selection");
            log.info("Using MOCK response for selection transformation (no API cost)");
        } else {
            transformedSelection = claudeService.generateCompletion(prompt, false).join();
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

        AiWorkspaceDocument document = documentRepository.findByIdAndUserId(documentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion newVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
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
        documentRepository.findByIdAndUserId(documentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        return versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
    }

    /**
     * Get specific version
     */
    public Optional<AiWorkspaceDocumentVersion> getVersion(Long documentId, Long userId, Integer versionNumber) {
        // Verify ownership
        documentRepository.findByIdAndUserId(documentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        return versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber);
    }

    /**
     * Restore a previous version (creates new version with old content)
     */
    @Transactional
    public AiWorkspaceDocumentVersion restoreVersion(Long documentId, Long userId, Integer versionToRestore) {
        log.info("Restoring document id={} to version {}", documentId, versionToRestore);

        AiWorkspaceDocument document = documentRepository.findByIdAndUserId(documentId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        AiWorkspaceDocumentVersion oldVersion = versionRepository
            .findByDocumentIdAndVersionNumber(documentId, versionToRestore)
            .orElseThrow(() -> new IllegalArgumentException("Version not found"));

        int newVersionNumber = document.getCurrentVersion() + 1;
        AiWorkspaceDocumentVersion restoredVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
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
        return documentRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
    }

    /**
     * Get case documents
     */
    public List<AiWorkspaceDocument> getCaseDocuments(Long caseId, Long userId) {
        return documentRepository.findByCaseIdAndUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(caseId, userId);
    }

    /**
     * Soft delete document
     */
    @Transactional
    public void deleteDocument(Long documentId, Long userId) {
        AiWorkspaceDocument document = documentRepository.findByIdAndUserId(documentId, userId)
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
     * Generate draft with conversation - Complete flow
     */
    @Transactional
    public DraftGenerationResponse generateDraftWithConversation(
        Long userId,
        Long caseId,
        String prompt,
        String documentType,
        String jurisdiction,
        String sessionName
    ) {
        log.info("Generating draft with conversation: userId={}, caseId={}, type={}", userId, caseId, documentType);

        // 1. Fetch case context if caseId provided
        String caseContext = "";
        LegalCase legalCase = null;
        if (caseId != null) {
            legalCase = caseRepository.findById(caseId).orElse(null);
            if (legalCase != null) {
                caseContext = buildCaseContext(legalCase);
            }
        }

        // 2. Create conversation session
        AiConversationSession conversation = AiConversationSession.builder()
            .userId(userId)
            .caseId(caseId)
            .sessionName(sessionName)
            .sessionType(caseId != null ? "case-specific" : "general")
            .taskType("GENERATE_DRAFT")
            .researchMode("AUTO")
            .jurisdiction(jurisdiction)
            .isActive(true)
            .build();

        conversation = conversationRepository.save(conversation);

        // 3. Add user message
        conversationService.addMessage(conversation.getId(), userId, "user", prompt);

        // 4. Build AI prompt with case context
        String fullPrompt = buildDraftPromptWithCaseContext(prompt, documentType, jurisdiction, caseContext, legalCase);

        // 5. Generate document content using Claude
        String content = claudeService.generateCompletion(fullPrompt, false).join();

        // 6. Calculate metrics
        int tokensUsed = estimateTokens(content);
        BigDecimal cost = calculateCost(tokensUsed);
        int wordCount = countWords(content);

        // 7. Create document
        AiWorkspaceDocument document = AiWorkspaceDocument.builder()
            .userId(userId)
            .caseId(caseId)
            .sessionId(conversation.getId())
            .title(sessionName)
            .documentType(documentType)
            .jurisdiction(jurisdiction)
            .currentVersion(1)
            .status("DRAFT")
            .build();

        document = documentRepository.save(document);

        // 8. Create initial version
        AiWorkspaceDocumentVersion initialVersion = AiWorkspaceDocumentVersion.builder()
            .document(document)
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

        // 9. Update conversation with relatedDraftId
        conversation.setRelatedDraftId(document.getId().toString());
        conversationRepository.save(conversation);

        // 10. Add AI response message
        String aiResponse = "I've generated your " + documentType +
            (caseId != null && legalCase != null ? " for Case #" + legalCase.getCaseNumber() : "") +
            ". You can view it in the document preview panel.";
        conversationService.addMessage(conversation.getId(), userId, "assistant", aiResponse);

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
        return documentRepository.findByIdAndUserId(documentId, userId)
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
            legalCase.getCourtName(),
            legalCase.getStatus(),
            legalCase.getClientName(),
            legalCase.getFilingDate(),
            legalCase.getDescription()
        );
    }

    /**
     * Build draft prompt with case context
     */
    private String buildDraftPromptWithCaseContext(
        String userPrompt,
        String documentType,
        String jurisdiction,
        String caseContext,
        LegalCase legalCase
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Generate a professional legal ").append(documentType).append(" document.\n\n");
        prompt.append("JURISDICTION: ").append(jurisdiction).append("\n\n");

        if (caseContext != null && !caseContext.isEmpty()) {
            prompt.append(caseContext).append("\n");
        }

        prompt.append("USER REQUEST:\n");
        prompt.append(userPrompt).append("\n\n");

        prompt.append("INSTRUCTIONS:\n");
        prompt.append("1. Generate a complete, properly formatted legal document\n");
        prompt.append("2. Use the case information provided above\n");
        prompt.append("3. Include proper legal citations\n");
        prompt.append("4. Follow standard legal document structure\n");
        prompt.append("5. Make it court-ready and professional\n");

        if (legalCase != null) {
            prompt.append("6. Use EXACT case number: ").append(legalCase.getCaseNumber()).append("\n");
            prompt.append("7. Use EXACT client name: ").append(legalCase.getClientName()).append("\n");
            prompt.append("8. Address the specific issues in this case\n");
        }

        prompt.append("\nFORMATTING REQUIREMENTS:\n");
        prompt.append("- Use Markdown formatting for structure and emphasis\n");
        prompt.append("- Use # for main title, ## for sections, ### for subsections\n");
        prompt.append("- Use **bold** for important terms and emphasis\n");
        prompt.append("- Use numbered lists (1. 2. 3.) for sequential items\n");
        prompt.append("- Use bullet lists (- ) for non-sequential items\n");
        prompt.append("- Use proper paragraph breaks for readability\n");

        return prompt.toString();
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

            // Add title (centered, large, bold)
            XWPFParagraph titlePara = document.createParagraph();
            titlePara.setAlignment(ParagraphAlignment.CENTER);
            titlePara.setSpacingAfter(400);
            XWPFRun titleRun = titlePara.createRun();
            titleRun.setText(title);
            titleRun.setBold(true);
            titleRun.setFontSize(18);
            titleRun.setFontFamily("Georgia");

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
     * Process inline Markdown formatting (bold **text**, italic *text*)
     * Returns plain text with formatting stripped (simplified version)
     */
    private String processInlineFormatting(String text) {
        // Remove Markdown bold **
        text = text.replaceAll("\\*\\*(.+?)\\*\\*", "$1");
        // Remove Markdown italic *
        text = text.replaceAll("\\*(.+?)\\*", "$1");
        return text;
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
                "Generated: %s | Version: %s | Words: %s | Tokens: %s | Cost: $%s",
                generatedAt.format(DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")),
                docData.get("version"),
                docData.get("wordCount"),
                docData.get("tokensUsed"),
                docData.get("costEstimate")
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

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);

            // Create fonts
            PdfFont titleFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            PdfFont headerFont = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            PdfFont normalFont = PdfFontFactory.createFont(StandardFonts.TIMES_ROMAN);

            // Add centered title
            Paragraph titleParagraph = new Paragraph(title)
                    .setFont(titleFont)
                    .setFontSize(18)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(20);
            document.add(titleParagraph);

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
     * Convert Markdown content to PDF paragraphs
     */
    private void convertMarkdownToPdf(String markdown, Document document, PdfFont headerFont, PdfFont normalFont) throws IOException {
        if (markdown == null || markdown.isEmpty()) {
            return;
        }

        String[] lines = markdown.split("\n");

        for (String line : lines) {
            String trimmed = line.trim();

            if (trimmed.isEmpty()) {
                continue;
            }

            // Check for headers (# H1, ## H2, ### H3)
            if (trimmed.startsWith("#")) {
                int level = 0;
                while (level < trimmed.length() && trimmed.charAt(level) == '#') {
                    level++;
                }

                String headerText = trimmed.substring(level).trim();
                float fontSize = level == 1 ? 16 : (level == 2 ? 14 : 12);

                Paragraph para = new Paragraph(headerText)
                        .setFont(headerFont)
                        .setFontSize(fontSize)
                        .setMarginTop(level == 1 ? 20 : 15)
                        .setMarginBottom(10)
                        .setKeepTogether(true); // Prevent page break in middle of header
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

            // Check for bullet lists (- Item or * Item)
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                String itemText = trimmed.substring(2).trim();
                Paragraph para = new Paragraph("• " + processInlineFormatting(itemText))
                        .setFont(normalFont)
                        .setFontSize(12)
                        .setMarginLeft(20)
                        .setMarginBottom(5);
                document.add(para);
                continue;
            }

            // Regular paragraph with bold formatting
            Paragraph para = new Paragraph()
                    .setFont(normalFont)
                    .setFontSize(12)
                    .setMarginBottom(10)
                    .setTextAlignment(TextAlignment.JUSTIFIED);

            // Process inline formatting (bold **text**)
            String[] parts = trimmed.split("\\*\\*");
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
    }

    /**
     * Add metadata footer to PDF
     */
    private void addPdfMetadataFooter(Document document, Map<String, Object> docData, PdfFont font) throws IOException {
        LocalDateTime generatedAt = docData.get("generatedAt") != null
                ? (LocalDateTime) docData.get("generatedAt")
                : LocalDateTime.now();

        String footerText = String.format(
                "Generated: %s | Version: %s | Words: %s | Tokens: %s | Cost: $%s",
                generatedAt.format(DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")),
                docData.get("version"),
                docData.get("wordCount"),
                docData.get("tokensUsed"),
                docData.get("costEstimate")
        );

        Paragraph footer = new Paragraph(footerText)
                .setFont(font)
                .setFontSize(8)
                .setMarginTop(30)
                .setTextAlignment(TextAlignment.CENTER);

        document.add(footer);
    }
}
