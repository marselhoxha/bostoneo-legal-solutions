package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for login events (success and failure) across the platform.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginEventDTO {

    private Long id;
    private Long userId;
    private String userEmail;
    private String userName;
    private Long organizationId;
    private String organizationName;
    private String device;
    private String ipAddress;
    private String eventType; // LOGIN_ATTEMPT_SUCCESS or LOGIN_ATTEMPT_FAILURE
    private LocalDateTime timestamp;
}
