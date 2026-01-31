package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for Practice Area Tool History
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PracticeAreaToolHistoryDTO {

    private Long id;
    private Long organizationId;
    private Long userId;
    private String practiceArea;
    private String toolType;
    private String title;
    private Map<String, Object> inputData;
    private Map<String, Object> outputData;
    private String aiAnalysis;
    private Long caseId;

    // Related entity info
    private String caseName;
    private String userName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
}
