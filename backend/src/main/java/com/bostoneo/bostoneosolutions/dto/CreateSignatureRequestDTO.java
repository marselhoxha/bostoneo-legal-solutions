package com.bostoneo.bostoneosolutions.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSignatureRequestDTO {

    @NotNull(message = "Organization ID is required")
    private Long organizationId;

    // Optional references
    private Long caseId;
    private Long clientId;
    private Long documentId;
    private Long templateId;

    // Request details
    @NotBlank(message = "Title is required")
    private String title;

    private String message;

    // File (either upload or from template)
    private String fileName;
    private String fileUrl;
    private String fileBase64; // For direct file upload

    // Primary signer
    @NotBlank(message = "Signer name is required")
    private String signerName;

    @NotBlank(message = "Signer email is required")
    @Email(message = "Invalid signer email")
    private String signerEmail;

    private String signerPhone;

    // Additional signers
    private List<SignerInput> additionalSigners;

    // Reminder settings
    @Builder.Default
    private Boolean reminderEmail = true;

    @Builder.Default
    private Boolean reminderSms = true;

    @Builder.Default
    private Boolean reminderWhatsapp = false;

    // Expiry
    private Integer expiryDays;

    // Send immediately or save as draft
    @Builder.Default
    private Boolean sendImmediately = true;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignerInput {
        @NotBlank(message = "Signer name is required")
        private String name;

        @NotBlank(message = "Signer email is required")
        @Email(message = "Invalid signer email")
        private String email;

        private String phone;
        private Integer order;
    }
}
