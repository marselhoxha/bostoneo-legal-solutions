package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for active user sessions (users who logged in within a time window).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActiveSessionDTO {

    private Long userId;
    private String firstName;
    private String lastName;
    private String email;
    private Long organizationId;
    private String organizationName;
    private String device;
    private String ipAddress;
    private LocalDateTime loginTime;
}
