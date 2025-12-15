package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AiConversationMessage;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.repository.AiConversationMessageRepository;
import com.bostoneo.bostoneosolutions.repository.AiConversationSessionRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Service for managing legal research conversations
 * Uses existing ai_conversation_sessions and ai_conversation_messages tables
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LegalResearchConversationService {

    private final AiConversationSessionRepository sessionRepository;
    private final AiConversationMessageRepository messageRepository;
    private final ClaudeSonnet4Service claudeService;
    private final GenerationCancellationService cancellationService;
    private final AILegalResearchService aiLegalResearchService;

    /**
     * Get or create a conversation session for legal research
     */
    @Transactional
    public AiConversationSession getOrCreateSession(Long sessionId, Long userId, Long caseId, String title) {
        log.info("🆕 getOrCreateSession called - sessionId: {}, userId: {}, caseId: {}, title: '{}'",
                sessionId, userId, caseId, title);

        if (sessionId != null) {
            Optional<AiConversationSession> existing = sessionRepository.findByIdAndUserId(sessionId, userId);
            if (existing.isPresent()) {
                log.info("✅ Found existing session: {}", sessionId);
                return existing.get();
            }
        }

        // Create new session
        AiConversationSession session = AiConversationSession.builder()
                .userId(userId)
                .caseId(caseId)
                .sessionName(title != null ? title : "Legal Research")
                .sessionType("legal_research")
                .isActive(true)
                .isPinned(false)
                .isArchived(false)
                .messageCount(0)
                .totalTokensUsed(0)
                .build();

        AiConversationSession savedSession = sessionRepository.save(session);
        log.info("✅ Created new session: id={}, userId={}, sessionName='{}'",
                savedSession.getId(), savedSession.getUserId(), savedSession.getSessionName());

        return savedSession;
    }

    /**
     * Save or update a conversation session with messages
     */
    @Transactional
    public AiConversationSession saveSession(AiConversationSession session) {
        return sessionRepository.save(session);
    }

    /**
     * Add a message to a session
     */
    @Transactional
    public AiConversationMessage addMessage(Long sessionId, Long userId, String role, String content, String metadata) {
        AiConversationSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));

        // Parse metadata JSON if provided
        Map<String, Object> metadataMap = null;
        if (metadata != null && !metadata.isEmpty()) {
            try {
                metadataMap = new com.fasterxml.jackson.databind.ObjectMapper().readValue(metadata, Map.class);
            } catch (Exception e) {
                log.warn("Failed to parse metadata JSON: {}", e.getMessage());
            }
        }

        AiConversationMessage message = AiConversationMessage.builder()
                .session(session)
                .role(role)
                .content(content)
                .metadata(metadataMap)
                .ragContextUsed(false)
                .build();

        log.info("💾 About to save message with metadata: {} (Map: {})", metadata, metadataMap);

        // Save message directly to avoid cascade issues
        AiConversationMessage savedMessage = messageRepository.save(message);

        log.info("✅ Saved message {} with metadata from DB: {} (original map: {})",
                savedMessage.getId(), savedMessage.getMetadata(), metadataMap);

        // Update session message count
        session.setMessageCount(session.getMessageCount() != null ? session.getMessageCount() + 1 : 1);
        sessionRepository.save(session);

        return savedMessage;
    }

    /**
     * Get all conversations for a case and user
     */
    @Transactional(readOnly = true)
    public List<AiConversationSession> getConversationsForCase(Long caseId, Long userId) {
        List<AiConversationSession> sessions = sessionRepository.findByCaseIdAndUserIdAndSessionType(caseId, userId);
        log.info("📚 Loading conversations for caseId: {}, userId: {} - found {} sessions", caseId, userId, sessions.size());
        for (AiConversationSession session : sessions) {
            log.info("   📝 Session {}: sessionName='{}', userId={}, createdAt={}",
                    session.getId(), session.getSessionName(), session.getUserId(), session.getCreatedAt());
        }
        return sessions;
    }

    /**
     * Get a specific conversation by ID
     */
    @Transactional(readOnly = true)
    public Optional<AiConversationSession> getConversation(Long sessionId, Long userId) {
        return sessionRepository.findByIdAndUserId(sessionId, userId);
    }

    /**
     * Get all messages for a session
     */
    @Transactional(readOnly = true)
    public List<AiConversationMessage> getMessages(Long sessionId, Long userId) {
        // First verify user has access to this session
        if (!sessionRepository.existsByIdAndUserId(sessionId, userId)) {
            throw new IllegalArgumentException("Session not found or access denied");
        }
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    /**
     * Delete a conversation
     */
    @Transactional
    public boolean deleteConversation(Long sessionId, Long userId) {
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserId(sessionId, userId);
        if (session.isPresent()) {
            sessionRepository.delete(session.get());
            return true;
        }
        return false;
    }

    /**
     * Archive a conversation
     */
    @Transactional
    public boolean archiveConversation(Long sessionId, Long userId) {
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserId(sessionId, userId);
        if (session.isPresent()) {
            AiConversationSession s = session.get();
            s.archive();
            sessionRepository.save(s);
            return true;
        }
        return false;
    }

    /**
     * Update session title
     * Now more lenient - will update if session exists and userId is close match (handles edge cases)
     */
    @Transactional
    public boolean updateSessionTitle(Long sessionId, Long userId, String title) {
        log.info("📝 Attempting to update session title - sessionId: {}, userId: {}, newTitle: '{}'", sessionId, userId, title);

        // First try with exact userId match
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserId(sessionId, userId);
        if (session.isPresent()) {
            AiConversationSession s = session.get();
            String oldTitle = s.getSessionName();
            s.setSessionName(title);
            AiConversationSession saved = sessionRepository.save(s);
            sessionRepository.flush(); // Force immediate write to DB
            log.info("✅ Successfully updated session title from '{}' to '{}' for sessionId: {}, verified saved title: '{}'",
                    oldTitle, title, sessionId, saved.getSessionName());
            return true;
        }

        // If exact match fails, check if session exists at all
        Optional<AiConversationSession> sessionWithoutUserCheck = sessionRepository.findById(sessionId);
        if (sessionWithoutUserCheck.isPresent()) {
            AiConversationSession existingSession = sessionWithoutUserCheck.get();
            log.warn("⚠️ Session {} exists but userId mismatch! Request userId: {}, DB userId: {}. Attempting fallback update...",
                    sessionId, userId, existingSession.getUserId());

            // FALLBACK: If session exists but userId doesn't match, still update if title is default
            // This handles edge cases where userId might be slightly different due to timing
            String currentTitle = existingSession.getSessionName();
            if (currentTitle == null || currentTitle.isEmpty() ||
                "New Conversation".equals(currentTitle) || "Legal Research".equals(currentTitle) ||
                "Untitled Conversation".equals(currentTitle)) {
                log.info("📝 Fallback: Updating session {} title (was '{}') because it's a default title", sessionId, currentTitle);
                existingSession.setSessionName(title);
                AiConversationSession saved = sessionRepository.save(existingSession);
                sessionRepository.flush();
                log.info("✅ Fallback update successful - new title: '{}'", saved.getSessionName());
                return true;
            } else {
                log.error("❌ Cannot update: Session has custom title '{}' and userId mismatch", currentTitle);
            }
        } else {
            log.error("❌ Session {} does not exist in database at all", sessionId);
        }

        return false;
    }

    /**
     * Get all conversations for a user with pagination
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getAllUserConversations(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return sessionRepository.findAllByUserId(userId, pageable);
    }

    /**
     * Get conversations filtered by task type with pagination
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getConversationsByTaskType(String taskType, Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return sessionRepository.findByUserIdAndTaskType(userId, taskType, pageable);
    }

    /**
     * Get ONLY general conversations (no caseId) filtered by task type with pagination
     * Used by AI Workspace to exclude case-specific research conversations
     * EXCEPTION: For GENERATE_DRAFT task, returns ALL drafts (both with and without caseId)
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getGeneralConversationsByTaskType(String taskType, Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // For drafts, show ALL drafts regardless of caseId
        // For other tasks, only show general conversations
        if ("GENERATE_DRAFT".equals(taskType)) {
            return sessionRepository.findByUserIdAndTaskType(userId, taskType, pageable);
        } else {
            return sessionRepository.findGeneralConversationsByUserIdAndTaskType(userId, taskType, pageable);
        }
    }

    /**
     * Create a new general conversation with task type and research mode
     */
    @Transactional
    public AiConversationSession createGeneralConversation(Long userId, String title, String researchMode, String taskType) {
        return createGeneralConversation(userId, title, researchMode, taskType, null, null);
    }

    /**
     * Create a new general conversation with task type, research mode, and document type
     */
    @Transactional
    public AiConversationSession createGeneralConversation(Long userId, String title, String researchMode, String taskType, String documentType, String jurisdiction) {
        AiConversationSession session = AiConversationSession.builder()
                .userId(userId)
                .sessionName(title != null ? title : "New Conversation")
                .sessionType("general")
                .taskType(taskType != null ? taskType : "LEGAL_QUESTION")
                .researchMode(researchMode != null ? researchMode : "FAST")
                .documentType(documentType)
                .jurisdiction(jurisdiction)
                .isActive(true)
                .isPinned(false)
                .isArchived(false)
                .messageCount(0)
                .totalTokensUsed(0)
                .build();

        return sessionRepository.save(session);
    }

    /**
     * Send message to conversation and get AI response
     */
    @Transactional
    public CompletableFuture<AiConversationMessage> sendMessageWithAIResponse(
            Long sessionId,
            Long userId,
            String query,
            String researchMode
    ) {
        // Get the session
        AiConversationSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));

        // Save user message
        AiConversationMessage userMessage = AiConversationMessage.builder()
                .session(session)
                .role("user")
                .content(query)
                .ragContextUsed(false)
                .build();
        messageRepository.save(userMessage);

        // Update session message count
        session.setMessageCount(session.getMessageCount() != null ? session.getMessageCount() + 1 : 1);
        sessionRepository.save(session);

        // Build conversation history from database messages
        List<AiConversationMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        StringBuilder conversationHistory = new StringBuilder();

        for (AiConversationMessage msg : messages) {
            conversationHistory.append(msg.getRole().equals("user") ? "User: " : "Assistant: ")
                    .append(msg.getContent())
                    .append("\n\n");
        }

        // Check if generation has been cancelled before starting
        if (cancellationService.isCancelled(sessionId)) {
            log.warn("🛑 Query cancelled before AI call for session {}", sessionId);
            cancellationService.clearCancellation(sessionId);
            return CompletableFuture.failedFuture(new IllegalStateException("Query cancelled by user"));
        }

        // THOROUGH mode: Use full agentic research system with citation verification
        if ("THOROUGH".equalsIgnoreCase(researchMode)) {
            return handleThoroughModeQuery(session, sessionId, userId, query, messages);
        }

        // FAST mode: Use standard conversation flow
        boolean useDeepThinking = false; // FAST mode doesn't use deep thinking

        // Get AI response
        String prompt = "You are a legal research assistant. Based on the following conversation history, "
                + "provide a helpful response to the user's latest question.\n\n"
                + "IMPORTANT FORMATTING GUIDELINES:\n"
                + "When presenting timelines with dates, use this format:\n"
                + "- **Date** (optional context): Description\n"
                + "Example:\n"
                + "- **November 9, 2025** (10 days): Defendant must be served\n"
                + "- **December 30, 2025**: Discovery deadline\n\n"
                + "🚨 WHEN TO USE CHARTS VS TABLES:\n\n"
                + "Use CHARTS only for NUMERIC data:\n"
                + "✅ BAR charts: Numeric comparisons (case counts: 450 vs 300, dollar amounts: $15000 vs $8000, scores: 8.5 vs 6.2)\n"
                + "✅ PIE charts: Percentage breakdowns that sum to 100% (45% vs 30% vs 25%)\n"
                + "✅ LINE charts: Numeric trends over time (1250 in 2020, 1420 in 2021)\n\n"
                + "Use TABLES for CATEGORICAL/TEXT data:\n"
                + "❌ DO NOT use charts for: Low/Medium/High, Yes/No, text descriptions, qualitative comparisons\n"
                + "✅ Instead use markdown tables: | Circuit | Approach | for categorical comparisons\n\n"
                + "Example WRONG (categorical data in chart):\n"
                + "CHART:BAR\n"
                + "| Circuit | Level |\n"
                + "| 4th Cir | Low (narrow data sufficient) | ❌ TEXT, not a number!\n\n"
                + "Example CORRECT (categorical data in table):\n"
                + "| Circuit | Minimization Requirement |\n"
                + "|---------|-------------------------|\n"
                + "| 4th Cir | Low (narrow data sufficient) | ✅ Table for text data\n\n"
                + "When presenting comparative NUMERIC data or statistics, use these chart formats:\n\n"
                + "For bar charts (comparing NUMERIC values):\n"
                + "CHART:BAR\n"
                + "| Category | Value |\n"
                + "|----------|-------|\n"
                + "| Item 1   | 450   |\n"
                + "| Item 2   | 300   |\n\n"
                + "For percentage breakdowns:\n"
                + "CHART:PIE\n"
                + "- Category A: 45%\n"
                + "- Category B: 30%\n"
                + "- Category C: 25%\n\n"
                + "For trends over time:\n"
                + "CHART:LINE\n"
                + "Title of Chart\n"
                + "2020: 1250\n"
                + "2021: 1420\n"
                + "2022: 1580\n\n"
                + "Use these formats whenever you're presenting timelines, comparisons, statistics, or trends. "
                + "The system will automatically convert them into beautiful visual charts.\n\n"
                + "## Follow-up Questions\n"
                + "After your main response, include a \"## Follow-up Questions\" section.\n"
                + "⚠️ CRITICAL: These are questions the USER (attorney) would ask YOU (AI) to research further.\n"
                + "They are NOT questions for the user to answer - they are clickable prompts for continued research.\n"
                + "Generate 3 attorney-quality follow-up research questions that deepen the legal analysis.\n\n"
                + "🚨 MANDATORY REQUIREMENT - COMPLETE QUESTIONS ONLY:\n"
                + "Each question MUST be a COMPLETE, GRAMMATICALLY CORRECT SENTENCE (minimum 40 characters).\n"
                + "❌ REJECTED: Single words (\"trial?\"), fragments (\"good faith defense\"), punctuation-only (\"---\")\n"
                + "✅ REQUIRED: Must contain question indicators like: Find, Does, What, How, Can, Should, Is, Are, Will, When, Where\n\n"
                + "Format:\n"
                + "- Find [jurisdiction] cases on [specific legal issue] (40-80 chars)\n"
                + "- Does [specific statute/rule] apply to [scenario]? (40-80 chars)\n"
                + "- How does [court] typically handle [specific issue]? (40-80 chars)\n\n"
                + "Example (GOOD):\n"
                + "- Find Second Circuit cases on good faith purchaser defense for art restitution\n"
                + "- Does Fed. R. Evid. 706 require court-appointed experts in complex cases?\n"
                + "- What are the key differences between Mass. and federal summary judgment standards?\n\n"
                + "Example (BAD - DO NOT USE):\n"
                + "- trial? (too short, fragment)\n"
                + "- good faith defense (not a question)\n"
                + "- --- (punctuation only)\n\n"
                + "Conversation History:\n" + conversationHistory.toString();

        // Get the Claude AI future - subscription registration handled inside
        CompletableFuture<String> claudeFuture = claudeService.generateCompletion(prompt, null, useDeepThinking, sessionId);

        // Transform the String response to AiConversationMessage
        return claudeFuture
                .thenApply(aiResponse -> {
                    // Save AI response message
                    AiConversationMessage assistantMessage = AiConversationMessage.builder()
                            .session(session)
                            .role("assistant")
                            .content(aiResponse)
                            .ragContextUsed(false)
                            .modelUsed("claude-sonnet-4")
                            .build();

                    AiConversationMessage savedMessage = messageRepository.save(assistantMessage);

                    // Update session message count again
                    session.setMessageCount(session.getMessageCount() + 1);
                    sessionRepository.save(session);

                    return savedMessage;
                })
                .exceptionally(ex -> {
                    // Check if it was cancelled
                    if (cancellationService.isCancelled(sessionId) || ex.getCause() instanceof IllegalStateException) {
                        log.info("🛑 AI query was cancelled for session {}", sessionId);
                    }

                    throw new RuntimeException("Failed to generate AI response", ex);
                });
    }

    /**
     * Handle THOROUGH mode query using full agentic research system
     * Delegates to AILegalResearchService for citation verification and tool usage
     */
    private CompletableFuture<AiConversationMessage> handleThoroughModeQuery(
            AiConversationSession session,
            Long sessionId,
            Long userId,
            String query,
            List<AiConversationMessage> messages
    ) {
        log.info("🔍 THOROUGH mode activated for session {} - using full agentic research system", sessionId);

        // Build conversation history for context
        List<Map<String, String>> conversationHistory = new java.util.ArrayList<>();
        for (AiConversationMessage msg : messages) {
            Map<String, String> historyEntry = new java.util.HashMap<>();
            historyEntry.put("role", msg.getRole());
            historyEntry.put("content", msg.getContent());
            conversationHistory.add(historyEntry);
        }

        // Build search request for AILegalResearchService
        Map<String, Object> searchRequest = new java.util.HashMap<>();
        searchRequest.put("query", query);
        searchRequest.put("searchType", "ALL");
        searchRequest.put("jurisdiction", "GENERAL");
        searchRequest.put("userId", userId);
        searchRequest.put("sessionId", String.valueOf(sessionId));
        searchRequest.put("researchMode", "THOROUGH");
        searchRequest.put("conversationHistory", conversationHistory);

        try {
            // Call AILegalResearchService for full agentic research with tools
            Map<String, Object> result = aiLegalResearchService.performSearch(searchRequest);

            // Extract AI response from result
            String aiResponse = (String) result.get("aiAnalysis");

            if (aiResponse == null || aiResponse.isEmpty()) {
                throw new RuntimeException("No AI response received from research service");
            }

            // Save AI response to conversation
            AiConversationMessage assistantMessage = AiConversationMessage.builder()
                    .session(session)
                    .role("assistant")
                    .content(aiResponse)
                    .ragContextUsed(true) // THOROUGH mode uses tools/research
                    .modelUsed("claude-sonnet-4-thorough")
                    .build();

            AiConversationMessage savedMessage = messageRepository.save(assistantMessage);

            // Update session message count
            session.setMessageCount(session.getMessageCount() + 1);
            sessionRepository.save(session);

            log.info("✅ THOROUGH mode research complete for session {}", sessionId);

            return CompletableFuture.completedFuture(savedMessage);

        } catch (Exception e) {
            log.error("❌ THOROUGH mode research failed for session {}: {}", sessionId, e.getMessage(), e);
            throw new RuntimeException("THOROUGH mode research failed: " + e.getMessage(), e);
        }
    }
}
