package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DocumentDTO {
    private String id;
    private String title;
    private String type;
    private String category;
    private String fileName;
    private String fileUrl;
    private String description;
    private List<String> tags;
    private LocalDateTime uploadedAt;
    private UserDTO uploadedBy;
    private Integer currentVersion;
    private List<DocumentVersionDTO> versions;
} 
 
 
 