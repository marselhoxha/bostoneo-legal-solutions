package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCaseNoteRequest {
    private Long userId;
    
    @Size(max = 255, message = "Title cannot exceed 255 characters")
    private String title;
    
    private String content;
    
    @JsonProperty("isPrivate")
    private Boolean privateNote;
} 