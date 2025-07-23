package com.***REMOVED***.***REMOVED***solutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateFolderRequestDTO {
    @NotBlank(message = "Folder name is required")
    private String name;
    
    private String description;
    private Long parentId;
    private Long parentFolderId;
    private Long caseId;
    private String practiceArea;
    
    // Helper method to get parent folder ID from either field
    public Long getParentFolderIdValue() {
        return parentFolderId != null ? parentFolderId : parentId;
    }
}