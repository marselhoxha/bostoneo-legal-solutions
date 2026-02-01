package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for sending bulk document requests.
 * Allows requesting multiple documents at once.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BulkDocumentRequestDTO {

    @NotEmpty(message = "At least one checklist item ID is required")
    private List<Long> checklistItemIds;

    // Default channel for all requests (can be overridden per item)
    private String defaultChannel; // EMAIL, SMS

    // Per-item overrides (optional)
    private List<SendDocumentRequestDTO> itemOverrides;

    // Response tracking
    private Integer totalItems;
    private Integer successCount;
    private Integer failedCount;
    private List<BulkRequestResultDTO> results;

    /**
     * Result for each item in the bulk request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BulkRequestResultDTO {
        private Long checklistItemId;
        private String documentType;
        private String documentSubtype;
        private Boolean success;
        private String channel;
        private String recipientName;
        private String recipientEmail;
        private String errorMessage;
        private Long requestLogId;
    }
}
