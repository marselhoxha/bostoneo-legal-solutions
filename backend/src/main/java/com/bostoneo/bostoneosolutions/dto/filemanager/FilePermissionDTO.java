package com.***REMOVED***.***REMOVED***solutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FilePermissionDTO {
    private Long id;
    private Long fileId;
    private Long userId;
    private String userName;
    private String userEmail;
    private String permissionType;
    private LocalDateTime grantedAt;
    private Long grantedById;
    private String grantedByName;
    private LocalDateTime expiresAt;
    private String notes;
}