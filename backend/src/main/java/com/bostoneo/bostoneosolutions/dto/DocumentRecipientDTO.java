package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for resolved document request recipient.
 * Contains contact information resolved from various sources
 * based on document type.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DocumentRecipientDTO {

    // Recipient identification
    private String recipientType; // MEDICAL_PROVIDER, BILLING_DEPT, INSURANCE_ADJUSTER, EMPLOYER_HR, POLICE_DEPT, CLIENT, WITNESS
    private String recipientName;
    private String recipientSource; // MEDICAL_RECORD, CASE_DATA, PROVIDER_DIRECTORY, MANUAL

    // Contact methods (at least one should be available)
    private String email;
    private String phone;
    private String fax;

    // Available channels based on contact info
    private List<String> availableChannels; // EMAIL, SMS, FAX

    // Source reference (for linking back)
    private Long sourceId; // e.g., medicalRecordId, providerId
    private String sourceName; // e.g., provider name

    // Document context
    private String documentType;
    private String documentSubtype;

    // Provider directory info (if from directory)
    private Long providerDirectoryId;

    // Suggested template
    private String suggestedTemplateCode;

    // Resolution status
    private Boolean resolved;
    private String resolutionMessage; // e.g., "Contact resolved from medical record", "Manual entry required"

    /**
     * Check if email channel is available
     */
    public boolean hasEmail() {
        return email != null && !email.trim().isEmpty();
    }

    /**
     * Check if SMS channel is available
     */
    public boolean hasPhone() {
        return phone != null && !phone.trim().isEmpty();
    }

    /**
     * Check if fax channel is available
     */
    public boolean hasFax() {
        return fax != null && !fax.trim().isEmpty();
    }
}
