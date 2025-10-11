package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResearchProgressEvent {
    private String eventType; // "progress", "complete", "error"
    private String stepType; // "query_analysis", "database_search", "ai_analysis", "response_generation"
    private String message; // Human-readable message
    private String detail; // Additional context (e.g., statute being analyzed, case name)
    private String icon; // Remix icon class
    private Integer progress; // 0-100 percentage
    private Long timestamp;
}
