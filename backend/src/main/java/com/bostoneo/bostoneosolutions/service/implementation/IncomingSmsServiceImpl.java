package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.IncomingSmsDTO;
import com.bostoneo.bostoneosolutions.handler.AuthenticatedWebSocketHandler;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.CommunicationLogRepository;
import com.bostoneo.bostoneosolutions.repository.MessageThreadRepository;
import com.bostoneo.bostoneosolutions.service.IncomingSmsService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service implementation for processing incoming SMS messages from clients.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IncomingSmsServiceImpl implements IncomingSmsService {

    private final NamedParameterJdbcTemplate jdbc;
    private final MessageThreadRepository messageThreadRepository;
    private final CommunicationLogRepository communicationLogRepository;
    private final NotificationService notificationService;
    private final AuthenticatedWebSocketHandler webSocketHandler;

    @Override
    @Transactional
    public CommunicationLog processIncomingSms(IncomingSmsDTO incomingSms) {
        log.info("Processing incoming SMS from: {}", maskPhone(incomingSms.getFrom()));

        // 1. Find the client by phone number
        Long clientId = findClientByPhone(incomingSms.getNormalizedFrom());

        if (clientId == null) {
            log.warn("No client found for phone number: {}", maskPhone(incomingSms.getFrom()));
            // Still log the communication even if we can't match a client
            return logUnmatchedSms(incomingSms);
        }

        log.info("Matched incoming SMS to client ID: {}", clientId);

        // 2. Get the primary case for this client
        Long caseId = getPrimaryCaseForClient(clientId);

        // 3. Find or create a message thread for SMS communications
        MessageThread thread = findOrCreateSmsThread(clientId, caseId);

        // 4. Create a message in the thread
        ClientPortalMessage message = createMessageFromSms(incomingSms, thread, clientId);

        // 5. Log the communication
        CommunicationLog commLog = logIncomingSms(incomingSms, clientId, caseId, thread.getId());

        // 6. Notify the assigned attorney
        notifyAttorney(thread, incomingSms, clientId, caseId);

        log.info("Successfully processed incoming SMS. Thread ID: {}, Message ID: {}",
                thread.getId(), message.getId());

        return commLog;
    }

    @Override
    public Long findClientByPhone(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            return null;
        }

        // Normalize phone number - try different formats
        String normalized = normalizePhoneNumber(phoneNumber);

        String sql = """
            SELECT id FROM clients
            WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '')
                  LIKE CONCAT('%', :phoneDigits)
            OR phone = :phone
            OR phone = :normalizedPhone
            LIMIT 1
            """;

        Map<String, Object> params = new HashMap<>();
        params.put("phone", phoneNumber);
        params.put("normalizedPhone", normalized);
        params.put("phoneDigits", extractDigits(phoneNumber).substring(Math.max(0, extractDigits(phoneNumber).length() - 10)));

        try {
            List<Long> results = jdbc.query(sql, params, (rs, rowNum) -> rs.getLong("id"));
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            log.error("Error finding client by phone: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public Long getPrimaryCaseForClient(Long clientId) {
        if (clientId == null) return null;

        // Get the most recent active case for this client
        String sql = """
            SELECT id FROM legal_cases
            WHERE client_id = :clientId
            AND status IN ('OPEN', 'ACTIVE', 'IN_PROGRESS', 'PENDING')
            ORDER BY created_at DESC
            LIMIT 1
            """;

        Map<String, Object> params = Map.of("clientId", clientId);

        try {
            List<Long> results = jdbc.query(sql, params, (rs, rowNum) -> rs.getLong("id"));
            if (results.isEmpty()) {
                // No active case, get the most recent case
                sql = """
                    SELECT id FROM legal_cases
                    WHERE client_id = :clientId
                    ORDER BY created_at DESC
                    LIMIT 1
                    """;
                results = jdbc.query(sql, params, (rs, rowNum) -> rs.getLong("id"));
            }
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            log.error("Error getting primary case for client: {}", e.getMessage());
            return null;
        }
    }

    private MessageThread findOrCreateSmsThread(Long clientId, Long caseId) {
        // Look for an existing SMS thread for this client
        String sql = """
            SELECT * FROM message_threads
            WHERE client_id = :clientId
            AND subject LIKE '%SMS%'
            AND status = 'OPEN'
            ORDER BY updated_at DESC
            LIMIT 1
            """;

        Map<String, Object> params = new HashMap<>();
        params.put("clientId", clientId);

        List<MessageThread> threads = jdbc.query(sql, params, (rs, rowNum) -> {
            MessageThread t = new MessageThread();
            t.setId(rs.getLong("id"));
            t.setCaseId(rs.getLong("case_id"));
            t.setClientId(rs.getLong("client_id"));
            t.setAttorneyId(rs.getLong("attorney_id"));
            t.setSubject(rs.getString("subject"));
            t.setStatus(MessageThread.ThreadStatus.valueOf(rs.getString("status")));
            return t;
        });

        if (!threads.isEmpty()) {
            MessageThread thread = threads.get(0);
            // Update the thread timestamp
            updateThreadTimestamp(thread.getId(), "CLIENT");
            return thread;
        }

        // Create a new SMS thread
        return createNewSmsThread(clientId, caseId);
    }

    private MessageThread createNewSmsThread(Long clientId, Long caseId) {
        // Get client name for the subject
        String clientName = getClientName(clientId);

        // Get the lead attorney for this case (if any)
        Long attorneyId = getLeadAttorneyForCase(caseId);

        MessageThread thread = MessageThread.builder()
                .caseId(caseId != null ? caseId : 0L)
                .clientId(clientId)
                .attorneyId(attorneyId)
                .subject("SMS Conversation with " + (clientName != null ? clientName : "Client"))
                .status(MessageThread.ThreadStatus.OPEN)
                .build();

        return messageThreadRepository.save(thread);
    }

    private ClientPortalMessage createMessageFromSms(IncomingSmsDTO sms, MessageThread thread, Long clientId) {
        String sql = """
            INSERT INTO messages
            (thread_id, sender_type, sender_id, channel, content, created_at, is_read)
            VALUES (:threadId, 'CLIENT', :senderId, 'SMS', :content, NOW(), 0)
            """;

        Map<String, Object> params = new HashMap<>();
        params.put("threadId", thread.getId());
        params.put("senderId", clientId);
        params.put("content", sms.getBody());

        jdbc.update(sql, params);

        // Get the inserted message ID
        Long messageId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Map.of(), Long.class);

        // Update thread's unread count and channel
        String updateSql = """
            UPDATE message_threads
            SET unread_by_attorney = unread_by_attorney + 1,
                last_message_at = NOW(),
                last_message_by = 'CLIENT',
                channel = 'SMS',
                updated_at = NOW()
            WHERE id = :threadId
            """;
        jdbc.update(updateSql, Map.of("threadId", thread.getId()));

        ClientPortalMessage message = new ClientPortalMessage();
        message.setId(messageId);
        message.setThreadId(thread.getId());
        message.setContent(sms.getBody());
        return message;
    }

    private void updateThreadTimestamp(Long threadId, String lastMessageBy) {
        String sql = """
            UPDATE message_threads
            SET updated_at = NOW(),
                last_message_at = NOW(),
                last_message_by = :lastMessageBy,
                unread_by_attorney = unread_by_attorney + 1
            WHERE id = :threadId
            """;
        jdbc.update(sql, Map.of("threadId", threadId, "lastMessageBy", lastMessageBy));
    }

    private CommunicationLog logIncomingSms(IncomingSmsDTO sms, Long clientId, Long caseId, Long threadId) {
        CommunicationLog commLog = CommunicationLog.builder()
                .channel("SMS")
                .direction("INBOUND")
                .clientId(clientId)
                .caseId(caseId)
                .fromAddress(sms.getFrom())
                .toAddress(sms.getTo())
                .content(sms.getBody())
                .twilioSid(sms.getMessageSid())
                .status("RECEIVED")
                .createdAt(LocalDateTime.now())
                .build();

        return communicationLogRepository.save(commLog);
    }

    private CommunicationLog logUnmatchedSms(IncomingSmsDTO sms) {
        CommunicationLog commLog = CommunicationLog.builder()
                .channel("SMS")
                .direction("INBOUND")
                .fromAddress(sms.getFrom())
                .toAddress(sms.getTo())
                .content(sms.getBody())
                .twilioSid(sms.getMessageSid())
                .status("RECEIVED_UNMATCHED")
                .createdAt(LocalDateTime.now())
                .build();

        return communicationLogRepository.save(commLog);
    }

    private void notifyAttorney(MessageThread thread, IncomingSmsDTO sms, Long clientId, Long caseId) {
        try {
            Long attorneyId = thread.getAttorneyId();
            if (attorneyId == null && caseId != null) {
                attorneyId = getLeadAttorneyForCase(caseId);
            }

            String clientName = getClientName(clientId);
            String caseNumber = getCaseNumber(caseId);

            if (attorneyId != null) {
                // Send in-app notification using CRM notification method
                Map<String, Object> notificationData = new HashMap<>();
                notificationData.put("threadId", thread.getId().toString());
                notificationData.put("clientId", clientId.toString());
                if (caseId != null) {
                    notificationData.put("caseId", caseId.toString());
                }
                if (caseNumber != null) {
                    notificationData.put("caseNumber", caseNumber);
                }

                notificationService.sendCrmNotification(
                        "New SMS from " + (clientName != null ? clientName : "Client"),
                        "SMS Message: " + truncate(sms.getBody(), 100),
                        attorneyId,
                        "NEW_SMS",
                        notificationData
                );

                log.info("Sent notification to attorney {} for incoming SMS", attorneyId);
            }

            // Send WebSocket notification to all assigned attorneys for real-time update
            sendWebSocketNotificationToAttorneys(thread, sms, clientId, clientName);

        } catch (Exception e) {
            log.error("Error notifying attorney of incoming SMS: {}", e.getMessage());
        }
    }

    /**
     * Send WebSocket notification to all attorneys assigned to the case
     * This enables real-time message updates without requiring page refresh
     */
    private void sendWebSocketNotificationToAttorneys(MessageThread thread, IncomingSmsDTO sms, Long clientId, String clientName) {
        try {
            // Get the client's user ID for senderId
            Long clientUserId = getClientUserId(clientId);

            // Build WebSocket message matching the format expected by frontend
            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("type", "NEW_MESSAGE");
            wsMessage.put("threadId", thread.getId());
            wsMessage.put("content", sms.getBody());
            wsMessage.put("senderId", clientUserId);
            wsMessage.put("senderType", "CLIENT");
            wsMessage.put("senderName", clientName != null ? clientName : "Client");
            wsMessage.put("sentAt", LocalDateTime.now().toString());
            wsMessage.put("channel", "SMS");

            // Get all attorney user IDs for this thread
            List<Long> attorneyUserIds = getAttorneyUserIdsForThread(thread);

            int notifiedCount = 0;
            for (Long attorneyUserId : attorneyUserIds) {
                try {
                    webSocketHandler.sendNotificationToUser(attorneyUserId.toString(), wsMessage);
                    notifiedCount++;
                    log.debug("WebSocket notification sent to attorney user {} for SMS in thread {}",
                              attorneyUserId, thread.getId());
                } catch (Exception e) {
                    log.warn("Failed to send WebSocket notification to attorney {}: {}",
                             attorneyUserId, e.getMessage());
                }
            }

            log.info("Sent WebSocket SMS notifications to {}/{} attorneys for thread {}",
                     notifiedCount, attorneyUserIds.size(), thread.getId());

        } catch (Exception e) {
            log.error("Failed to send WebSocket notification for incoming SMS: {}", e.getMessage());
        }
    }

    /**
     * Get all attorney user IDs for a thread (thread owner + case assignments)
     */
    private List<Long> getAttorneyUserIdsForThread(MessageThread thread) {
        List<Long> attorneyUserIds = new ArrayList<>();

        // 1. Thread owner (attorney_id)
        if (thread.getAttorneyId() != null) {
            attorneyUserIds.add(thread.getAttorneyId());
        }

        // 2. Case-assigned attorneys
        if (thread.getCaseId() != null && thread.getCaseId() > 0) {
            try {
                String sql = """
                    SELECT user_id FROM case_assignments
                    WHERE case_id = :caseId
                    AND is_active = true
                    AND user_id IS NOT NULL
                    """;
                List<Long> caseAttorneys = jdbc.query(sql,
                    Map.of("caseId", thread.getCaseId()),
                    (rs, rowNum) -> rs.getLong("user_id"));

                for (Long userId : caseAttorneys) {
                    if (!attorneyUserIds.contains(userId)) {
                        attorneyUserIds.add(userId);
                    }
                }
            } catch (Exception e) {
                log.debug("Error getting case-assigned attorneys: {}", e.getMessage());
            }
        }

        return attorneyUserIds;
    }

    /**
     * Get the user ID for a client (clients are linked to user accounts)
     */
    private Long getClientUserId(Long clientId) {
        if (clientId == null) return null;
        try {
            return jdbc.queryForObject(
                    "SELECT user_id FROM clients WHERE id = :clientId",
                    Map.of("clientId", clientId),
                    Long.class
            );
        } catch (Exception e) {
            log.debug("Error getting client user ID: {}", e.getMessage());
            return null;
        }
    }

    // Helper methods

    private String getClientName(Long clientId) {
        if (clientId == null) return null;
        try {
            return jdbc.queryForObject(
                    "SELECT name FROM clients WHERE id = :clientId",
                    Map.of("clientId", clientId),
                    String.class
            );
        } catch (Exception e) {
            return null;
        }
    }

    private String getCaseNumber(Long caseId) {
        if (caseId == null) return null;
        try {
            return jdbc.queryForObject(
                    "SELECT case_number FROM legal_cases WHERE id = :caseId",
                    Map.of("caseId", caseId),
                    String.class
            );
        } catch (Exception e) {
            return null;
        }
    }

    private Long getLeadAttorneyForCase(Long caseId) {
        if (caseId == null) return null;
        try {
            String sql = """
                SELECT user_id FROM case_assignments
                WHERE case_id = :caseId
                AND role_type IN ('LEAD_ATTORNEY', 'ATTORNEY', 'OWNER')
                AND status = 'ACTIVE'
                ORDER BY FIELD(role_type, 'LEAD_ATTORNEY', 'OWNER', 'ATTORNEY')
                LIMIT 1
                """;
            List<Long> results = jdbc.query(sql, Map.of("caseId", caseId),
                    (rs, rowNum) -> rs.getLong("user_id"));
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            log.debug("Error getting lead attorney: {}", e.getMessage());
            return null;
        }
    }

    private String normalizePhoneNumber(String phone) {
        if (phone == null) return null;
        // Remove all non-digit characters
        String digits = extractDigits(phone);
        // If it's a 10-digit US number, add +1
        if (digits.length() == 10) {
            return "+1" + digits;
        }
        // If it starts with 1 and is 11 digits, add +
        if (digits.length() == 11 && digits.startsWith("1")) {
            return "+" + digits;
        }
        return phone;
    }

    private String extractDigits(String phone) {
        if (phone == null) return "";
        return phone.replaceAll("[^0-9]", "");
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "***" + phone.substring(phone.length() - 4);
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return "";
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }

    // Inner class for message representation
    private static class ClientPortalMessage {
        private Long id;
        private Long threadId;
        private String content;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getThreadId() { return threadId; }
        public void setThreadId(Long threadId) { this.threadId = threadId; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
