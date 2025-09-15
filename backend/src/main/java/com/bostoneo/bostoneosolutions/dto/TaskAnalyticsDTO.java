package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskAnalyticsDTO {
    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    private Integer totalTasks;
    private Integer completedTasks;
    private Integer pendingTasks;
    private Integer overdueTasks;
    private Integer blockedTasks;
    private BigDecimal completionPercentage;
    private BigDecimal averageCompletionTime;
    private Map<String, Integer> tasksByStatus;
    private Map<String, Integer> tasksByPriority;
    private Map<String, Integer> tasksByType;
    private Map<String, BigDecimal> workloadByUser;
} 