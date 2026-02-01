package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for bulk request preview response.
 * Contains analysis of selected items before sending.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BulkRequestPreviewDTO {

    // Summary counts
    private Integer totalItems;
    private Integer resolvedCount;
    private Integer unresolvedCount;

    // Groups of items by recipient (for consolidated sending)
    private List<RecipientGroup> recipientGroups;

    // Items that need manual recipient entry
    private List<UnresolvedItem> unresolvedItems;

    // Any warnings (e.g., "2 items already requested today")
    private List<String> warnings;

    /**
     * A group of checklist items that share the same recipient.
     * Multiple documents to the same provider = one email.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecipientGroup {
        // Unique key for this group (TYPE|NAME|EMAIL|PHONE)
        private String groupKey;

        // Recipient details
        private String recipientType;
        private String recipientName;
        private String email;
        private String phone;
        private String fax;

        // Available/suggested channels
        private List<String> availableChannels;
        private String suggestedChannel;

        // Items in this group
        private List<GroupedChecklistItem> items;

        // Provider directory ID if resolved from directory
        private Long providerDirectoryId;

        // Source of recipient info
        private String recipientSource;
    }

    /**
     * A checklist item within a recipient group.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GroupedChecklistItem {
        private Long checklistItemId;
        private String documentType;
        private String documentSubtype;
        private String providerName;
        private String notes;
        private Boolean alreadyRequested;
        private String lastRequestedDate;
        private Integer requestCount;
    }

    /**
     * An item that couldn't be automatically resolved.
     * Needs manual recipient entry.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UnresolvedItem {
        private Long checklistItemId;
        private String documentType;
        private String documentSubtype;
        private String providerName;
        private String recipientType;
        private String resolutionMessage;

        // Partial info if any is available
        private String suggestedName;
        private String suggestedTemplateCode;
    }
}
