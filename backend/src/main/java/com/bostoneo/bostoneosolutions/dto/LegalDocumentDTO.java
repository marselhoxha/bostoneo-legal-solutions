package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.DocumentCategory;
import com.bostoneo.bostoneosolutions.enumeration.DocumentStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LegalDocumentDTO {
    private Long id;
    private String title;
    private DocumentType type;
    private DocumentCategory category;
    private DocumentStatus status;
    private Long caseId;
    private String description;
    private String url;
    private List<String> tags = new ArrayList<>();
    private LocalDateTime uploadedAt;
    private LocalDateTime updatedAt;
    private Long uploadedBy;
} 
 
 
 