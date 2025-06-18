package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.time.LocalDateTime;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class AuditLogDTO {

    private Long id;
    private Long userId;
    private String sessionId;
    private String action;
    private String entityType;
    private Long entityId;
    private String description;
    private String metadata;
    private String ipAddress;
    private String userAgent;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;
    
    // Additional fields for enhanced display
    private String userName;
    private String userEmail;
    private String formattedTimestamp;
    private String actionDisplayName;
    private String entityDisplayName;
} 
 
 
 
 
 
 