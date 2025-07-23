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
public class FileSearchResultDTO {
    private Long id;
    private String name;
    private String originalName;
    private String fileType;
    private Long size;
    private String formattedSize;
    private String mimeType;
    private String extension;
    private String icon;
    private String iconColor;
    private Long folderId;
    private String folderPath;
    private String caseName;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String downloadUrl;
    private String previewUrl;
    private String matchedContent;
    private Double relevanceScore;
}