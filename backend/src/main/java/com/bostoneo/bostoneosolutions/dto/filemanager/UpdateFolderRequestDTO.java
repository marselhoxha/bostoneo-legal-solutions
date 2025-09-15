package com.bostoneo.bostoneosolutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateFolderRequestDTO {
    @NotBlank(message = "Folder name is required")
    private String name;
    
    private String description;
    private Long parentId;
    private Long caseId;
}