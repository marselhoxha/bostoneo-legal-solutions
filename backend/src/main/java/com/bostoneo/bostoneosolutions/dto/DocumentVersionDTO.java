package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Data
@SuperBuilder
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DocumentVersionDTO {
    private String id;
    private Integer versionNumber;
    private String fileName;
    private String fileUrl;
    private LocalDateTime uploadedAt;
    private UserDTO uploadedBy;
    private String changes;
} 
 
 
 