package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskPriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskFilterRequest {
    
    private List<TaskStatus> statuses;
    
    private List<TaskPriority> priorities;
    
    private List<TaskType> taskTypes;
    
    private Long assignedToId;
    
    private Long assignedById;
    
    private LocalDateTime dueDateFrom;
    
    private LocalDateTime dueDateTo;
    
    private Boolean overdue;
    
    private Boolean blocked;
    
    private List<String> tags;
    
    private String searchText;
} 