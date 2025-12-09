package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageDTO;
import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageThreadDTO;

import java.util.List;

/**
 * Service for attorney-side messaging operations
 */
public interface MessagingService {

    List<ClientPortalMessageThreadDTO> getThreadsForAttorney(Long userId);

    List<ClientPortalMessageThreadDTO> getThreadsByCase(Long caseId);

    List<ClientPortalMessageDTO> getMessagesForAttorney(Long userId, Long threadId);

    ClientPortalMessageDTO sendReply(Long userId, Long threadId, String content);

    int getUnreadCount(Long userId);

    void closeThread(Long threadId);

    ClientPortalMessageThreadDTO startThreadWithClient(Long attorneyId, Long clientId, Long caseId, String subject, String initialMessage);

    List<ClientDTO> getClientsForAttorney(Long attorneyId);

    // Simple DTO for client list
    record ClientDTO(Long id, String name, String email) {}
}
