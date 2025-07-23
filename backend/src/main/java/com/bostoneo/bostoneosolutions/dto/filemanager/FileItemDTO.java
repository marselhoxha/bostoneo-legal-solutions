package com.***REMOVED***.***REMOVED***solutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileItemDTO {
    private Long id;
    private String name;
    private String originalName;
    private Long size;
    private String formattedSize;
    private String mimeType;
    private String extension;
    private String icon;
    private String iconColor;
    private String fileType;
    private Long folderId;
    private String folderName;
    private String folderPath;
    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Boolean starred;
    private Boolean deleted;
    private LocalDateTime deletedAt;
    private String downloadUrl;
    private String previewUrl;
    private String description;
    private Integer version;
    private Boolean encrypted;
    private String documentCategory;
    private String documentStatus;
    private String practiceArea;
    private Long caseId;
    private String caseName;
    private LocalDateTime clientAccessExpires;
    private Boolean canEdit;
    private Boolean canDelete;
    private Boolean canShare;
    private Boolean canDownload;
    private List<FileTagDTO> tags;
    private List<FileCommentDTO> recentComments;
    private Integer commentCount;
}