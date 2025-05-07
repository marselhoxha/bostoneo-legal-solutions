package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.DocumentCategory;
import com.***REMOVED***.***REMOVED***solutions.enumeration.DocumentStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.DocumentType;
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
 
 
 