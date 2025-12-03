package com.bostoneo.bostoneosolutions.dto;

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
    private String senderName;
    private String senderType; // CLIENT, ATTORNEY, STAFF
    private String content;
    private LocalDateTime sentAt;
    private boolean isRead;
    private boolean hasAttachment;
    private String attachmentName;
}
