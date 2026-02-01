package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * DTO for submitting confirmed bulk requests.
 * Includes user overrides for unresolved items and channel selections.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BulkRequestSubmitDTO {

    @NotEmpty(message = "At least one checklist item ID is required")
    private List<Long> checklistItemIds;

    // Items to skip (user chose not to send)
    private List<Long> skipItemIds;

    // Manual recipient overrides for unresolved items
    private List<RecipientOverride> recipientOverrides;

    // Channel overrides per group key (default is EMAIL)
    // Key: groupKey, Value: channel (EMAIL, SMS, FAX)
    private Map<String, String> channelOverrides;

    // Default channel if no override specified
    private String defaultChannel;

    // Save new contacts to provider directory
    private Boolean saveNewContacts;

    /**
     * Manual recipient override for an unresolved item.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecipientOverride {
        private Long checklistItemId;
        private String recipientName;
        private String email;
        private String phone;
        private String fax;
        private String recipientType;

        // Optional: save this contact to provider directory
        private Boolean saveToDirectory;
        private String providerDirectoryName; // If different from recipientName
    }

    /**
     * Response DTO for confirmed bulk send.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BulkSendResult {
        private Integer totalItems;
        private Integer sentCount;
        private Integer skippedCount;
        private Integer failedCount;

        // Number of actual communications sent (grouped)
        private Integer emailsSent;
        private Integer smsSent;

        // Results per group
        private List<GroupSendResult> groupResults;

        // Any errors
        private List<String> errors;
    }

    /**
     * Result for a single recipient group.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GroupSendResult {
        private String groupKey;
        private String recipientName;
        private String channel;
        private Boolean success;
        private String errorMessage;
        private List<Long> checklistItemIds;
        private Long requestLogId;
    }
}
