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
    private String lastMessage;
    private String lastSenderName;
    private LocalDateTime lastMessageAt;
    private int unreadCount;
    private int totalMessages;
    private String status; // OPEN, CLOSED
}
