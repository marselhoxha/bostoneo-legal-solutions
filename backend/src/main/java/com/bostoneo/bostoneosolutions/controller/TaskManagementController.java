package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.*;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskStatus;
import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.service.TaskManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/legal/tasks")
@RequiredArgsConstructor
@Slf4j
public class TaskManagementController {

    private final TaskManagementService taskManagementService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_PARALEGAL', 'ROLE_SECRETARY', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> createTask(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @Valid @RequestBody CreateTaskRequest request) {
        log.info("User {} creating task for case {}", currentUserId, request.getCaseId());
        
        CaseTaskDTO task = taskManagementService.createTask(request);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PutMapping("/{taskId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_PARALEGAL', 'ROLE_SECRETARY', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> updateTask(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskRequest request) {
        log.info("User {} updating task {}", currentUserId, taskId);
        
        CaseTaskDTO task = taskManagementService.updateTask(taskId, request);
        
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
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_PARALEGAL', 'ROLE_SECRETARY', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> deleteTask(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId) {
        log.info("User {} deleting task {}", currentUserId, taskId);
        
        taskManagementService.deleteTask(taskId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Task deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getAllTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        log.info("Getting all tasks - page: {}, size: {}", page, size);
        
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<CaseTaskDTO> tasks = taskManagementService.getAllTasks(pageable);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("All tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/{taskId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getTask(@PathVariable Long taskId) {
        log.info("Getting task {}", taskId);
        
        CaseTaskDTO task = taskManagementService.getTask(taskId);
        
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getCaseTasks(
            @PathVariable Long caseId,
            @ModelAttribute TaskFilterRequest filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "priority") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        log.info("Getting tasks for case {}", caseId);
        
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<CaseTaskDTO> tasks = taskManagementService.getCaseTasks(caseId, filter, pageable);
        
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
    @PreAuthorize("isAuthenticated() and (@securityService.isCurrentUser(#userId) or hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER'))")
    public ResponseEntity<HttpResponse> getUserTasks(
            @PathVariable Long userId,
            @ModelAttribute TaskFilterRequest filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "dueDate") String sortBy,
            @RequestParam(defaultValue = "ASC") String sortDirection) {
        log.info("Getting tasks for user {}", userId);
        
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<CaseTaskDTO> tasks = taskManagementService.getUserTasks(userId, filter, pageable);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("User tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/{taskId}/subtasks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getSubtasks(@PathVariable Long taskId) {
        log.info("Getting subtasks for task {}", taskId);
        
        List<CaseTaskDTO> subtasks = taskManagementService.getSubtasks(taskId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("subtasks", subtasks))
                        .message("Subtasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/user/{userId}/overdue")
    @PreAuthorize("isAuthenticated() and (@securityService.isCurrentUser(#userId) or hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER'))")
    public ResponseEntity<HttpResponse> getOverdueTasks(@PathVariable Long userId) {
        log.info("Getting overdue tasks for user {}", userId);
        
        List<CaseTaskDTO> tasks = taskManagementService.getOverdueTasks(userId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("Overdue tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/user/{userId}/upcoming")
    @PreAuthorize("isAuthenticated() and (@securityService.isCurrentUser(#userId) or hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER'))")
    public ResponseEntity<HttpResponse> getUpcomingTasks(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "7") int days) {
        log.info("Getting upcoming tasks for user {} within {} days", userId, days);
        
        List<CaseTaskDTO> tasks = taskManagementService.getUpcomingTasks(userId, days);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", tasks))
                        .message("Upcoming tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/{taskId}/assign/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> assignTask(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @PathVariable Long userId) {
        log.info("User {} assigning task {} to user {}", currentUserId, taskId, userId);
        
        CaseTaskDTO task = taskManagementService.assignTask(taskId, userId);
        
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> updateTaskStatus(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @RequestParam TaskStatus status) {
        log.info("User {} updating task {} status to {}", currentUserId, taskId, status);
        
        CaseTaskDTO task = taskManagementService.updateTaskStatus(taskId, status);
        
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> completeTask(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @Valid @RequestBody CompleteTaskRequest request) {
        log.info("User {} completing task {}", currentUserId, taskId);
        
        CaseTaskDTO task = taskManagementService.completeTask(taskId, request);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("task", task))
                        .message("Task completed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/{taskId}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> addComment(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @Valid @RequestBody CreateCommentRequest request) {
        log.info("User {} adding comment to task {}", currentUserId, taskId);
        
        TaskCommentDTO comment = taskManagementService.addComment(taskId, request);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("comment", comment))
                        .message("Comment added successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @GetMapping("/{taskId}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getTaskComments(@PathVariable Long taskId) {
        log.info("Getting comments for task {}", taskId);
        
        List<TaskCommentDTO> comments = taskManagementService.getTaskComments(taskId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("comments", comments))
                        .message("Task comments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/comments/{commentId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> deleteComment(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long commentId) {
        log.info("User {} deleting comment {}", currentUserId, commentId);
        
        taskManagementService.deleteComment(commentId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Comment deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/analytics/case/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getTaskAnalytics(@PathVariable Long caseId) {
        log.info("Getting task analytics for case {}", caseId);
        
        TaskAnalyticsDTO analytics = taskManagementService.getTaskAnalytics(caseId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("analytics", analytics))
                        .message("Task analytics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/analytics/user/{userId}")
    @PreAuthorize("isAuthenticated() and (@securityService.isCurrentUser(#userId) or hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER'))")
    public ResponseEntity<HttpResponse> getUserTaskMetrics(@PathVariable Long userId) {
        log.info("Getting task metrics for user {}", userId);
        
        UserTaskMetricsDTO metrics = taskManagementService.getUserTaskMetrics(userId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("metrics", metrics))
                        .message("User task metrics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/{taskId}/dependencies/{dependencyTaskId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> addTaskDependency(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @PathVariable Long dependencyTaskId) {
        log.info("User {} adding dependency {} to task {}", currentUserId, dependencyTaskId, taskId);
        
        taskManagementService.addTaskDependency(taskId, dependencyTaskId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Task dependency added successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/{taskId}/dependencies/{dependencyTaskId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_MANAGER')")
    public ResponseEntity<HttpResponse> removeTaskDependency(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @PathVariable Long taskId,
            @PathVariable Long dependencyTaskId) {
        log.info("User {} removing dependency {} from task {}", currentUserId, dependencyTaskId, taskId);
        
        taskManagementService.removeTaskDependency(taskId, dependencyTaskId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Task dependency removed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/{taskId}/dependencies")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getTaskDependencies(@PathVariable Long taskId) {
        log.info("Getting dependencies for task {}", taskId);
        
        List<CaseTaskDTO> dependencies = taskManagementService.getTaskDependencies(taskId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("dependencies", dependencies))
                        .message("Task dependencies retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/user/{userId}/blocked")
    @PreAuthorize("isAuthenticated() and (@securityService.isCurrentUser(#userId) or hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER'))")
    public ResponseEntity<HttpResponse> getBlockedTasks(@PathVariable Long userId) {
        log.info("Getting blocked tasks for user {}", userId);
        
        List<CaseTaskDTO> blockedTasks = taskManagementService.getBlockedTasks(userId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("tasks", blockedTasks))
                        .message("Blocked tasks retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
} 