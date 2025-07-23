package com.***REMOVED***.***REMOVED***solutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileUploadResponseDTO {
    private Long id;
    private Long fileId;
    private String fileName;
    private Long fileSize;
    private String name;
    private String originalName;
    private Long size;
    private String formattedSize;
    private String mimeType;
    private String extension;
    private String icon;
    private String iconColor;
    private String downloadUrl;
    private String message;
    private Boolean success;
    private FileItemDTO file;
    private Long folderId;
    private Long caseId;
    private Integer progress;
}