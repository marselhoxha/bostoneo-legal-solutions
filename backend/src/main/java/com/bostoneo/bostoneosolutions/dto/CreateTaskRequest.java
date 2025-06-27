package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskPriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTaskRequest {
    
    @NotNull(message = "Case ID is required")
    private Long caseId;
    
    private Long parentTaskId;
    
    @NotBlank(message = "Task title is required")
    @Size(max = 255, message = "Title cannot exceed 255 characters")
    private String title;
    
    @Size(max = 2000, message = "Description cannot exceed 2000 characters")
    private String description;
    
    @NotNull(message = "Task type is required")
    private TaskType taskType;
    
    private TaskPriority priority = TaskPriority.MEDIUM;
    
    private Long assignedToId;
    
    private BigDecimal estimatedHours;
    
    private LocalDateTime dueDate;
    
    private LocalDateTime reminderDate;
    
    private List<Long> dependencies;
    
    private List<String> tags;
} 