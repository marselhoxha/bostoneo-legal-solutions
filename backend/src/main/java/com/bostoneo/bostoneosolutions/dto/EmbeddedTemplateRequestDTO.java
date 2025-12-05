package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmbeddedTemplateRequestDTO {
    private Long organizationId;
    private String title;
    private String description;
    private String category;
    private String fileName;
    private String fileBase64;
    private String redirectUrl;
    private Boolean showToolbar;
    private Boolean showSaveButton;
    private Boolean showSendButton;
    private Boolean showPreviewButton;
    private String viewOption;
    private String locale;
}
