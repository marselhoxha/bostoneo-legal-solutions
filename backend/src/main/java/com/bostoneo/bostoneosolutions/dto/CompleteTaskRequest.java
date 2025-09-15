package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompleteTaskRequest {
    
    private BigDecimal actualHours;
    
    @Size(max = 1000, message = "Completion notes cannot exceed 1000 characters")
    private String completionNotes;
    
    private String attachmentUrl;
} 