package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for failed login details.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FailedLoginDTO {

    private Long id;
    private String userEmail;
    private String userName;
    private Long organizationId;
    private String organizationName;
    private String ipAddress;
    private String userAgent;
    private String failureReason;
    private Integer attemptCount;
    private LocalDateTime timestamp;
}
