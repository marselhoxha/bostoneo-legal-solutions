package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO for sending a document request.
 * Contains recipient info, communication channel, and message content.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SendDocumentRequestDTO {

    // Recipient info
    @NotBlank(message = "Recipient type is required")
    private String recipientType;

    private String recipientName;

    private String recipientEmail;

    private String recipientPhone;

    private String recipientFax;

    // Communication channel
    @NotBlank(message = "Communication channel is required")
    private String channel; // EMAIL, SMS, FAX, IN_APP

    // Template selection
    private Long templateId;
    private String templateCode;

    // Custom message (overrides template if provided)
    private String customSubject;
    private String customBody;

    // Template variable values
    private String clientName;
    private String clientDob;
    private String treatmentDates;
    private String accidentDate;
    private String claimNumber;
    private String adjusterName;
    private String accountNumber;
    private String reportNumber;
    private String accidentLocation;
    private String defendantName;
    private String witnessName;
    private String requestedDocuments;
    private String reportFee;

    // Cost tracking
    private BigDecimal documentFee;

    // Provider directory reference (to save contact for future use)
    private Boolean saveToDirectory;
    private Long providerDirectoryId;

    // Scheduling (future use)
    private Boolean scheduleFollowUp;
    private Integer followUpDays;
}
