package com.bostoneo.bostoneosolutions.dto.ai;

import com.bostoneo.bostoneosolutions.enumeration.TaskPriority;
import com.bostoneo.bostoneosolutions.enumeration.TaskType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecuteActionRequest {

    @NotNull(message = "Action type is required")
    private String actionType; // CREATE_TASK, CREATE_DEADLINE, etc.

    // For task creation
    private String title;
    private String description;
    private TaskType taskType;
    private TaskPriority priority;
    private LocalDate dueDate;
    private Long assignedToId;

    // For deadline/event creation
    private LocalDateTime eventDate;
    private String eventType;

    // For notes
    private String noteContent;
}
