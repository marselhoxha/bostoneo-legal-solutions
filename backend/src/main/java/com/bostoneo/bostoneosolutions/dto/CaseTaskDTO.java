package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.BillingType;
import com.bostoneo.bostoneosolutions.enumeration.TaskPriority;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.enumeration.TaskType;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CaseTaskDTO {
    private Long id;
    // SECURITY: Required for multi-tenant data isolation
    private Long organizationId;
    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    // V77: parent case's billing arrangement. Drives time-log UI visibility on this task
    // (CONTINGENCY/PRO_BONO hide hours fields by default; HOURLY/FLAT_FEE show them).
    // Read-only on the task — set on the case, propagated here for the frontend.
    private BillingType caseBillingType;
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
    // V78 — multi-assignee list. assignedToId stays as the primary pointer
    // (first / lead). `assignees` is the full set including the primary.
    private List<TaskAssigneeRef> assignees;
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
    // D2 row meta strip — populated for the list view so each row can render
    // "⊞ done/total subtasks" + the colored progress bar without lazy-loading
    // the full subtasks collection on every task.
    private Integer subtaskTotal;
    private Integer subtaskDoneCount;
    private boolean overdue;
    private boolean blocked;
    private String blockerReason;
    private LocalDate autoUnblockDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 