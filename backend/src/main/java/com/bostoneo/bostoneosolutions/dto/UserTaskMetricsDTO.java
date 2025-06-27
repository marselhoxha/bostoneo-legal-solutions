package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserTaskMetricsDTO {
    private Long userId;
    private String userName;
    private String userEmail;
    private LocalDate calculationDate;
    private Integer totalTasks;
    private Integer completedTasks;
    private Integer pendingTasks;
    private Integer overdueTasks;
    private Integer upcomingTasks;
    private BigDecimal completionRate;
    private BigDecimal averageCompletionTime;
    private BigDecimal totalEstimatedHours;
    private BigDecimal totalActualHours;
    private BigDecimal efficiencyRatio;
    private Map<String, Integer> tasksByPriority;
    private Map<String, Integer> tasksByStatus;
    private Map<String, BigDecimal> hoursPerTaskType;
} 