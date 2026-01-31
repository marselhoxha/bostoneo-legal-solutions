package com.bostoneo.bostoneosolutions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Request DTO for creating a new tool history entry
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateToolHistoryRequest {

    @NotBlank(message = "Tool type is required")
    private String toolType;

    private String title;

    @NotNull(message = "Input data is required")
    private Map<String, Object> inputData;

    private Map<String, Object> outputData;

    private String aiAnalysis;

    private Long caseId;
}
