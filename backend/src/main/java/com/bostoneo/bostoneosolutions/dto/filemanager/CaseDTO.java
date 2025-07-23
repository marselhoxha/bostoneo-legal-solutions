package com.***REMOVED***.***REMOVED***solutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseDTO {
    private Long id;
    private String caseNumber;
    private String title;
    private String status;
    private String clientName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer documentCount;
}