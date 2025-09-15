package com.bostoneo.bostoneosolutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareFileRequestDTO {
    @NotEmpty(message = "User IDs are required")
    private List<Long> userIds;
    
    @NotEmpty(message = "Permissions are required")
    private List<String> permissions;
    
    private LocalDateTime expiresAt;
    private String notes;
    private Long sharedWithUserId;
    private String sharedWithEmail;
    private String shareType;
    private String accessLevel;
    private Integer maxDownloads;
    private String message;
}