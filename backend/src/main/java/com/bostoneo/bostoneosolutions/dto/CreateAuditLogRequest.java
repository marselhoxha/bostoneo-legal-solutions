package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.*;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class CreateAuditLogRequest {

    private Long userId;
    private String sessionId;
    private String action;
    private String entityType;
    private Long entityId;
    private String description;
    private String metadata;
    
    // Optional fields that can be auto-populated
    private String ipAddress;
    private String userAgent;
} 