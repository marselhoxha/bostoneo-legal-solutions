package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_NULL)
public class SignatureTemplateDTO {

    private Long id;
    private Long organizationId;
    private String boldsignTemplateId;

    private String name;
    private String description;
    private String category;

    private String fileName;
    private String fileUrl;
    private String fieldConfig;

    private Integer defaultExpiryDays;
    private Boolean defaultReminderEmail;
    private Boolean defaultReminderSms;

    private Boolean isActive;
    private Boolean isGlobal;

    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
