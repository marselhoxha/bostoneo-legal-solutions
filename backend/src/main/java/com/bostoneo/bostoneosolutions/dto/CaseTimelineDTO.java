package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CaseTimelineDTO {

    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    private String caseType;
    private String caseStatus;
    private Integer currentPhase;
    private Integer totalPhases;
    private Integer completedPhases;
    private Integer skippedPhases;
    private Double progressPercentage;
    private List<TimelinePhaseDTO> phases;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TimelinePhaseDTO {
        private Long id;
        private Integer phaseOrder;
        private String phaseName;
        private String phaseDescription;
        private String status; // PENDING, IN_PROGRESS, COMPLETED, SKIPPED
        private String icon;
        private String color;
        private Integer estimatedDurationDays;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
        private LocalDateTime estimatedCompletionDate;
        private String notes;
        private Boolean isCurrent;
    }
}
