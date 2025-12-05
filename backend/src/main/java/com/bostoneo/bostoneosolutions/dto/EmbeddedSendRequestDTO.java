package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmbeddedSendRequestDTO {
    private Long organizationId;
    private String title;
    private String signerName;
    private String signerEmail;
    private String message;
    private String fileName;
    private String fileBase64;
    private String redirectUrl;
    private Boolean showToolbar;
    private Boolean showSaveButton;
    private Boolean showSendButton;
    private Boolean showPreviewButton;
    private Boolean showNavigationButtons;
    private String sendViewOption;
    private String locale;
    private Long clientId;
    private String caseId;
}
