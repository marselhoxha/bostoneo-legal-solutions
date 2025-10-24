package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AiConversationMessage;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.repository.AiConversationMessageRepository;
import com.bostoneo.bostoneosolutions.repository.AiConversationSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

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

    /**
     * Get or create a conversation session for legal research
     */
    @Transactional
    public AiConversationSession getOrCreateSession(Long sessionId, Long userId, Long caseId, String title) {
        if (sessionId != null) {
            Optional<AiConversationSession> existing = sessionRepository.findByIdAndUserId(sessionId, userId);
            if (existing.isPresent()) {
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

        return sessionRepository.save(session);
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
    public AiConversationMessage addMessage(Long sessionId, Long userId, String role, String content) {
        AiConversationSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));

        AiConversationMessage message = AiConversationMessage.builder()
                .session(session)
                .role(role)
                .content(content)
                .ragContextUsed(false)
                .build();

        // Save message directly to avoid cascade issues
        AiConversationMessage savedMessage = messageRepository.save(message);

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
        return sessionRepository.findByCaseIdAndUserIdAndSessionType(caseId, userId);
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
     */
    @Transactional
    public boolean updateSessionTitle(Long sessionId, Long userId, String title) {
        Optional<AiConversationSession> session = sessionRepository.findByIdAndUserId(sessionId, userId);
        if (session.isPresent()) {
            AiConversationSession s = session.get();
            s.setSessionName(title);
            sessionRepository.save(s);
            return true;
        }
        return false;
    }
}
