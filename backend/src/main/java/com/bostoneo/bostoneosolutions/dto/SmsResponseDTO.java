package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for SMS send response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmsResponseDTO {

    private boolean success;
    private String messageSid;
    private String status;
    private String errorMessage;
    private String errorCode;
    private LocalDateTime sentAt;
    private Long communicationLogId;

    public static SmsResponseDTO success(String messageSid, String status) {
        return SmsResponseDTO.builder()
                .success(true)
                .messageSid(messageSid)
                .status(status)
                .sentAt(LocalDateTime.now())
                .build();
    }

    public static SmsResponseDTO failure(String errorMessage, String errorCode) {
        return SmsResponseDTO.builder()
                .success(false)
                .errorMessage(errorMessage)
                .errorCode(errorCode)
                .sentAt(LocalDateTime.now())
                .build();
    }

    public static SmsResponseDTO disabled() {
        return SmsResponseDTO.builder()
                .success(false)
                .errorMessage("Twilio service is not configured or disabled")
                .errorCode("SERVICE_DISABLED")
                .sentAt(LocalDateTime.now())
                .build();
    }
}
