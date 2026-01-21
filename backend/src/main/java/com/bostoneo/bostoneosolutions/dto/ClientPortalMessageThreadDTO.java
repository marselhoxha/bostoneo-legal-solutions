package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientPortalMessageThreadDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String subject;
    private String channel; // SMS, PORTAL, EMAIL
    private String lastMessage;
    private Long lastSenderId; // User ID of the last message sender (for multi-attorney identification)
    private String lastSenderName;
    private String lastSenderType; // CLIENT, ATTORNEY
    private LocalDateTime lastMessageAt;
    private int unreadCount;
    private int totalMessages;
    private String status; // OPEN, CLOSED
    private String clientName; // For attorney view
    private String clientPhone; // For SMS reply
    private String clientEmail; // For email/display
    private String clientImageUrl; // Profile image URL
    private String attorneyName; // For client view - "Your Legal Team" if multiple attorneys
    private String attorneyImageUrl; // Profile image URL
    private int attorneyCount; // Number of attorneys assigned to case
}
