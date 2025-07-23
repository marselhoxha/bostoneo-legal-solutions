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
public class FolderDTO {
    private Long id;
    private String name;
    private String path;
    private Long parentId;
    private Long parentFolderId;
    private String parentName;
    private Long size;
    private Integer fileCount;
    private Integer folderCount;
    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<FolderDTO> children;
    private List<FileItemDTO> files;
    private Boolean hasChildren;
    private Boolean canEdit;
    private Boolean canDelete;
    private Boolean canShare;
    private Long caseId;
    private String caseName;
    private String caseNumber;
}