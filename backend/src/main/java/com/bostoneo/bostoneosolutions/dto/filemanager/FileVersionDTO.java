package com.bostoneo.bostoneosolutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileVersionDTO {
    private Long id;
    private Long fileId;
    private String versionNumber;
    private String fileName;
    private Long size;
    private Long fileSize;
    private String formattedSize;
    private String mimeType;
    private Long uploadedById;
    private String uploadedByName;
    private LocalDateTime uploadedAt;
    private String comment;
    private Boolean current;
    private Boolean isCurrent;
    private String downloadUrl;
}