package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for SMS send requests with context information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmsRequestDTO {

    private String to;
    private String message;

    // Context for logging
    private Long userId;
    private Long clientId;
    private Long caseId;
    private Long appointmentId;

    // Template support
    private String templateCode;

    // Channel type
    @Builder.Default
    private String channel = "SMS"; // SMS, WHATSAPP

    // Sender info
    private Long sentByUserId;
    private String sentByUserName;
}
