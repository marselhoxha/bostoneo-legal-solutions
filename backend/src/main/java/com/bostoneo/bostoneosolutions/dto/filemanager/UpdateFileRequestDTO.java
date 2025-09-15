package com.bostoneo.bostoneosolutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateFileRequestDTO {
    @NotBlank(message = "File name is required")
    private String name;
    
    private String description;
    private String documentCategory;
    private String documentStatus;
    private String practiceArea;
    private Long caseId;
    private Long folderId;
    private LocalDateTime clientAccessExpires;
    private List<String> tags;
}