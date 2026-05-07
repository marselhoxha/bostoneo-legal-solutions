package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.TaskPriority;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.enumeration.TaskType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTaskRequest {
    
    @Size(max = 255, message = "Title cannot exceed 255 characters")
    private String title;
    
    @Size(max = 2000, message = "Description cannot exceed 2000 characters")
    private String description;
    
    private TaskType taskType;
    
    private TaskPriority priority;
    
    private TaskStatus status;
    
    private Long assignedToId;
    
    private BigDecimal estimatedHours;
    
    private BigDecimal actualHours;
    
    private LocalDateTime dueDate;

    /**
     * Explicit-clear flag for {@code dueDate}. JSON has no way to distinguish
     * "field omitted" (don't touch) from "field is null" (clear it) — both
     * deserialize to a Java null on a {@link LocalDateTime}. Sending
     * {@code clearDueDate: true} unsets the existing value; otherwise a null
     * dueDate means "no change."
     */
    private Boolean clearDueDate;

    private LocalDateTime reminderDate;

    private List<Long> dependencies;

    private List<String> tags;

    @Size(max = 1000, message = "Blocker reason cannot exceed 1000 characters")
    private String blockerReason;

    private LocalDate autoUnblockDate;
} 