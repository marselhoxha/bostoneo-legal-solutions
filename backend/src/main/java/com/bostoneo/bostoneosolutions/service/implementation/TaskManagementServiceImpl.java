package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.enumeration.TaskPriority;
import com.bostoneo.bostoneosolutions.model.CaseTask;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.TaskComment;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.repository.CaseTaskRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.TaskCommentRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.service.TaskManagementService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TaskManagementServiceImpl implements TaskManagementService {
    
    private final CaseTaskRepository caseTaskRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final UserRepository userRepository;
    private final TaskCommentRepository taskCommentRepository;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    @Override
    public CaseTaskDTO createTask(CreateTaskRequest request) {
        log.info("Creating new task for case {}", request.getCaseId());
        
        // Fetch the legal case
        LegalCase legalCase = legalCaseRepository.findById(request.getCaseId())
            .orElseThrow(() -> new IllegalArgumentException("Legal case not found with ID: " + request.getCaseId()));
        
        // Get current user as the creator (assigned_by)
        // For now, we'll use a default user ID (1) - this should come from security context
        User assignedBy = userRepository.get(1L);
        if (assignedBy == null) {
            throw new IllegalArgumentException("User not found with ID: 1");
        }
        
        // Create new CaseTask entity
        CaseTask.CaseTaskBuilder taskBuilder = CaseTask.builder()
            .legalCase(legalCase)
            .assignedBy(assignedBy)
            .title(request.getTitle())
            .description(request.getDescription())
            .taskType(request.getTaskType())
            .priority(request.getPriority() != null ? request.getPriority() : TaskPriority.MEDIUM)
            .status(TaskStatus.TODO) // Default status for new tasks
            .estimatedHours(request.getEstimatedHours())
            .dueDate(request.getDueDate())
            .reminderDate(request.getReminderDate())
            .tags(request.getTags())
            .dependencies(request.getDependencies());
        
        // Set assigned user if provided
        if (request.getAssignedToId() != null) {
            User assignedTo = userRepository.get(request.getAssignedToId());
            if (assignedTo == null) {
                throw new IllegalArgumentException("Assigned user not found with ID: " + request.getAssignedToId());
            }
            taskBuilder.assignedTo(assignedTo);
        }
        
        // Set parent task if provided
        if (request.getParentTaskId() != null) {
            CaseTask parentTask = caseTaskRepository.findById(request.getParentTaskId())
                .orElseThrow(() -> new IllegalArgumentException("Parent task not found with ID: " + request.getParentTaskId()));
            taskBuilder.parentTask(parentTask);
        }
        
        CaseTask task = taskBuilder.build();
        
        // Save the task
        CaseTask savedTask = caseTaskRepository.save(task);
        log.info("✅ Successfully saved task with ID: {} for case: {}", savedTask.getId(), legalCase.getId());

        // Verify the task was actually saved
        if (savedTask.getId() == null) {
            log.error("❌ Task save failed - ID is null!");
            throw new IllegalStateException("Failed to save task - no ID generated");
        }

        // Send notifications to case assignees
        try {
            String title = "New Task Created";
            String message = String.format("New task \"%s\" has been created for case \"%s\"",
                savedTask.getTitle(), legalCase.getTitle());

            Set<Long> notificationUserIds = new HashSet<>();

            // Get users assigned to the case
            List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseId(savedTask.getLegalCase().getId());
            for (CaseAssignment assignment : caseAssignments) {
                if (assignment.getAssignedTo() != null) {
                    notificationUserIds.add(assignment.getAssignedTo().getId());
                }
            }

            // Also notify the assigned user if different from case assignees
            if (savedTask.getAssignedTo() != null) {
                notificationUserIds.add(savedTask.getAssignedTo().getId());
            }

            for (Long userId : notificationUserIds) {
                notificationService.sendCrmNotification(title, message, userId,
                    "TASK_CREATED", Map.of("taskId", savedTask.getId(), "caseId", legalCase.getId()));
            }

            log.info("Task creation notifications sent to {} users", notificationUserIds.size());
        } catch (Exception e) {
            log.error("Failed to send task creation notifications: {}", e.getMessage());
        }

        CaseTaskDTO dto = convertToDTO(savedTask);
        log.info("✅ Returning task DTO with ID: {}", dto.getId());
        return dto;
    }

    @Override
    public CaseTaskDTO updateTask(Long taskId, UpdateTaskRequest request) {
        log.info("Updating task {}", taskId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Track status change for notifications
        TaskStatus oldStatus = task.getStatus();
        TaskStatus newStatus = request.getStatus();
        
        // Track assignment change for notifications
        User oldAssignedTo = task.getAssignedTo();
        Long newAssignedToId = request.getAssignedToId();
        
        // Update fields if provided
        if (request.getTitle() != null) {
            task.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            task.setDescription(request.getDescription());
        }
        if (request.getTaskType() != null) {
            task.setTaskType(request.getTaskType());
        }
        if (request.getPriority() != null) {
            task.setPriority(request.getPriority());
        }
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
            // Update completion time if needed
            if (request.getStatus() == TaskStatus.COMPLETED && task.getCompletedAt() == null) {
                task.setCompletedAt(LocalDateTime.now());
            } else if (request.getStatus() != TaskStatus.COMPLETED) {
                task.setCompletedAt(null);
            }
        }
        if (request.getDueDate() != null) {
            task.setDueDate(request.getDueDate());
        }
        if (request.getEstimatedHours() != null) {
            task.setEstimatedHours(request.getEstimatedHours());
        }
        if (request.getActualHours() != null) {
            task.setActualHours(request.getActualHours());
        }
        if (request.getReminderDate() != null) {
            task.setReminderDate(request.getReminderDate());
        }
        if (request.getTags() != null) {
            task.setTags(request.getTags());
        }
        if (request.getDependencies() != null) {
            task.setDependencies(request.getDependencies());
        }
        
        // Update assigned user if provided
        if (request.getAssignedToId() != null) {
            if (request.getAssignedToId() == 0) {
                // Unassign task
                task.setAssignedTo(null);
            } else {
                User assignedTo = userRepository.get(request.getAssignedToId());
                if (assignedTo == null) {
                    throw new IllegalArgumentException("Assigned user not found with ID: " + request.getAssignedToId());
                }
                task.setAssignedTo(assignedTo);
            }
        }
        
        // Update the updatedAt timestamp
        task.setUpdatedAt(LocalDateTime.now());
        
        // Save the updated task
        CaseTask updatedTask = caseTaskRepository.save(task);
        
        // Send task reassignment notifications if assignee changed
        if (newAssignedToId != null && oldAssignedTo != null && 
            !oldAssignedTo.getId().equals(newAssignedToId) && newAssignedToId != 0) {
            // Task was reassigned to a different user
            try {
                String title = "Task Assigned";
                String message = String.format("You have been assigned to task \"%s\"", 
                    updatedTask.getTitle());
                
                // Send notification to the newly assigned user
                notificationService.sendCrmNotification(title, message, newAssignedToId, 
                    "TASK_ASSIGNED", Map.of("taskId", updatedTask.getId(), 
                                           "caseId", updatedTask.getLegalCase().getId(),
                                           "taskTitle", updatedTask.getTitle()));
                                           
                log.info("📧 Task reassignment notification sent to user: {}", newAssignedToId);
            } catch (Exception e) {
                log.error("Failed to send task reassignment notification: {}", e.getMessage());
            }
        } else if (newAssignedToId != null && oldAssignedTo == null && newAssignedToId != 0) {
            // Task was assigned for the first time
            try {
                String title = "Task Assigned";
                String message = String.format("You have been assigned to task \"%s\"", 
                    updatedTask.getTitle());
                
                // Send notification to the newly assigned user
                notificationService.sendCrmNotification(title, message, newAssignedToId, 
                    "TASK_ASSIGNED", Map.of("taskId", updatedTask.getId(), 
                                           "caseId", updatedTask.getLegalCase().getId(),
                                           "taskTitle", updatedTask.getTitle()));
                                           
                //log.info("📧 Task assignment notification sent to user: {}", newAssignedToId);
            } catch (Exception e) {
                log.error("Failed to send task assignment notification: {}", e.getMessage());
            }
        }
        
        // Send status change notifications
        if (oldStatus != null && newStatus != null && !oldStatus.equals(newStatus)) {
            try {
                String title = "Task Status Changed";
                String message = String.format("Task \"%s\" status changed from %s to %s", 
                    updatedTask.getTitle(), oldStatus, newStatus);
                
                Set<Long> notificationUserIds = new HashSet<>();
                
                // Get users assigned to the case
                List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseId(updatedTask.getLegalCase().getId());
                for (CaseAssignment assignment : caseAssignments) {
                    if (assignment.getAssignedTo() != null) {
                        notificationUserIds.add(assignment.getAssignedTo().getId());
                    }
                }
                
                // Also notify the assigned user if different from case assignees
                if (updatedTask.getAssignedTo() != null) {
                    notificationUserIds.add(updatedTask.getAssignedTo().getId());
                }
                
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId, 
                        "TASK_STATUS_CHANGED", Map.of("taskId", updatedTask.getId(), "caseId", updatedTask.getLegalCase().getId(), 
                                                     "oldStatus", oldStatus.toString(), "newStatus", newStatus.toString()));
                }
                
                //log.info("Task status change notifications sent to {} users", notificationUserIds.size());
            } catch (Exception e) {
                log.error("Failed to send task status change notifications: {}", e.getMessage());
            }
        }
        
        log.info("Successfully updated task {}", taskId);
        return convertToDTO(updatedTask);
    }

    @Override
    public void deleteTask(Long taskId) {
        //log.info("Deleting task {}", taskId);
        
        // Check if task exists
        if (!caseTaskRepository.existsById(taskId)) {
            throw new IllegalArgumentException("Task not found with ID: " + taskId);
        }
        
        // Delete the task (this will cascade delete subtasks and comments)
        caseTaskRepository.deleteById(taskId);
        
        //log.info("Successfully deleted task {}", taskId);
    }

    @Override
    public CaseTaskDTO getTask(Long taskId) {
        //log.info("Getting task {}", taskId);
        
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        return convertToDTO(task);
    }

    @Override
    public Page<CaseTaskDTO> getAllTasks(Pageable pageable) {
        //log.info("Getting all tasks with pagination");

        // Use tenant-filtered query if organization context is available
        Page<CaseTask> tasksPage = tenantService.getCurrentOrganizationId()
            .map(orgId -> caseTaskRepository.findByOrganizationId(orgId, pageable))
            .orElseGet(() -> caseTaskRepository.findAll(pageable));

        List<CaseTaskDTO> taskDTOs = tasksPage.getContent().stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());

        return new PageImpl<>(taskDTOs, pageable, tasksPage.getTotalElements());
    }
    
    @Override
    public Page<CaseTaskDTO> getCaseTasks(Long caseId, TaskFilterRequest filter, Pageable pageable) {
        //log.info("Getting tasks for case: {}", caseId);
        List<CaseTask> tasks = caseTaskRepository.findByCaseId(caseId);
        
        // Convert to DTOs
        List<CaseTaskDTO> taskDTOs = tasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
            
        // Create a page from the list
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), taskDTOs.size());
        
        List<CaseTaskDTO> pageContent = taskDTOs.subList(start, end);
        return new PageImpl<>(pageContent, pageable, taskDTOs.size());
    }

    @Override
    public Page<CaseTaskDTO> getUserTasks(Long userId, TaskFilterRequest filter, Pageable pageable) {
        //log.info("Getting tasks for user: {}", userId);
        
        List<TaskStatus> statuses = filter.getStatuses();
        if (statuses == null || statuses.isEmpty()) {
            // Default to active statuses
            statuses = List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.BLOCKED);
        }
        
        Page<CaseTask> tasksPage = caseTaskRepository.findByAssignedToAndStatuses(userId, statuses, pageable);
        
        List<CaseTaskDTO> taskDTOs = tasksPage.getContent().stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
            
        return new PageImpl<>(taskDTOs, pageable, tasksPage.getTotalElements());
    }

    @Override
    public List<CaseTaskDTO> getSubtasks(Long parentTaskId) {
        //log.info("Getting subtasks for parent task: {}", parentTaskId);
        
        List<CaseTask> subtasks = caseTaskRepository.findByParentTaskId(parentTaskId);
        
        return subtasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseTaskDTO> getOverdueTasks(Long userId) {
        //log.info("Getting overdue tasks for user: {}", userId);
        
        List<CaseTask> overdueTasks = caseTaskRepository.findOverdueTasksByUser(userId);
        
        return overdueTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseTaskDTO> getUpcomingTasks(Long userId, int days) {
        //log.info("Getting upcoming tasks for user: {} within {} days", userId, days);
        
        LocalDateTime endDate = LocalDateTime.now().plusDays(days);
        List<CaseTask> upcomingTasks = caseTaskRepository.findUpcomingTasksByAssignee(userId, endDate);
        
        return upcomingTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public CaseTaskDTO assignTask(Long taskId, Long userId) {
        //log.info("Assigning task {} to user {}", taskId, userId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Find the user
        User user = userRepository.get(userId);
        if (user == null) {
            throw new IllegalArgumentException("User not found with ID: " + userId);
        }
        
        // Assign the task
        task.setAssignedTo(user);
        
        // If task is unassigned (TODO with no assignee), update status to TODO
        if (task.getStatus() == null) {
            task.setStatus(TaskStatus.TODO);
        }
        
        // Update the updatedAt timestamp
        task.setUpdatedAt(LocalDateTime.now());
        
        // Save the updated task
        CaseTask updatedTask = caseTaskRepository.save(task);
        
        // Send task assignment notification
        try {
            String title = "Task Assigned";
            String message = String.format("You have been assigned to task \"%s\"", 
                updatedTask.getTitle());
            
            // Send notification to the assigned user
            notificationService.sendCrmNotification(title, message, userId, 
                "TASK_ASSIGNED", Map.of("taskId", updatedTask.getId(), 
                                       "caseId", updatedTask.getLegalCase().getId(),
                                       "taskTitle", updatedTask.getTitle()));
                                       
            //log.info("📧 Task assignment notification sent to user: {}", userId);
        } catch (Exception e) {
            log.error("Failed to send task assignment notification: {}", e.getMessage());
        }
        
        //log.info("Successfully assigned task {} to user {}", taskId, userId);
        return convertToDTO(updatedTask);
    }

    @Override
    public CaseTaskDTO updateTaskStatus(Long taskId, TaskStatus status) {
        //log.info("Updating task {} status to {}", taskId, status);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Update the status
        task.setStatus(status);
        
        // Update completion time if the task is being completed
        if (status == TaskStatus.COMPLETED && task.getCompletedAt() == null) {
            task.setCompletedAt(LocalDateTime.now());
        } else if (status != TaskStatus.COMPLETED) {
            // Clear completion time if status is changed from completed
            task.setCompletedAt(null);
        }
        
        // Update the updatedAt timestamp
        task.setUpdatedAt(LocalDateTime.now());
        
        // Save the updated task
        CaseTask updatedTask = caseTaskRepository.save(task);
        
        // Send status change notifications
        try {
            String title = "Task Status Changed";
            String message = String.format("Task \"%s\" status changed to %s", 
                updatedTask.getTitle(), status);
            
            Set<Long> notificationUserIds = new HashSet<>();
            
            // Get users assigned to the case
            List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseId(updatedTask.getLegalCase().getId());
            for (CaseAssignment assignment : caseAssignments) {
                if (assignment.getAssignedTo() != null) {
                    notificationUserIds.add(assignment.getAssignedTo().getId());
                }
            }
            
            // Also notify the assigned user if different from case assignees
            if (updatedTask.getAssignedTo() != null) {
                notificationUserIds.add(updatedTask.getAssignedTo().getId());
            }
            
            for (Long userId : notificationUserIds) {
                notificationService.sendCrmNotification(title, message, userId, 
                    "TASK_STATUS_CHANGED", Map.of("taskId", updatedTask.getId(), "caseId", updatedTask.getLegalCase().getId(), 
                                                 "newStatus", status.toString()));
            }
            
            //log.info("Task status change notifications sent to {} users", notificationUserIds.size());
        } catch (Exception e) {
            log.error("Failed to send task status change notifications: {}", e.getMessage());
        }
        
        //log.info("Successfully updated task {} status to {}", taskId, status);
        return convertToDTO(updatedTask);
    }

    @Override
    public CaseTaskDTO completeTask(Long taskId, CompleteTaskRequest request) {
        //log.info("Completing task {}", taskId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Update task status to completed
        task.setStatus(TaskStatus.COMPLETED);
        task.setCompletedAt(LocalDateTime.now());
        
        // Update actual hours if provided
        if (request.getActualHours() != null) {
            task.setActualHours(request.getActualHours());
        }
        
        // Add completion notes if provided
        if (request.getCompletionNotes() != null && !request.getCompletionNotes().trim().isEmpty()) {
            // We'll add this as a comment through the comment service
            // For now, we can append to description or handle separately
            String currentDesc = task.getDescription() != null ? task.getDescription() : "";
            task.setDescription(currentDesc + "\n\nCompletion Notes: " + request.getCompletionNotes());
        }
        
        // Update the updatedAt timestamp
        task.setUpdatedAt(LocalDateTime.now());
        
        // Save the updated task
        CaseTask updatedTask = caseTaskRepository.save(task);
        
        //log.info("Successfully completed task {}", taskId);
        return convertToDTO(updatedTask);
    }

    @Override
    public TaskCommentDTO addComment(Long taskId, CreateCommentRequest request) {
        //log.info("Adding comment to task {}", taskId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Get current user (for now using default user ID 1)
        User user = userRepository.get(1L);
        if (user == null) {
            throw new IllegalArgumentException("User not found with ID: 1");
        }
        
        // Create new comment
        TaskComment comment = TaskComment.builder()
            .task(task)
            .user(user)
            .comment(request.getComment())
            .attachmentUrl(request.getAttachmentUrl())
            .internal(request.isInternal())
            .build();
        
        // Save the comment
        TaskComment savedComment = taskCommentRepository.save(comment);
        
        //log.info("Successfully added comment to task {}", taskId);
        return convertCommentToDTO(savedComment);
    }

    @Override
    public List<TaskCommentDTO> getTaskComments(Long taskId) {
        //log.info("Getting comments for task {}", taskId);
        
        // Check if task exists
        if (!caseTaskRepository.existsById(taskId)) {
            throw new IllegalArgumentException("Task not found with ID: " + taskId);
        }
        
        List<TaskComment> comments = taskCommentRepository.findByTaskId(taskId);
        
        return comments.stream()
            .map(this::convertCommentToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public void deleteComment(Long commentId) {
        //log.info("Deleting comment {}", commentId);
        
        // Check if comment exists
        if (!taskCommentRepository.existsById(commentId)) {
            throw new IllegalArgumentException("Comment not found with ID: " + commentId);
        }
        
        // Delete the comment
        taskCommentRepository.deleteById(commentId);
        
        //log.info("Successfully deleted comment {}", commentId);
    }

    @Override
    public TaskAnalyticsDTO getTaskAnalytics(Long caseId) {
        //log.info("Getting task analytics for case {}", caseId);
        
        // Get all tasks for the case
        List<CaseTask> tasks = caseTaskRepository.findByCaseId(caseId);
        
        // Calculate statistics
        int totalTasks = tasks.size();
        int completedTasks = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
        int inProgressTasks = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        int todoTasks = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.TODO).count();
        int blockedTasks = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.BLOCKED).count();
        int overdueTasks = (int) tasks.stream()
            .filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(LocalDateTime.now()) 
                    && t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
            .count();
        
        // Calculate completion percentage
        double completionPercentage = totalTasks > 0 ? (completedTasks * 100.0) / totalTasks : 0;
        
        // Get task status breakdown
        List<Object[]> statusStats = caseTaskRepository.getTaskStatisticsByCaseId(caseId);
        
        // Get the case details
        LegalCase legalCase = legalCaseRepository.findById(caseId)
            .orElse(null);
        
        // Build status map
        Map<String, Integer> tasksByStatus = new HashMap<>();
        tasksByStatus.put("TODO", todoTasks);
        tasksByStatus.put("IN_PROGRESS", inProgressTasks);
        tasksByStatus.put("COMPLETED", completedTasks);
        tasksByStatus.put("BLOCKED", blockedTasks);
        
        // Build priority map
        Map<String, Integer> tasksByPriority = new HashMap<>();
        tasksByPriority.put("URGENT", (int) tasks.stream().filter(t -> t.getPriority() == TaskPriority.URGENT).count());
        tasksByPriority.put("HIGH", (int) tasks.stream().filter(t -> t.getPriority() == TaskPriority.HIGH).count());
        tasksByPriority.put("MEDIUM", (int) tasks.stream().filter(t -> t.getPriority() == TaskPriority.MEDIUM).count());
        tasksByPriority.put("LOW", (int) tasks.stream().filter(t -> t.getPriority() == TaskPriority.LOW).count());
        
        return TaskAnalyticsDTO.builder()
            .caseId(caseId)
            .caseNumber(legalCase != null ? legalCase.getCaseNumber() : null)
            .caseTitle(legalCase != null ? legalCase.getTitle() : null)
            .totalTasks(totalTasks)
            .completedTasks(completedTasks)
            .pendingTasks(todoTasks + inProgressTasks)
            .overdueTasks(overdueTasks)
            .blockedTasks(blockedTasks)
            .completionPercentage(BigDecimal.valueOf(completionPercentage))
            .tasksByStatus(tasksByStatus)
            .tasksByPriority(tasksByPriority)
            .build();
    }

    @Override
    public UserTaskMetricsDTO getUserTaskMetrics(Long userId) {
        //log.info("Getting task metrics for user {}", userId);
        
        // Get all active tasks for the user
        List<TaskStatus> activeStatuses = List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.BLOCKED);
        Page<CaseTask> userTasksPage = caseTaskRepository.findByAssignedToAndStatuses(userId, activeStatuses, Pageable.unpaged());
        List<CaseTask> userTasks = userTasksPage.getContent();
        
        // Calculate metrics
        int totalAssignedTasks = userTasks.size();
        int completedTasksCount = caseTaskRepository.findByAssignedToAndStatuses(userId, List.of(TaskStatus.COMPLETED), Pageable.unpaged()).getNumberOfElements();
        int overdueTasks = caseTaskRepository.countOverdueTasksByUserId(userId);
        int upcomingDeadlines = caseTaskRepository.countUpcomingDeadlinesByUserId(userId, LocalDateTime.now().plusDays(7));
        
        // Calculate average completion time
        Double avgCompletionTime = caseTaskRepository.calculateAverageCompletionTime(userId);
        if (avgCompletionTime == null) {
            avgCompletionTime = 0.0;
        }
        
        // Task priority breakdown
        // Get user info
        User user = userRepository.get(userId);
        
        // Build priority map
        Map<String, Integer> tasksByPriority = new HashMap<>();
        tasksByPriority.put("URGENT", (int) userTasks.stream().filter(t -> t.getPriority() == TaskPriority.URGENT).count());
        tasksByPriority.put("HIGH", (int) userTasks.stream().filter(t -> t.getPriority() == TaskPriority.HIGH).count());
        tasksByPriority.put("MEDIUM", (int) userTasks.stream().filter(t -> t.getPriority() == TaskPriority.MEDIUM).count());
        tasksByPriority.put("LOW", (int) userTasks.stream().filter(t -> t.getPriority() == TaskPriority.LOW).count());
        
        // Build status map
        Map<String, Integer> tasksByStatus = new HashMap<>();
        tasksByStatus.put("TODO", (int) userTasks.stream().filter(t -> t.getStatus() == TaskStatus.TODO).count());
        tasksByStatus.put("IN_PROGRESS", (int) userTasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count());
        tasksByStatus.put("REVIEW", (int) userTasks.stream().filter(t -> t.getStatus() == TaskStatus.REVIEW).count());
        tasksByStatus.put("BLOCKED", (int) userTasks.stream().filter(t -> t.getStatus() == TaskStatus.BLOCKED).count());
        tasksByStatus.put("COMPLETED", completedTasksCount);
        
        // Calculate completion rate
        double completionRate = (totalAssignedTasks + completedTasksCount) > 0 ? 
            (completedTasksCount * 100.0) / (totalAssignedTasks + completedTasksCount) : 0;
        
        return UserTaskMetricsDTO.builder()
            .userId(userId)
            .userName(user != null ? user.getFirstName() + " " + user.getLastName() : null)
            .userEmail(user != null ? user.getEmail() : null)
            .calculationDate(LocalDate.now())
            .totalTasks(totalAssignedTasks + completedTasksCount)
            .completedTasks(completedTasksCount)
            .pendingTasks(totalAssignedTasks)
            .overdueTasks(overdueTasks)
            .upcomingTasks(upcomingDeadlines)
            .completionRate(BigDecimal.valueOf(completionRate))
            .averageCompletionTime(BigDecimal.valueOf(avgCompletionTime))
            .tasksByPriority(tasksByPriority)
            .tasksByStatus(tasksByStatus)
            .build();
    }

    @Override
    public void addTaskDependency(Long taskId, Long dependencyTaskId) {
        //log.info("Adding dependency {} to task {}", dependencyTaskId, taskId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Check if dependency task exists
        if (!caseTaskRepository.existsById(dependencyTaskId)) {
            throw new IllegalArgumentException("Dependency task not found with ID: " + dependencyTaskId);
        }
        
        // Prevent self-dependency
        if (taskId.equals(dependencyTaskId)) {
            throw new IllegalArgumentException("Task cannot depend on itself");
        }
        
        // Get current dependencies
        List<Long> dependencies = task.getDependencies();
        if (dependencies == null) {
            dependencies = new ArrayList<>();
        }
        
        // Add dependency if not already present
        if (!dependencies.contains(dependencyTaskId)) {
            dependencies.add(dependencyTaskId);
            task.setDependencies(dependencies);
            
            // Update task status to BLOCKED if it has dependencies
            if (task.getStatus() == TaskStatus.TODO) {
                task.setStatus(TaskStatus.BLOCKED);
            }
            
            caseTaskRepository.save(task);
            //log.info("Successfully added dependency {} to task {}", dependencyTaskId, taskId);
        }
    }

    @Override
    public void removeTaskDependency(Long taskId, Long dependencyTaskId) {
        //log.info("Removing dependency {} from task {}", dependencyTaskId, taskId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Get current dependencies
        List<Long> dependencies = task.getDependencies();
        if (dependencies != null && dependencies.contains(dependencyTaskId)) {
            dependencies.remove(dependencyTaskId);
            task.setDependencies(dependencies);
            
            // Update task status from BLOCKED to TODO if no more dependencies
            if (dependencies.isEmpty() && task.getStatus() == TaskStatus.BLOCKED) {
                task.setStatus(TaskStatus.TODO);
            }
            
            caseTaskRepository.save(task);
            //log.info("Successfully removed dependency {} from task {}", dependencyTaskId, taskId);
        }
    }

    @Override
    public List<CaseTaskDTO> getTaskDependencies(Long taskId) {
        //log.info("Getting dependencies for task {}", taskId);
        
        // Find the task
        CaseTask task = caseTaskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));
        
        // Get dependency IDs
        List<Long> dependencyIds = task.getDependencies();
        if (dependencyIds == null || dependencyIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Fetch dependency tasks
        List<CaseTask> dependencyTasks = caseTaskRepository.findAllById(dependencyIds);
        
        return dependencyTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseTaskDTO> getBlockedTasks(Long userId) {
        //log.info("Getting blocked tasks for user {}", userId);
        
        // Get all blocked tasks
        List<CaseTask> blockedTasks = caseTaskRepository.findBlockedTasks();
        
        // Filter by user if userId is provided
        if (userId != null) {
            blockedTasks = blockedTasks.stream()
                .filter(task -> task.getAssignedTo() != null && task.getAssignedTo().getId().equals(userId))
                .collect(Collectors.toList());
        }
        
        return blockedTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }
    
    private CaseTaskDTO convertToDTO(CaseTask task) {
        boolean isOverdue = task.getDueDate() != null && 
            task.getDueDate().isBefore(LocalDateTime.now()) && 
            task.getStatus() != TaskStatus.COMPLETED && 
            task.getStatus() != TaskStatus.CANCELLED;
            
        return CaseTaskDTO.builder()
            .id(task.getId())
            .caseId(task.getLegalCase() != null ? task.getLegalCase().getId() : null)
            .caseNumber(task.getLegalCase() != null ? task.getLegalCase().getCaseNumber() : null)
            .caseTitle(task.getLegalCase() != null ? task.getLegalCase().getTitle() : null)
            .parentTaskId(task.getParentTask() != null ? task.getParentTask().getId() : null)
            .parentTaskTitle(task.getParentTask() != null ? task.getParentTask().getTitle() : null)
            .title(task.getTitle())
            .description(task.getDescription())
            .taskType(task.getTaskType())
            .priority(task.getPriority())
            .status(task.getStatus())
            .assignedToId(task.getAssignedTo() != null ? task.getAssignedTo().getId() : null)
            .assignedToName(task.getAssignedTo() != null ? 
                task.getAssignedTo().getFirstName() + " " + task.getAssignedTo().getLastName() : null)
            .assignedToEmail(task.getAssignedTo() != null ? task.getAssignedTo().getEmail() : null)
            .assignedById(task.getAssignedBy() != null ? task.getAssignedBy().getId() : null)
            .assignedByName(task.getAssignedBy() != null ? 
                task.getAssignedBy().getFirstName() + " " + task.getAssignedBy().getLastName() : null)
            .estimatedHours(task.getEstimatedHours())
            .actualHours(task.getActualHours())
            .dueDate(task.getDueDate())
            .completedAt(task.getCompletedAt())
            .reminderDate(task.getReminderDate())
            .tags(task.getTags())
            .dependencies(task.getDependencies())
            .commentsCount(task.getComments() != null ? task.getComments().size() : 0)
            .overdue(isOverdue)
            .blocked(task.getStatus() == TaskStatus.BLOCKED)
            .createdAt(task.getCreatedAt())
            .updatedAt(task.getUpdatedAt())
            .build();
    }
    
    private TaskCommentDTO convertCommentToDTO(TaskComment comment) {
        return TaskCommentDTO.builder()
            .id(comment.getId())
            .taskId(comment.getTask().getId())
            .userId(comment.getUser().getId())
            .userName(comment.getUser().getFirstName() + " " + comment.getUser().getLastName())
            .userEmail(comment.getUser().getEmail())
            .comment(comment.getComment())
            .attachmentUrl(comment.getAttachmentUrl())
            .internal(comment.isInternal())
            .createdAt(comment.getCreatedAt())
            .build();
    }
} 