package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for CommunicationLog entity
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommunicationLogDTO {

    private Long id;
    private Long userId;
    private Long clientId;
    private Long caseId;
    private Long appointmentId;

    private String channel;
    private String direction;
    private String toAddress;
    private String fromAddress;
    private String content;
    private String subject;
    private String status;

    private String twilioSid;
    private String errorMessage;
    private String errorCode;
    private String templateCode;

    private Long sentByUserId;
    private String sentByUserName;

    private Integer durationSeconds;
    private Double cost;
    private String costCurrency;

    private LocalDateTime createdAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime updatedAt;

    // Computed/display fields
    private String clientName;
    private String caseNumber;
    private String statusDisplay;
    private String channelIcon;
}
