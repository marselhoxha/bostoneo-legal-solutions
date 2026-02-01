package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for PI Document Request Templates
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIDocumentRequestTemplateDTO {

    private Long id;
    private Long organizationId;

    private String templateCode;
    private String templateName;
    private String documentType;
    private String recipientType;

    // Email Template
    private String emailSubject;
    private String emailBody;

    // SMS Template
    private String smsBody;

    // Metadata
    private Boolean isActive;
    private Boolean isSystem;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    // Preview fields (populated with template variables replaced)
    private String previewSubject;
    private String previewBody;
}
