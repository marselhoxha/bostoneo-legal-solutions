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
public class ClientPortalActivityDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String activityType; // DOCUMENT_UPLOADED, STATUS_CHANGED, MESSAGE_RECEIVED, etc.
    private String title;
    private String description;
    private LocalDateTime timestamp;
    private String performedBy;
}
