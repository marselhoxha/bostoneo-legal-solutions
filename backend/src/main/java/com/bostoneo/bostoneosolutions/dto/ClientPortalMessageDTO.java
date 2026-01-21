package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientPortalMessageDTO {
    private Long id;
    private Long threadId;
    private Long senderId; // User ID who sent the message (for identifying sender in multi-attorney threads)
    private String senderName;
    private String senderImageUrl; // Profile image URL of the sender
    private String senderType; // CLIENT, ATTORNEY, STAFF
    private String channel; // SMS, PORTAL, EMAIL
    private String content;
    private LocalDateTime sentAt;

    @JsonProperty("isRead")
    private boolean isRead;

    private LocalDateTime readAt;

    @JsonProperty("hasAttachment")
    private boolean hasAttachment;

    private String attachmentName;
}
