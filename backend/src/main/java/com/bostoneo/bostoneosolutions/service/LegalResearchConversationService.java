package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AiConversationMessage;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AiConversationMessageRepository;
import com.bostoneo.bostoneosolutions.repository.AiConversationSessionRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.utils.PiiDetector;
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
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Get or create a conversation session for legal research - TENANT FILTERED
     */
    @Transactional
    public AiConversationSession getOrCreateSession(Long sessionId, Long userId, Long caseId, String title) {
        Long orgId = getRequiredOrganizationId();
        log.info("🆕 getOrCreateSession called - sessionId: {}, userId: {}, caseId: {}, orgId: {}, title: '{}'",
                sessionId, userId, caseId, orgId, title);

        if (sessionId != null) {
            Optional<AiConversationSession> existing = sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId);
            if (existing.isPresent()) {
                log.info("✅ Found existing session: {}", sessionId);
                return existing.get();
            }
        }

        // Create new session with organization ID
        AiConversationSession session = AiConversationSession.builder()
                .userId(userId)
                .organizationId(orgId)
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
        log.info("✅ Created new session: id={}, userId={}, orgId={}, sessionName='{}'",
                savedSession.getId(), savedSession.getUserId(), savedSession.getOrganizationId(), savedSession.getSessionName());

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
     * Add a message to a session - TENANT FILTERED (backward compatible overload)
     */
    @Transactional
    public AiConversationMessage addMessage(Long sessionId, Long userId, String role, String content, String metadata) {
        return addMessage(sessionId, userId, role, content, metadata, null);
    }

    /**
     * Add a message to a session with research mode - TENANT FILTERED
     */
    @Transactional
    public AiConversationMessage addMessage(Long sessionId, Long userId, String role, String content, String metadata, String researchMode) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        AiConversationSession session = sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId)
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

        // ABA Compliance: Redact PII from user messages before storing in DB
        String safeContent = "user".equals(role) ? PiiDetector.redact(content) : content;

        AiConversationMessage message = AiConversationMessage.builder()
                .session(session)
                .organizationId(session.getOrganizationId())
                .role(role)
                .content(safeContent)
                .metadata(metadataMap)
                .ragContextUsed(false)
                .researchMode(researchMode) // Store research mode per message for badge display
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
     * Get all conversations for a case and user - TENANT FILTERED
     */
    @Transactional(readOnly = true)
    public List<AiConversationSession> getConversationsForCase(Long caseId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<AiConversationSession> sessions = sessionRepository.findByCaseIdAndUserIdAndOrganizationId(caseId, userId, orgId);
        log.info("📚 Loading conversations for caseId: {}, userId: {}, orgId: {} - found {} sessions", caseId, userId, orgId, sessions.size());
        for (AiConversationSession session : sessions) {
            log.info("   📝 Session {}: sessionName='{}', userId={}, createdAt={}",
                    session.getId(), session.getSessionName(), session.getUserId(), session.getCreatedAt());
        }
        return sessions;
    }

    /**
     * Get a specific conversation by ID - TENANT FILTERED
     */
    @Transactional(readOnly = true)
    public Optional<AiConversationSession> getConversation(Long sessionId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId);
    }

    /**
     * Get all messages for a session - TENANT FILTERED
     */
    @Transactional(readOnly = true)
    public List<AiConversationMessage> getMessages(Long sessionId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify user has access to this session with org check
        if (!sessionRepository.existsByIdAndUserIdAndOrganizationId(sessionId, userId, orgId)) {
            throw new IllegalArgumentException("Session not found or access denied");
        }
        // SECURITY: Use tenant-filtered query
        return messageRepository.findBySessionIdAndOrganizationIdOrderByCreatedAtAsc(sessionId, orgId);
    }

    /**
     * Delete a conversation - TENANT FILTERED
     */
    @Transactional
    public boolean deleteConversation(Long sessionId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId);
        if (session.isPresent()) {
            messageRepository.deleteBySessionId(sessionId);
            sessionRepository.delete(session.get());
            return true;
        }
        return false;
    }

    /**
     * Archive a conversation - TENANT FILTERED
     */
    @Transactional
    public boolean archiveConversation(Long sessionId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId);
        if (session.isPresent()) {
            AiConversationSession s = session.get();
            s.archive();
            sessionRepository.save(s);
            return true;
        }
        return false;
    }

    /**
     * Update session title - TENANT FILTERED
     * Now more lenient - will update if session exists and userId is close match (handles edge cases)
     */
    @Transactional
    public boolean updateSessionTitle(Long sessionId, Long userId, String title) {
        log.info("📝 Attempting to update session title - sessionId: {}, userId: {}, newTitle: '{}'", sessionId, userId, title);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: First try with exact userId match and organization filter
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId);
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

        // If exact match fails, check if session exists at all within the organization
        // SECURITY: Fallback still requires org-level access
        Optional<AiConversationSession> sessionWithOrgCheck = sessionRepository.findByIdAndOrganizationId(sessionId, orgId);
        if (sessionWithOrgCheck.isPresent()) {
            AiConversationSession existingSession = sessionWithOrgCheck.get();
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
     * Get all conversations for a user with pagination - TENANT FILTERED
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getAllUserConversations(Long userId, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size);
        return sessionRepository.findAllByUserIdAndOrganizationId(userId, orgId, pageable);
    }

    /**
     * Get conversations filtered by task type with pagination - TENANT FILTERED
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getConversationsByTaskType(String taskType, Long userId, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size);
        return sessionRepository.findByUserIdAndOrganizationIdAndTaskType(userId, orgId, taskType, pageable);
    }

    /**
     * Get ONLY general conversations (no caseId) filtered by task type with pagination - TENANT FILTERED
     * Used by AI Workspace to exclude case-specific research conversations
     * EXCEPTION: For GENERATE_DRAFT task, returns ALL drafts (both with and without caseId)
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getGeneralConversationsByTaskType(String taskType, Long userId, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size);

        // For drafts, show ALL drafts regardless of caseId
        // For other tasks, only show general conversations
        if ("GENERATE_DRAFT".equals(taskType)) {
            return sessionRepository.findByUserIdAndOrganizationIdAndTaskType(userId, orgId, taskType, pageable);
        } else {
            return sessionRepository.findGeneralConversationsByUserIdAndOrganizationIdAndTaskType(userId, orgId, taskType, pageable);
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
     * Create a new general conversation with task type, research mode, and document type - TENANT FILTERED
     */
    @Transactional
    public AiConversationSession createGeneralConversation(Long userId, String title, String researchMode, String taskType, String documentType, String jurisdiction) {
        Long orgId = getRequiredOrganizationId();
        AiConversationSession session = AiConversationSession.builder()
                .userId(userId)
                .organizationId(orgId)
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Get the session with tenant filter
        AiConversationSession session = sessionRepository.findByIdAndUserIdAndOrganizationId(sessionId, userId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));

        // ABA Compliance: Redact PII from user message before storing in DB
        String safeQuery = PiiDetector.redact(query);

        // Save user message
        AiConversationMessage userMessage = AiConversationMessage.builder()
                .session(session)
                .organizationId(session.getOrganizationId())
                .role("user")
                .content(safeQuery)
                .ragContextUsed(false)
                .build();
        messageRepository.save(userMessage);

        // Update session message count and persist research mode
        session.setMessageCount(session.getMessageCount() != null ? session.getMessageCount() + 1 : 1);
        // Persist the research mode - ensures UI shows correct mode after page refresh
        if (researchMode != null && !researchMode.equals(session.getResearchMode())) {
            session.setResearchMode(researchMode);
        }
        sessionRepository.save(session);

        // SECURITY: Build conversation history with tenant filter
        List<AiConversationMessage> messages = messageRepository.findBySessionIdAndOrganizationIdOrderByCreatedAtAsc(sessionId, orgId);
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
                + "## Sources Citation\n"
                + "At the VERY END of your response (after all content, before follow-up questions), "
                + "include a SOURCES line listing ALL cases, statutes, and regulations you cited, separated by |.\n"
                + "Format: SOURCES: Case Name, Citation | Statute Reference | Another Case\n"
                + "Example: SOURCES: Brune v. Belinkoff, 354 Mass. 102 | M.G.L. c. 231 § 60B | Lech v. Boisvert\n"
                + "This MUST be on its own line. Do NOT skip this.\n\n"
                + "## Follow-up Questions\n"
                + "After the SOURCES line, include a \"## Follow-up Questions\" section.\n\n"
                + "⚠️⚠️⚠️ CRITICAL - QUESTION DIRECTION ⚠️⚠️⚠️\n"
                + "These are clickable suggestions for the USER to ask YOU (the AI) for more research.\n"
                + "The USER clicks them → they get sent to YOU → YOU answer them.\n"
                + "They are NOT questions you are asking the user. NEVER ask the user for information.\n\n"
                + "❌ WRONG (AI asking user - NEVER DO THIS):\n"
                + "  ❌ \"Can you provide a case citation you need summarized?\" - WRONG\n"
                + "  ❌ \"Is there a specific jurisdiction you need analysis for?\" - WRONG\n"
                + "  ❌ \"What legal research task are you working on?\" - WRONG\n"
                + "  ❌ \"Would you like me to calculate deadlines?\" - WRONG\n"
                + "  ❌ \"Do you want me to...\" - WRONG\n\n"
                + "✅ CORRECT (user asking AI - DO THIS):\n"
                + "  ✅ \"What are the elements of a breach of contract claim in Massachusetts?\"\n"
                + "  ✅ \"Find cases on preliminary injunction standards in First Circuit\"\n"
                + "  ✅ \"Explain the statute of limitations for personal injury in MA\"\n"
                + "  ✅ \"What are the filing deadlines for summary judgment motions?\"\n\n"
                + "REQUIREMENTS:\n"
                + "- Each question is a request FROM the user TO the AI\n"
                + "- NEVER start with: \"Can you provide\", \"Do you need\", \"Would you like\", \"Is there a\"\n"
                + "- START with: \"What are\", \"Find\", \"Explain\", \"How does\", \"Does [law] apply\"\n\n"
                + "Conversation History:\n" + conversationHistory.toString();

        // Get the Claude AI future - subscription registration handled inside
        CompletableFuture<String> claudeFuture = claudeService.generateCompletion(prompt, null, useDeepThinking, sessionId);

        // Transform the String response to AiConversationMessage
        return claudeFuture
                .thenApply(aiResponse -> {
                    // Save AI response message with research mode
                    AiConversationMessage assistantMessage = AiConversationMessage.builder()
                            .session(session)
                            .organizationId(session.getOrganizationId())
                            .role("assistant")
                            .content(aiResponse)
                            .ragContextUsed(false)
                            .modelUsed("claude-sonnet-4")
                            .researchMode("FAST") // Store research mode per message for badge display
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

            // Check for validation or rate limit errors returned by performSearch
            if (Boolean.FALSE.equals(result.get("success"))) {
                String errorMsg = (String) result.getOrDefault("error", "Research request failed");
                String errorType = (String) result.getOrDefault("errorType", "UNKNOWN");
                log.warn("⚠️ THOROUGH mode research returned error for session {}: [{}] {}", sessionId, errorType, errorMsg);
                throw new RuntimeException(errorMsg);
            }

            // Extract AI response from result
            String aiResponse = (String) result.get("aiAnalysis");

            if (aiResponse == null || aiResponse.isEmpty()) {
                throw new RuntimeException("No AI response received from research service");
            }

            // Build metadata with quality score for frontend display
            Map<String, Object> messageMetadata = new java.util.HashMap<>();
            Object qualityScoreMap = result.get("qualityScore");
            if (qualityScoreMap != null) {
                messageMetadata.put("qualityScore", qualityScoreMap);
            }
            Object counselCheckMap = result.get("counselReadyCheck");
            if (counselCheckMap != null) {
                messageMetadata.put("counselReadyCheck", counselCheckMap);
            }

            // Save AI response to conversation with research mode
            AiConversationMessage assistantMessage = AiConversationMessage.builder()
                    .session(session)
                    .organizationId(session.getOrganizationId())
                    .role("assistant")
                    .content(aiResponse)
                    .ragContextUsed(true) // THOROUGH mode uses tools/research
                    .modelUsed("claude-sonnet-4-thorough")
                    .researchMode("THOROUGH") // Store research mode per message for badge display
                    .metadata(messageMetadata.isEmpty() ? null : messageMetadata)
                    .build();

            AiConversationMessage savedMessage = messageRepository.save(assistantMessage);

            // Update session message count
            session.setMessageCount(session.getMessageCount() + 1);
            sessionRepository.save(session);

            log.info("✅ THOROUGH mode research complete for session {}", sessionId);

            return CompletableFuture.completedFuture(savedMessage);

        } catch (Exception e) {
            log.error("❌ THOROUGH mode research failed for session {}: {}", sessionId, e.getMessage(), e);
            // Sanitize: never expose raw DB/internal errors to users
            String rawMsg = e.getMessage() != null ? e.getMessage() : "";
            String userMessage = (rawMsg.contains("duplicate key") || rawMsg.contains("unique constraint") ||
                rawMsg.contains("SQL") || rawMsg.contains("JDBC") || rawMsg.contains("PSQLException"))
                ? "A temporary issue occurred. Please try your question again."
                : rawMsg;
            throw new RuntimeException(userMessage, e);
        }
    }

    /**
     * Toggle bookmark on an AI message
     * TENANT FILTERED + USER OWNERSHIP CHECK
     */
    @Transactional
    public AiConversationMessage toggleBookmark(Long messageId, Long userId) {
        Long orgId = getRequiredOrganizationId();
        AiConversationMessage message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        // Tenant isolation check
        if (!orgId.equals(message.getOrganizationId())) {
            throw new IllegalArgumentException("Message not found or access denied");
        }

        // User ownership check: bookmarks are personal, verify session belongs to user
        AiConversationSession session = message.getSession();
        if (!userId.equals(session.getUserId())) {
            throw new IllegalArgumentException("Message not found or access denied");
        }

        // Toggle the bookmark
        message.setBookmarked(!Boolean.TRUE.equals(message.getBookmarked()));
        return messageRepository.save(message);
    }

    /**
     * Get general conversations with bookmarked messages, filtered by task type - TENANT FILTERED
     */
    @Transactional(readOnly = true)
    public Page<AiConversationSession> getBookmarkedGeneralConversationsByTaskType(String taskType, Long userId, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size);
        return sessionRepository.findBookmarkedGeneralConversationsByUserIdAndOrganizationIdAndTaskType(userId, orgId, taskType, pageable);
    }
}
