package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.SignatureStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_NULL)
public class SignatureRequestDTO {

    private Long id;
    private Long organizationId;
    private String boldsignDocumentId;

    // Internal references
    private Long caseId;
    private String caseName;
    private Long clientId;
    private String clientName;
    private Long documentId;

    // Request details
    private String title;
    private String message;
    private String fileName;
    private String fileUrl;

    // Status
    private SignatureStatus status;
    private String statusDisplay;

    // Primary signer
    private String signerName;
    private String signerEmail;
    private String signerPhone;

    // Additional signers
    private List<SignerDTO> additionalSigners;

    // Reminder settings
    private Boolean reminderEmail;
    private Boolean reminderSms;
    private Boolean reminderWhatsapp;
    private LocalDateTime lastReminderSentAt;
    private Integer reminderCount;

    // Timing
    private LocalDateTime expiresAt;
    private LocalDateTime sentAt;
    private LocalDateTime viewedAt;
    private LocalDateTime signedAt;
    private LocalDateTime completedAt;
    private LocalDateTime declinedAt;
    private String declineReason;

    // Tracking
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Signed document
    private String signedDocumentUrl;
    private String embeddedSigningUrl;

    // Helper fields for UI
    private Integer daysUntilExpiry;
    private Boolean canSendReminder;
    private Boolean isPending;
    private Boolean isCompleted;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignerDTO {
        private String name;
        private String email;
        private String phone;
        private Integer order;
        private String status;
        private LocalDateTime signedAt;
    }
}
