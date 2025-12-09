package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageDTO;
import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageThreadDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.MessagingService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
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

    @Override
    public List<ClientPortalMessageThreadDTO> getThreadsForAttorney(Long userId) {
        List<MessageThread> threads = threadRepository.findByAttorneyIdOrderByLastMessageAtDesc(userId);
        return threads.stream().map(this::mapToThreadDTO).collect(Collectors.toList());
    }

    @Override
    public List<ClientPortalMessageThreadDTO> getThreadsByCase(Long caseId) {
        List<MessageThread> threads = threadRepository.findByCaseIdOrderByLastMessageAtDesc(caseId);
        return threads.stream().map(this::mapToThreadDTO).collect(Collectors.toList());
    }

    @Override
    public List<ClientPortalMessageDTO> getMessagesForAttorney(Long userId, Long threadId) {
        MessageThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        // Mark client messages as read
        messageRepository.markAsRead(threadId, Message.SenderType.CLIENT, LocalDateTime.now());
        thread.setUnreadByAttorney(0);
        threadRepository.save(thread);

        List<Message> messages = messageRepository.findByThreadIdOrderByCreatedAtAsc(threadId);
        return messages.stream().map(this::mapToMessageDTO).collect(Collectors.toList());
    }

    @Override
    public ClientPortalMessageDTO sendReply(Long userId, Long threadId, String content) {
        MessageThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        Message message = Message.builder()
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

        // Notify client
        notifyClientOfReply(thread, userId, content);

        // Send WebSocket notification for real-time update
        sendWebSocketNotification(thread, message, "CLIENT");

        log.info("Attorney {} replied to thread {}", userId, threadId);
        return mapToMessageDTO(message);
    }

    @Override
    public int getUnreadCount(Long userId) {
        Integer count = threadRepository.countUnreadByAttorney(userId);
        return count != null ? count : 0;
    }

    @Override
    public void closeThread(Long threadId) {
        MessageThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("Thread not found"));
        thread.setStatus(MessageThread.ThreadStatus.CLOSED);
        threadRepository.save(thread);
    }

    @Override
    public ClientPortalMessageThreadDTO startThreadWithClient(Long attorneyId, Long clientId, Long caseId, String subject, String initialMessage) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ApiException("Client not found"));

        // Validate case if provided
        if (caseId != null) {
            caseRepository.findById(caseId)
                    .orElseThrow(() -> new ApiException("Case not found"));
        }

        // Create thread
        MessageThread thread = MessageThread.builder()
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

        // Create initial message
        Message message = Message.builder()
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

        log.info("Attorney {} started new thread with client {}", attorneyId, clientId);
        return mapToThreadDTO(thread);
    }

    @Override
    public List<ClientDTO> getClientsForAttorney(Long attorneyId) {
        // Get all clients - in a real app you might filter by cases assigned to this attorney
        List<Client> clients = clientRepository.findAll();
        return clients.stream()
                .map(c -> new ClientDTO(c.getId(), c.getName(), c.getEmail()))
                .collect(Collectors.toList());
    }

    private ClientPortalMessageThreadDTO mapToThreadDTO(MessageThread thread) {
        String caseNumber = null;
        if (thread.getCaseId() != null) {
            LegalCase legalCase = caseRepository.findById(thread.getCaseId()).orElse(null);
            if (legalCase != null) caseNumber = legalCase.getCaseNumber();
        }

        String clientName = "Unknown";
        Client client = clientRepository.findById(thread.getClientId()).orElse(null);
        if (client != null) clientName = client.getName();

        List<Message> messages = messageRepository.findByThreadIdOrderByCreatedAtDesc(thread.getId());
        String lastMessage = messages.isEmpty() ? "" : messages.get(0).getContent();
        String lastSenderName = messages.isEmpty() ? "" :
                (messages.get(0).getSenderType() == Message.SenderType.CLIENT ? clientName : "You");

        return ClientPortalMessageThreadDTO.builder()
                .id(thread.getId())
                .caseId(thread.getCaseId())
                .caseNumber(caseNumber)
                .subject(thread.getSubject())
                .lastMessage(lastMessage.length() > 100 ? lastMessage.substring(0, 100) + "..." : lastMessage)
                .lastSenderName(lastSenderName)
                .lastMessageAt(thread.getLastMessageAt())
                .unreadCount(thread.getUnreadByAttorney())
                .totalMessages(messages.size())
                .status(thread.getStatus().name())
                .clientName(clientName)
                .build();
    }

    private ClientPortalMessageDTO mapToMessageDTO(Message message) {
        String senderName = "Unknown";
        if (message.getSenderType() == Message.SenderType.CLIENT) {
            Client client = clientRepository.findByUserId(message.getSenderId());
            if (client != null) senderName = client.getName();
        } else {
            User user = userRepository.get(message.getSenderId());
            if (user != null) senderName = user.getFirstName() + " " + user.getLastName();
        }

        return ClientPortalMessageDTO.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .senderName(senderName)
                .senderType(message.getSenderType().name())
                .content(message.getContent())
                .sentAt(message.getCreatedAt())
                .isRead(message.getIsRead())
                .hasAttachment(Boolean.TRUE.equals(message.getHasAttachment()))
                .build();
    }

    private void notifyClientOfReply(MessageThread thread, Long attorneyId, String content) {
        Client client = clientRepository.findById(thread.getClientId()).orElse(null);
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
            Long recipientUserId = null;
            if ("CLIENT".equals(recipientType)) {
                Client client = clientRepository.findById(thread.getClientId()).orElse(null);
                if (client != null) recipientUserId = client.getUserId();
            } else {
                recipientUserId = thread.getAttorneyId();
            }

            if (recipientUserId == null) return;

            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("type", "NEW_MESSAGE");
            wsMessage.put("threadId", thread.getId());
            wsMessage.put("messageId", message.getId());
            wsMessage.put("content", message.getContent());
            wsMessage.put("senderType", message.getSenderType().name());
            wsMessage.put("sentAt", message.getCreatedAt().toString());

            webSocketHandler.sendNotificationToUser(recipientUserId.toString(), wsMessage);
            log.debug("WebSocket notification sent to user {}", recipientUserId);
        } catch (Exception e) {
            log.error("Failed to send WebSocket notification: {}", e.getMessage());
        }
    }
}
