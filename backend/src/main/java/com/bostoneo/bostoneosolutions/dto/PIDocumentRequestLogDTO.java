package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO for PI Document Request Log
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIDocumentRequestLogDTO {

    private Long id;
    private Long checklistItemId;
    private Long caseId;
    private Long organizationId;

    // Recipient Info
    private String recipientType;
    private String recipientName;
    private String recipientEmail;
    private String recipientPhone;
    private String recipientFax;

    // Communication Info
    private String channel;
    private String channelStatus;
    private String externalMessageId;

    // Template Info
    private Long templateId;
    private String templateCode;
    private String templateName;
    private String requestSubject;
    private String requestBody;

    // Cost Tracking
    private BigDecimal documentFee;
    private String feeStatus;

    // Metadata
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime sentAt;

    private Long sentBy;
    private String sentByName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    // Computed fields
    private String documentTypeName;
    private String documentSubtype;
}
