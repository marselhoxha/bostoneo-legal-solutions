package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.TaskManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Task Management", description = "Manage case tasks and activities")
public class TaskManagementResource {
    
    private final TaskManagementService taskService;
    
    @GetMapping
    @Operation(summary = "Get all tasks")
    @PreAuthorize("hasAuthority('TASK:VIEW_ALL') or hasRole('ROLE_USER')")
    public ResponseEntity<HttpResponse> getAllTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<CaseTaskDTO> tasks = taskService.getAllTasks(pageable);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("Tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping
    @Operation(summary = "Create a new task")
    @PreAuthorize("hasAuthority('TASK:CREATE') or hasRole('ROLE_USER')")
    public ResponseEntity<HttpResponse> createTask(@Valid @RequestBody CreateTaskRequest request) {
        log.info("Creating new task for case {}", request.getCaseId());
        CaseTaskDTO task = taskService.createTask(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task created successfully")
                        .status(HttpStatus.CREATED)
                        .statusCode(HttpStatus.CREATED.value())
                        .build());
    }
    
    @PutMapping("/{taskId}")
    @Operation(summary = "Update an existing task")
    @PreAuthorize("hasAuthority('TASK:EDIT') or hasAuthority('TASK:ADMIN') or @securityService.isTaskAssignee(#taskId)")
    public ResponseEntity<HttpResponse> updateTask(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskRequest request) {
        log.info("Updating task {}", taskId);
        CaseTaskDTO task = taskService.updateTask(taskId, request);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @DeleteMapping("/{taskId}")
    @Operation(summary = "Delete a task")
    @PreAuthorize("hasAuthority('TASK:DELETE') or hasRole('ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> deleteTask(@PathVariable Long taskId) {
        log.info("Deleting task {}", taskId);
        taskService.deleteTask(taskId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("deleted", true))
                        .message("Task deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/{taskId}")
    @Operation(summary = "Get task details")
    @PreAuthorize("hasAuthority('TASK:VIEW_ALL') or hasAuthority('TASK:VIEW_OWN') or @securityService.hasAccessToTask(#taskId)")
    public ResponseEntity<HttpResponse> getTask(@PathVariable Long taskId) {
        log.info("Getting task {}", taskId);
        CaseTaskDTO task = taskService.getTask(taskId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/case/{caseId}")
    @Operation(summary = "Get all tasks for a case")
    @PreAuthorize("hasAuthority('TASK:VIEW_ALL') or hasAuthority('TASK:VIEW_TEAM') or hasAuthority('CASE:VIEW') or @securityService.hasAccessToCase(#caseId)")
    public ResponseEntity<HttpResponse> getCaseTasks(
            @PathVariable Long caseId,
            @ModelAttribute TaskFilterRequest filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<CaseTaskDTO> tasks = taskService.getCaseTasks(caseId, filter, pageable);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("Case tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/user/{userId}")
    @Operation(summary = "Get all tasks assigned to a user")
    @PreAuthorize("hasAuthority('TASK:VIEW_ALL') or hasAuthority('TASK:VIEW_OWN') or @securityService.isCurrentUser(#userId)")
    public ResponseEntity<HttpResponse> getUserTasks(
            @PathVariable Long userId,
            @ModelAttribute TaskFilterRequest filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "dueDate") String sortBy,
            @RequestParam(defaultValue = "ASC") String sortDirection) {
        
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<CaseTaskDTO> tasks = taskService.getUserTasks(userId, filter, pageable);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("User tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/{parentTaskId}/subtasks")
    @Operation(summary = "Get subtasks of a parent task")
    @PreAuthorize("hasAuthority('TASK:VIEW_ALL') or hasAuthority('TASK:VIEW_OWN') or @securityService.hasAccessToTask(#parentTaskId)")
    public ResponseEntity<HttpResponse> getSubtasks(@PathVariable Long parentTaskId) {
        log.info("Getting subtasks for task {}", parentTaskId);
        List<CaseTaskDTO> subtasks = taskService.getSubtasks(parentTaskId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("subtasks", subtasks))
                        .message("Subtasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping("/{taskId}/assign/{userId}")
    @Operation(summary = "Assign a task to a user")
    @PreAuthorize("hasAuthority('TASK:ASSIGN') or hasRole('ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> assignTask(
            @PathVariable Long taskId,
            @PathVariable Long userId) {
        log.info("Assigning task {} to user {}", taskId, userId);
        CaseTaskDTO task = taskService.assignTask(taskId, userId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task assigned successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PutMapping("/{taskId}/status")
    @Operation(summary = "Update task status")
    @PreAuthorize("hasAuthority('TASK:EDIT') or hasAuthority('TASK:ADMIN') or @securityService.isTaskAssignee(#taskId)")
    public ResponseEntity<HttpResponse> updateTaskStatus(
            @PathVariable Long taskId,
            @RequestParam TaskStatus status) {
        log.info("Updating task {} status to {}", taskId, status);
        CaseTaskDTO task = taskService.updateTaskStatus(taskId, status);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task status updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping("/{taskId}/complete")
    @Operation(summary = "Mark task as completed")
    @PreAuthorize("hasAuthority('TASK:EDIT') or hasAuthority('TASK:ADMIN') or @securityService.isTaskAssignee(#taskId)")
    public ResponseEntity<HttpResponse> completeTask(
            @PathVariable Long taskId,
            @Valid @RequestBody CompleteTaskRequest request) {
        log.info("Completing task {}", taskId);
        CaseTaskDTO task = taskService.completeTask(taskId, request);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task completed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    // Comments endpoints
    
    @PostMapping("/{taskId}/comments")
    @Operation(summary = "Add comment to task")
    @PreAuthorize("hasAuthority('TASK:COMMENT') or @securityService.hasAccessToTask(#taskId)")
    public ResponseEntity<HttpResponse> addComment(
            @PathVariable Long taskId,
            @Valid @RequestBody CreateCommentRequest request) {
        log.info("Adding comment to task {}", taskId);
        TaskCommentDTO comment = taskService.addComment(taskId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("comment", comment))
                        .message("Comment added successfully")
                        .status(HttpStatus.CREATED)
                        .statusCode(HttpStatus.CREATED.value())
                        .build());
    }
    
    @GetMapping("/{taskId}/comments")
    @Operation(summary = "Get task comments")
    @PreAuthorize("hasAuthority('TASK:VIEW_ALL') or hasAuthority('TASK:VIEW_OWN') or @securityService.hasAccessToTask(#taskId)")
    public ResponseEntity<HttpResponse> getTaskComments(@PathVariable Long taskId) {
        log.info("Getting comments for task {}", taskId);
        List<TaskCommentDTO> comments = taskService.getTaskComments(taskId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("comments", comments))
                        .message("Comments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    // Analytics endpoints
    
    @GetMapping("/analytics/case/{caseId}")
    @Operation(summary = "Get task analytics for a case")
    @PreAuthorize("hasAuthority('TASK:ANALYTICS') or hasRole('ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> getTaskAnalytics(@PathVariable Long caseId) {
        log.info("Getting task analytics for case {}", caseId);
        TaskAnalyticsDTO analytics = taskService.getTaskAnalytics(caseId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("analytics", analytics))
                        .message("Task analytics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/metrics/user/{userId}")
    @Operation(summary = "Get task metrics for a user")
    @PreAuthorize("hasAuthority('TASK:ANALYTICS') or @securityService.isCurrentUser(#userId)")
    public ResponseEntity<HttpResponse> getUserTaskMetrics(@PathVariable Long userId) {
        log.info("Getting task metrics for user {}", userId);
        UserTaskMetricsDTO metrics = taskService.getUserTaskMetrics(userId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("metrics", metrics))
                        .message("User task metrics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}