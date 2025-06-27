package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskPriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskType;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CaseTaskDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    private Long parentTaskId;
    private String parentTaskTitle;
    private String title;
    private String description;
    private TaskType taskType;
    private TaskPriority priority;
    private TaskStatus status;
    private Long assignedToId;
    private String assignedToName;
    private String assignedToEmail;
    private Long assignedById;
    private String assignedByName;
    private BigDecimal estimatedHours;
    private BigDecimal actualHours;
    private LocalDateTime dueDate;
    private LocalDateTime completedAt;
    private LocalDateTime reminderDate;
    private List<Long> dependencies;
    private List<String> tags;
    private List<CaseTaskDTO> subtasks;
    private Integer commentsCount;
    private Integer progressPercentage;
    private boolean overdue;
    private boolean blocked;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 