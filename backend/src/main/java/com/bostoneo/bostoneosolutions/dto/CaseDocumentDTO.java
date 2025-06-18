package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseDocumentDTO {
    private String id;
    private String title;
    private String type;
    private String category;
    private String description;
    private List<String> tags;
    private LocalDateTime uploadedAt;
    private UserDTO uploadedBy;
} 