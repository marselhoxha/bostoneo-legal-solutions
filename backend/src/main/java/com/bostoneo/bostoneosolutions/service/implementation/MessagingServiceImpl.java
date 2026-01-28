package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageDTO;
import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageThreadDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.ThreadAttorneyStatus;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.repository.ThreadAttorneyStatusRepository;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.service.MessagingService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.TwilioService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.handler.AuthenticatedWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class MessagingServiceImpl implements MessagingService {

    private final MessageThreadRepository threadRepository;
    private final MessageRepository messageRepository;
    private final ClientRepository clientRepository;
    private final LegalCaseRepository caseRepository;
    private final UserRepository<User> userRepository;
    private final NotificationService notificationService;
    private final AuthenticatedWebSocketHandler webSocketHandler;
    private final TwilioService twilioService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final ThreadAttorneyStatusRepository threadAttorneyStatusRepository;
    private final TenantService tenantService;

    /**
     * Get the current organization ID from tenant context.
     * Throws ApiException if no organization context is available.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

    @Override
    public List<ClientPortalMessageThreadDTO> getThreadsForAttorney(Long userId) {
        Long orgId = getRequiredOrganizationId();

        // Get threads directly assigned to this attorney (with org filtering)
        List<MessageThread> ownThreads = threadRepository.findByAttorneyIdAndOrganizationIdOrderByLastMessageAtDesc(userId, orgId);

        // SECURITY: Get case IDs where this attorney is assigned (with org filtering)
        List<CaseAssignment> assignments = caseAssignmentRepository.findActiveAssignmentsByUserIdAndOrganizationId(userId, orgId);
        List<Long> assignedCaseIds = assignments.stream()
                .map(a -> a.getLegalCase().getId())
                .collect(Collectors.toList());

        // Get threads for all assigned cases (even if not directly owned by this attorney) - with org filtering
        List<MessageThread> caseThreads = assignedCaseIds.isEmpty() ?
                List.of() : threadRepository.findByCaseIdInAndOrganizationIdOrderByLastMessageAtDesc(assignedCaseIds, orgId);

        // Merge and deduplicate threads (own threads first, then case threads)
        java.util.Set<Long> seenIds = new java.util.HashSet<>();
        List<MessageThread> allThreads = new java.util.ArrayList<>();

        for (MessageThread thread : ownThreads) {
            if (seenIds.add(thread.getId())) {
                allThreads.add(thread);
                // Ensure attorney has a status record for this thread
                ensureAttorneyStatusExists(thread.getId(), userId);
            }
        }
        for (MessageThread thread : caseThreads) {
            if (seenIds.add(thread.getId())) {
                allThreads.add(thread);
                // Ensure attorney has a status record for this thread
                ensureAttorneyStatusExists(thread.getId(), userId);
            }
        }

        // Sort by lastMessageAt descending
        allThreads.sort((a, b) -> {
            if (a.getLastMessageAt() == null && b.getLastMessageAt() == null) return 0;
            if (a.getLastMessageAt() == null) return 1;
            if (b.getLastMessageAt() == null) return -1;
            return b.getLastMessageAt().compareTo(a.getLastMessageAt());
        });

        // Use per-attorney unread counts (pass userId to get attorney-specific counts)
        return allThreads.stream()
                .map(thread -> mapToThreadDTOForAttorney(thread, userId))
                .collect(Collectors.toList());
    }

    @Override
    public List<ClientPortalMessageThreadDTO> getThreadsByCase(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        List<MessageThread> threads = threadRepository.findByCaseIdAndOrganizationIdOrderByLastMessageAtDesc(caseId, orgId);
        return threads.stream().map(this::mapToThreadDTO).collect(Collectors.toList());
    }

    @Override
    public List<ClientPortalMessageDTO> getMessagesForAttorney(Long userId, Long threadId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify thread belongs to current organization
        MessageThread thread = threadRepository.findByIdAndOrganizationId(threadId, orgId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        // Mark client messages as read (for message-level tracking) - with org filtering
        LocalDateTime readAt = LocalDateTime.now();
        int markedCount = messageRepository.markAsReadByOrganization(threadId, orgId, Message.SenderType.CLIENT, readAt);

        // CRITICAL FIX: Mark as read ONLY for THIS attorney, not all attorneys
        // This uses the per-attorney status table instead of the shared thread field
        markThreadAsReadForAttorney(threadId, userId, readAt);

        // Notify client via WebSocket that attorney has read their messages
        if (markedCount > 0) {
            sendReadReceiptToClient(thread, userId, readAt);
        }

        // Get messages with org filtering
        List<Message> messages = messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtAsc(threadId, orgId);

        // Debug: Log read status of messages
        for (Message msg : messages) {
            log.debug("Message {} (type: {}, senderId: {}) - isRead: {}, readAt: {}",
                msg.getId(), msg.getSenderType(), msg.getSenderId(), msg.getIsRead(), msg.getReadAt());
        }

        return messages.stream().map(this::mapToMessageDTO).collect(Collectors.toList());
    }

    /**
     * Mark thread as read for a specific attorney only.
     * This does NOT affect other attorneys' unread counts.
     */
    private void markThreadAsReadForAttorney(Long threadId, Long attorneyUserId, LocalDateTime readAt) {
        Long orgId = getRequiredOrganizationId();
        ThreadAttorneyStatus status = threadAttorneyStatusRepository
                .findByOrganizationIdAndThreadIdAndAttorneyUserId(orgId, threadId, attorneyUserId)
                .orElse(null);

        if (status != null) {
            status.markAsRead();
            threadAttorneyStatusRepository.save(status);
            log.debug("Marked thread {} as read for attorney {} (was {} unread)",
                    threadId, attorneyUserId, status.getUnreadCount());
        } else {
            // Create new status record marked as read
            status = ThreadAttorneyStatus.builder()
                    .organizationId(orgId)
                    .threadId(threadId)
                    .attorneyUserId(attorneyUserId)
                    .unreadCount(0)
                    .lastReadAt(readAt)
                    .build();
            threadAttorneyStatusRepository.save(status);
            log.debug("Created new read status for thread {} attorney {}", threadId, attorneyUserId);
        }
    }

    /**
     * Ensure an attorney has a status record for a thread.
     * Creates one with the current thread's unread count if it doesn't exist.
     */
    private void ensureAttorneyStatusExists(Long threadId, Long attorneyUserId) {
        Long orgId = getRequiredOrganizationId();
        if (!threadAttorneyStatusRepository.existsByOrganizationIdAndThreadIdAndAttorneyUserId(orgId, threadId, attorneyUserId)) {
            // SECURITY: Use tenant-filtered query
            MessageThread thread = threadRepository.findByIdAndOrganizationId(threadId, orgId).orElse(null);
            int initialUnread = thread != null && thread.getUnreadByAttorney() != null
                    ? thread.getUnreadByAttorney() : 0;

            ThreadAttorneyStatus status = ThreadAttorneyStatus.builder()
                    .organizationId(orgId)
                    .threadId(threadId)
                    .attorneyUserId(attorneyUserId)
                    .unreadCount(initialUnread)
                    .build();
            threadAttorneyStatusRepository.save(status);
            log.debug("Created initial status for thread {} attorney {} with {} unread",
                    threadId, attorneyUserId, initialUnread);
        }
    }

    /**
     * Increment unread count for OTHER attorneys on a thread (excludes the sender).
     * This ensures each attorney has their own unread count when one attorney sends a message.
     */
    private void incrementUnreadForOtherAttorneys(MessageThread thread, Long senderUserId) {
        Long orgId = thread.getOrganizationId();
        // Get all attorney user IDs for this thread - SECURITY: pass org ID from thread
        List<Long> attorneyUserIds = getAttorneyUserIdsForThread(thread, orgId);

        for (Long attorneyUserId : attorneyUserIds) {
            // Skip the sender - they shouldn't get an unread count for their own message
            if (attorneyUserId.equals(senderUserId)) {
                continue;
            }

            ThreadAttorneyStatus status = threadAttorneyStatusRepository
                    .findByOrganizationIdAndThreadIdAndAttorneyUserId(orgId, thread.getId(), attorneyUserId)
                    .orElse(null);

            if (status != null) {
                status.incrementUnread();
                threadAttorneyStatusRepository.save(status);
                log.debug("Incremented unread for thread {} attorney {} (now {})",
                        thread.getId(), attorneyUserId, status.getUnreadCount());
            } else {
                // Create new status record with unread count of 1
                status = ThreadAttorneyStatus.builder()
                        .organizationId(orgId)
                        .threadId(thread.getId())
                        .attorneyUserId(attorneyUserId)
                        .unreadCount(1)
                        .build();
                threadAttorneyStatusRepository.save(status);
                log.debug("Created status for thread {} attorney {} with 1 unread",
                        thread.getId(), attorneyUserId);
            }
        }
    }

    /**
     * Get all attorney user IDs for a thread (thread owner + case assignments).
     * SECURITY: Uses org-filtered query for case assignments.
     */
    private List<Long> getAttorneyUserIdsForThread(MessageThread thread, Long organizationId) {
        List<Long> attorneyUserIds = new java.util.ArrayList<>();

        // 1. Thread owner (attorney_id)
        if (thread.getAttorneyId() != null) {
            attorneyUserIds.add(thread.getAttorneyId());
        }

        // 2. Case-assigned attorneys - SECURITY: use org-filtered query
        if (thread.getCaseId() != null && organizationId != null) {
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(thread.getCaseId(), organizationId);
            for (CaseAssignment assignment : assignments) {
                if (assignment.getAssignedTo() != null) {
                    Long userId = assignment.getAssignedTo().getId();
                    if (!attorneyUserIds.contains(userId)) {
                        attorneyUserIds.add(userId);
                    }
                }
            }
        }

        return attorneyUserIds;
    }

    /**
     * Send read receipt WebSocket notification to client when attorney reads their messages
     */
    private void sendReadReceiptToClient(MessageThread thread, Long attorneyUserId, LocalDateTime readAt) {
        try {
            Long orgId = getRequiredOrganizationId();
            // SECURITY: Use tenant-filtered query
            Client client = clientRepository.findByIdAndOrganizationId(thread.getClientId(), orgId).orElse(null);
            if (client == null || client.getUserId() == null) return;

            User attorney = userRepository.get(attorneyUserId);
            String attorneyName = attorney != null ? (attorney.getFirstName() + " " + attorney.getLastName()) : "Your Attorney";

            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("type", "MESSAGE_READ");
            wsMessage.put("threadId", thread.getId());
            wsMessage.put("readAt", readAt.toString());
            wsMessage.put("readByAttorneyId", attorneyUserId);
            wsMessage.put("readByAttorneyName", attorneyName);

            webSocketHandler.sendNotificationToUser(client.getUserId().toString(), wsMessage);
            log.debug("Read receipt sent to client user {} for thread {}", client.getUserId(), thread.getId());
        } catch (Exception e) {
            log.warn("Failed to send read receipt to client: {}", e.getMessage());
        }
    }

    @Override
    public ClientPortalMessageDTO sendReply(Long userId, Long threadId, String content) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify thread belongs to current organization
        MessageThread thread = threadRepository.findByIdAndOrganizationId(threadId, orgId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        Message message = Message.builder()
                .organizationId(orgId)
                .threadId(threadId)
                .senderId(userId)
                .senderType(Message.SenderType.ATTORNEY)
                .content(content)
                .isRead(false)
                .build();
        message = messageRepository.save(message);

        // Update thread
        thread.setLastMessageAt(message.getCreatedAt());
        thread.setLastMessageBy("ATTORNEY");
        thread.setUnreadByClient(thread.getUnreadByClient() + 1);
        threadRepository.save(thread);

        // CRITICAL: Increment unread count for OTHER attorneys (not the sender)
        // This ensures each attorney has their own unread count in the database
        incrementUnreadForOtherAttorneys(thread, userId);

        // Notify client
        notifyClientOfReply(thread, userId, content);

        // Send WebSocket notification for real-time update
        sendWebSocketNotification(thread, message, "CLIENT");

        // Notify other attorneys on the case (for multi-attorney collaboration)
        notifyOtherAttorneys(thread, message, userId);

        log.info("Attorney {} replied to thread {}", userId, threadId);
        return mapToMessageDTO(message);
    }

    @Override
    public ClientPortalMessageDTO sendSmsReply(Long userId, Long threadId, String content, String toPhone) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify thread belongs to current organization
        MessageThread thread = threadRepository.findByIdAndOrganizationId(threadId, orgId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        // Send the SMS via Twilio
        SmsResponseDTO smsResponse = twilioService.sendSms(toPhone, content);
        if (!smsResponse.isSuccess()) {
            log.error("Failed to send SMS to {}: {}", toPhone, smsResponse.getErrorMessage());
            throw new ApiException("Failed to send SMS: " + smsResponse.getErrorMessage());
        }

        // Create message record with SMS channel
        Message message = Message.builder()
                .organizationId(orgId)
                .threadId(threadId)
                .senderId(userId)
                .senderType(Message.SenderType.ATTORNEY)
                .channel("SMS")
                .content(content)
                .isRead(false)
                .build();
        message = messageRepository.save(message);

        // Update thread
        thread.setLastMessageAt(message.getCreatedAt());
        thread.setLastMessageBy("ATTORNEY");
        thread.setChannel("SMS");
        thread.setUnreadByClient(thread.getUnreadByClient() + 1);
        threadRepository.save(thread);

        // CRITICAL: Increment unread count for OTHER attorneys (not the sender)
        incrementUnreadForOtherAttorneys(thread, userId);

        // Notify other attorneys on the case (for multi-attorney collaboration)
        notifyOtherAttorneys(thread, message, userId);

        log.info("Attorney {} sent SMS reply to thread {} (to: {})", userId, threadId, maskPhone(toPhone));
        return mapToMessageDTO(message);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "***" + phone.substring(phone.length() - 4);
    }

    @Override
    public int getUnreadCount(Long userId) {
        Long orgId = getRequiredOrganizationId();

        // Use per-attorney unread tracking for accurate counts
        // This ensures each attorney has their own unread count
        Integer perAttorneyCount = threadAttorneyStatusRepository.getTotalUnreadCountForAttorneyByOrganizationId(orgId, userId);
        if (perAttorneyCount != null && perAttorneyCount > 0) {
            return perAttorneyCount;
        }

        // Fallback to legacy behavior for backwards compatibility (with org filtering)
        Integer directCount = threadRepository.countUnreadByAttorneyAndOrganizationId(userId, orgId);
        int total = directCount != null ? directCount : 0;

        // SECURITY: Use org-filtered query for case assignments
        List<CaseAssignment> assignments = caseAssignmentRepository.findActiveAssignmentsByUserIdAndOrganizationId(userId, orgId);
        List<Long> assignedCaseIds = assignments.stream()
                .map(a -> a.getLegalCase().getId())
                .collect(Collectors.toList());

        if (!assignedCaseIds.isEmpty()) {
            List<MessageThread> caseThreads = threadRepository.findByCaseIdInAndOrganizationIdOrderByLastMessageAtDesc(assignedCaseIds, orgId);
            for (MessageThread thread : caseThreads) {
                if (thread.getAttorneyId() != null && thread.getAttorneyId().equals(userId)) {
                    continue;
                }
                total += thread.getUnreadByAttorney() != null ? thread.getUnreadByAttorney() : 0;
            }
        }

        return total;
    }

    @Override
    public void closeThread(Long threadId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify thread belongs to current organization
        MessageThread thread = threadRepository.findByIdAndOrganizationId(threadId, orgId)
                .orElseThrow(() -> new ApiException("Thread not found"));
        thread.setStatus(MessageThread.ThreadStatus.CLOSED);
        threadRepository.save(thread);
    }

    @Override
    @Transactional
    public void deleteThread(Long threadId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify thread belongs to current organization
        MessageThread thread = threadRepository.findByIdAndOrganizationId(threadId, orgId)
                .orElseThrow(() -> new ApiException("Thread not found"));
        // Delete all messages in the thread first (with org filtering)
        messageRepository.deleteByThreadIdAndOrganizationId(threadId, orgId);
        // Then delete the thread
        threadRepository.delete(thread);
    }

    @Override
    public ClientPortalMessageThreadDTO startThreadWithClient(Long attorneyId, Long clientId, Long caseId, String subject, String initialMessage) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Client client = clientRepository.findByIdAndOrganizationId(clientId, orgId)
                .orElseThrow(() -> new ApiException("Client not found or access denied"));

        // Validate case if provided
        if (caseId != null) {
            // SECURITY: Use tenant-filtered query
            caseRepository.findByIdAndOrganizationId(caseId, orgId)
                    .orElseThrow(() -> new ApiException("Case not found or access denied"));
        }

        // Create thread with organization context
        MessageThread thread = MessageThread.builder()
                .organizationId(orgId)
                .caseId(caseId)
                .clientId(clientId)
                .attorneyId(attorneyId)
                .subject(subject)
                .status(MessageThread.ThreadStatus.OPEN)
                .lastMessageBy("ATTORNEY")
                .unreadByClient(1)
                .unreadByAttorney(0)
                .build();
        thread = threadRepository.save(thread);

        // Create initial message with organization context
        Message message = Message.builder()
                .organizationId(orgId)
                .threadId(thread.getId())
                .senderId(attorneyId)
                .senderType(Message.SenderType.ATTORNEY)
                .content(initialMessage)
                .isRead(false)
                .build();
        message = messageRepository.save(message);

        // Update thread with message time
        thread.setLastMessageAt(message.getCreatedAt());
        threadRepository.save(thread);

        // Notify client
        notifyClientOfReply(thread, attorneyId, initialMessage);

        // Send WebSocket notification for real-time update
        sendWebSocketNotification(thread, message, "CLIENT");

        // Notify other attorneys on the case (for multi-attorney collaboration)
        notifyOtherAttorneys(thread, message, attorneyId);

        log.info("Attorney {} started new thread with client {}", attorneyId, clientId);
        return mapToThreadDTO(thread);
    }

    @Override
    public List<ClientDTO> getClientsForAttorney(Long attorneyId) {
        // Get clients filtered by organization context
        List<Client> clients = tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationId(orgId))
            .orElseThrow(() -> new ApiException("Organization context required"));

        return clients.stream()
                .map(c -> new ClientDTO(c.getId(), c.getName(), c.getEmail()))
                .collect(Collectors.toList());
    }

    private ClientPortalMessageThreadDTO mapToThreadDTO(MessageThread thread) {
        Long orgId = getRequiredOrganizationId();
        String caseNumber = null;
        if (thread.getCaseId() != null) {
            // SECURITY: Use tenant-filtered query
            LegalCase legalCase = caseRepository.findByIdAndOrganizationId(thread.getCaseId(), orgId).orElse(null);
            if (legalCase != null) caseNumber = legalCase.getCaseNumber();
        }

        String clientName = "Unknown";
        String clientPhone = null;
        String clientEmail = null;
        String clientImageUrl = null;
        // SECURITY: Use tenant-filtered query
        Client client = clientRepository.findByIdAndOrganizationId(thread.getClientId(), orgId).orElse(null);
        if (client != null) {
            clientName = client.getName();
            clientPhone = client.getPhone();
            clientEmail = client.getEmail();
            clientImageUrl = client.getImageUrl();
            // Fallback to User's imageUrl if Client's is empty
            if ((clientImageUrl == null || clientImageUrl.isEmpty()) && client.getUserId() != null) {
                User clientUser = userRepository.get(client.getUserId());
                if (clientUser != null) {
                    clientImageUrl = clientUser.getImageUrl();
                }
            }
        }

        // Get attorney info
        String attorneyName = null;
        String attorneyImageUrl = null;
        if (thread.getAttorneyId() != null) {
            User attorney = userRepository.get(thread.getAttorneyId());
            if (attorney != null) {
                attorneyName = attorney.getFirstName() + " " + attorney.getLastName();
                attorneyImageUrl = attorney.getImageUrl();
            }
        }

        // SECURITY: Use tenant-filtered query
        List<Message> messages = messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(thread.getId(), orgId);
        String lastMessage = messages.isEmpty() ? "" : messages.get(0).getContent();
        Long lastSenderId = messages.isEmpty() ? null : messages.get(0).getSenderId();
        String lastSenderType = messages.isEmpty() ? null : messages.get(0).getSenderType().name();

        // Get the actual sender name (not hardcoded "You" - frontend handles that)
        String lastSenderName = "";
        if (!messages.isEmpty()) {
            Message lastMsg = messages.get(0);
            if (lastMsg.getSenderType() == Message.SenderType.CLIENT) {
                lastSenderName = clientName;
            } else {
                // Get attorney name from senderId
                User sender = userRepository.get(lastMsg.getSenderId());
                lastSenderName = sender != null ? (sender.getFirstName() + " " + sender.getLastName()) : "Attorney";
            }
        }

        return ClientPortalMessageThreadDTO.builder()
                .id(thread.getId())
                .caseId(thread.getCaseId())
                .caseNumber(caseNumber)
                .subject(thread.getSubject())
                .channel(thread.getChannel())
                .lastMessage(lastMessage.length() > 100 ? lastMessage.substring(0, 100) + "..." : lastMessage)
                .lastSenderId(lastSenderId)
                .lastSenderName(lastSenderName)
                .lastSenderType(lastSenderType)
                .lastMessageAt(thread.getLastMessageAt())
                .unreadCount(thread.getUnreadByAttorney())
                .totalMessages(messages.size())
                .status(thread.getStatus().name())
                .clientName(clientName)
                .clientPhone(clientPhone)
                .clientEmail(clientEmail)
                .clientImageUrl(clientImageUrl)
                .attorneyName(attorneyName)
                .attorneyImageUrl(attorneyImageUrl)
                .build();
    }

    /**
     * Map thread to DTO with PER-ATTORNEY unread count.
     * This is the key fix for multi-attorney messaging:
     * Each attorney sees their own unread count, not a shared one.
     */
    private ClientPortalMessageThreadDTO mapToThreadDTOForAttorney(MessageThread thread, Long attorneyUserId) {
        Long orgId = getRequiredOrganizationId();
        String caseNumber = null;
        if (thread.getCaseId() != null) {
            // SECURITY: Use tenant-filtered query
            LegalCase legalCase = caseRepository.findByIdAndOrganizationId(thread.getCaseId(), orgId).orElse(null);
            if (legalCase != null) caseNumber = legalCase.getCaseNumber();
        }

        String clientName = "Unknown";
        String clientPhone = null;
        String clientEmail = null;
        String clientImageUrl = null;
        // SECURITY: Use tenant-filtered query
        Client client = clientRepository.findByIdAndOrganizationId(thread.getClientId(), orgId).orElse(null);
        if (client != null) {
            clientName = client.getName();
            clientPhone = client.getPhone();
            clientEmail = client.getEmail();
            clientImageUrl = client.getImageUrl();
            if ((clientImageUrl == null || clientImageUrl.isEmpty()) && client.getUserId() != null) {
                User clientUser = userRepository.get(client.getUserId());
                if (clientUser != null) {
                    clientImageUrl = clientUser.getImageUrl();
                }
            }
        }

        String attorneyName = null;
        String attorneyImageUrl = null;
        if (thread.getAttorneyId() != null) {
            User attorney = userRepository.get(thread.getAttorneyId());
            if (attorney != null) {
                attorneyName = attorney.getFirstName() + " " + attorney.getLastName();
                attorneyImageUrl = attorney.getImageUrl();
            }
        }

        // SECURITY: Use tenant-filtered query
        List<Message> messages = messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(thread.getId(), orgId);
        String lastMessage = messages.isEmpty() ? "" : messages.get(0).getContent();
        Long lastSenderId = messages.isEmpty() ? null : messages.get(0).getSenderId();
        String lastSenderType = messages.isEmpty() ? null : messages.get(0).getSenderType().name();

        String lastSenderName = "";
        if (!messages.isEmpty()) {
            Message lastMsg = messages.get(0);
            if (lastMsg.getSenderType() == Message.SenderType.CLIENT) {
                lastSenderName = clientName;
            } else {
                User sender = userRepository.get(lastMsg.getSenderId());
                lastSenderName = sender != null ? (sender.getFirstName() + " " + sender.getLastName()) : "Attorney";
            }
        }

        // CRITICAL: Get PER-ATTORNEY unread count instead of shared count
        int unreadCount = getUnreadCountForAttorney(thread.getId(), attorneyUserId, thread.getUnreadByAttorney());

        return ClientPortalMessageThreadDTO.builder()
                .id(thread.getId())
                .caseId(thread.getCaseId())
                .caseNumber(caseNumber)
                .subject(thread.getSubject())
                .channel(thread.getChannel())
                .lastMessage(lastMessage.length() > 100 ? lastMessage.substring(0, 100) + "..." : lastMessage)
                .lastSenderId(lastSenderId)
                .lastSenderName(lastSenderName)
                .lastSenderType(lastSenderType)
                .lastMessageAt(thread.getLastMessageAt())
                .unreadCount(unreadCount)  // Per-attorney count!
                .totalMessages(messages.size())
                .status(thread.getStatus().name())
                .clientName(clientName)
                .clientPhone(clientPhone)
                .clientEmail(clientEmail)
                .clientImageUrl(clientImageUrl)
                .attorneyName(attorneyName)
                .attorneyImageUrl(attorneyImageUrl)
                .build();
    }

    /**
     * Get unread count for a specific attorney on a thread.
     * Falls back to shared count if no per-attorney record exists.
     */
    private int getUnreadCountForAttorney(Long threadId, Long attorneyUserId, Integer fallbackCount) {
        Long orgId = getRequiredOrganizationId();
        return threadAttorneyStatusRepository
                .findByOrganizationIdAndThreadIdAndAttorneyUserId(orgId, threadId, attorneyUserId)
                .map(ThreadAttorneyStatus::getUnreadCount)
                .orElse(fallbackCount != null ? fallbackCount : 0);
    }

    private ClientPortalMessageDTO mapToMessageDTO(Message message) {
        String senderName = "Unknown";
        String senderImageUrl = null;

        if (message.getSenderType() == Message.SenderType.CLIENT) {
            Client client = clientRepository.findByOrganizationIdAndUserId(getRequiredOrganizationId(), message.getSenderId());
            if (client != null) {
                senderName = client.getName();
                // Get client image - try Client first, then fallback to User
                senderImageUrl = client.getImageUrl();
                if (senderImageUrl == null || senderImageUrl.trim().isEmpty()) {
                    User clientUser = userRepository.get(message.getSenderId());
                    if (clientUser != null) {
                        senderImageUrl = clientUser.getImageUrl();
                    }
                }
            }
        } else {
            User user = userRepository.get(message.getSenderId());
            if (user != null) {
                senderName = user.getFirstName() + " " + user.getLastName();
                String imgUrl = user.getImageUrl();
                senderImageUrl = (imgUrl != null && !imgUrl.trim().isEmpty()) ? imgUrl : null;
            }
        }

        return ClientPortalMessageDTO.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .senderId(message.getSenderId())
                .senderName(senderName)
                .senderImageUrl(senderImageUrl)
                .senderType(message.getSenderType().name())
                .channel(message.getChannel())
                .content(message.getContent())
                .sentAt(message.getCreatedAt())
                .isRead(Boolean.TRUE.equals(message.getIsRead()))
                .readAt(message.getReadAt())
                .hasAttachment(Boolean.TRUE.equals(message.getHasAttachment()))
                .build();
    }

    private void notifyClientOfReply(MessageThread thread, Long attorneyId, String content) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Client client = clientRepository.findByIdAndOrganizationId(thread.getClientId(), orgId).orElse(null);
        if (client == null || client.getUserId() == null) return;

        try {
            User attorney = userRepository.get(attorneyId);
            String attorneyName = attorney != null ? attorney.getFirstName() + " " + attorney.getLastName() : "Your attorney";
            String preview = content.length() > 50 ? content.substring(0, 50) + "..." : content;

            Map<String, Object> data = new HashMap<>();
            data.put("userId", client.getUserId());
            data.put("title", "New Message from " + attorneyName);
            data.put("message", preview);
            data.put("type", "ATTORNEY_MESSAGE");
            data.put("priority", "NORMAL");
            data.put("triggeredByUserId", attorneyId);
            data.put("triggeredByName", attorneyName);
            data.put("entityId", thread.getId());
            data.put("entityType", "MESSAGE_THREAD");
            data.put("url", "/client-portal/messages?threadId=" + thread.getId());

            notificationService.createUserNotification(data);
        } catch (Exception e) {
            log.error("Failed to notify client of reply: {}", e.getMessage());
        }
    }

    private void sendWebSocketNotification(MessageThread thread, Message message, String recipientType) {
        try {
            // Get sender name for the notification
            String senderName = "Unknown";
            if (message.getSenderType() == Message.SenderType.CLIENT) {
                Client client = clientRepository.findByOrganizationIdAndUserId(getRequiredOrganizationId(), message.getSenderId());
                if (client != null) senderName = client.getName();
            } else {
                User user = userRepository.get(message.getSenderId());
                if (user != null) senderName = user.getFirstName() + " " + user.getLastName();
            }

            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("type", "NEW_MESSAGE");
            wsMessage.put("threadId", thread.getId());
            wsMessage.put("messageId", message.getId());
            wsMessage.put("content", message.getContent());
            wsMessage.put("senderId", message.getSenderId());
            wsMessage.put("senderType", message.getSenderType().name());
            wsMessage.put("senderName", senderName);
            wsMessage.put("sentAt", message.getCreatedAt().toString());

            if ("CLIENT".equals(recipientType)) {
                // Notify client
                Long orgId = getRequiredOrganizationId();
                // SECURITY: Use tenant-filtered query
                Client client = clientRepository.findByIdAndOrganizationId(thread.getClientId(), orgId).orElse(null);
                if (client != null && client.getUserId() != null) {
                    webSocketHandler.sendNotificationToUser(client.getUserId().toString(), wsMessage);
                    log.debug("WebSocket notification sent to client user {}", client.getUserId());
                }
            } else {
                // Attorney sent message - client was already notified above
                // No additional action needed here
                log.debug("WebSocket notification handled for thread {}", thread.getId());
            }
        } catch (Exception e) {
            log.error("Failed to send WebSocket notification: {}", e.getMessage());
        }
    }

    /**
     * Notify all OTHER attorneys assigned to the case when a message is sent.
     * This ensures team collaboration in multi-attorney threads.
     * Also notifies the thread owner even if not in case assignments.
     */
    private void notifyOtherAttorneys(MessageThread thread, Message message, Long senderUserId) {
        try {
            // Build the WebSocket message
            String senderName = "Unknown";
            String senderImageUrl = null;
            User sender = userRepository.get(senderUserId);
            if (sender != null) {
                senderName = sender.getFirstName() + " " + sender.getLastName();
                senderImageUrl = sender.getImageUrl();
            }

            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("type", "NEW_MESSAGE");
            wsMessage.put("threadId", thread.getId());
            wsMessage.put("messageId", message.getId());
            wsMessage.put("content", message.getContent());
            wsMessage.put("senderId", message.getSenderId());
            wsMessage.put("senderType", message.getSenderType().name());
            wsMessage.put("senderName", senderName);
            wsMessage.put("senderImageUrl", senderImageUrl);
            wsMessage.put("sentAt", message.getCreatedAt().toString());

            // Collect all attorney user IDs to notify (using Set to avoid duplicates)
            java.util.Set<Long> attorneyUserIds = new java.util.HashSet<>();

            // Always include the thread owner (if not the sender)
            if (thread.getAttorneyId() != null && !thread.getAttorneyId().equals(senderUserId)) {
                attorneyUserIds.add(thread.getAttorneyId());
            }

            // Include all attorneys assigned to the case (if case exists) - SECURITY: use org-filtered query
            if (thread.getCaseId() != null && thread.getOrganizationId() != null) {
                List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(thread.getCaseId(), thread.getOrganizationId());
                for (CaseAssignment assignment : assignments) {
                    if (assignment.getAssignedTo() != null) {
                        Long attorneyUserId = assignment.getAssignedTo().getId();
                        // Don't add the sender
                        if (!attorneyUserId.equals(senderUserId)) {
                            attorneyUserIds.add(attorneyUserId);
                        }
                    }
                }
            }

            // Notify each attorney
            int notifiedCount = 0;
            for (Long attorneyUserId : attorneyUserIds) {
                try {
                    webSocketHandler.sendNotificationToUser(attorneyUserId.toString(), wsMessage);
                    notifiedCount++;
                    log.debug("WebSocket notification sent to attorney user {} for thread {}", attorneyUserId, thread.getId());
                } catch (Exception e) {
                    log.warn("Failed to send WebSocket notification to attorney {}: {}", attorneyUserId, e.getMessage());
                }
            }

            if (notifiedCount > 0) {
                log.info("Notified {} other attorney(s) of new message in thread {} from user {}",
                         notifiedCount, thread.getId(), senderUserId);
            }
        } catch (Exception e) {
            log.error("Failed to notify other attorneys for thread {}: {}", thread.getId(), e.getMessage());
        }
    }
}
