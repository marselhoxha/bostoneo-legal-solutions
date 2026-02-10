package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.exception.ApiException;
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
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                return ((UserDTO) principal).getId();
            } else if (principal instanceof UserPrincipal) {
                return ((UserPrincipal) principal).getUser().getId();
            }
        }
        throw new RuntimeException("Authentication required - could not determine current user");
    }

    /**
     * Check if the current user has privileges to manage any task.
     * Admins, managers, superadmins, and attorneys can modify any task.
     */
    private boolean isAdminOrManager() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserPrincipal) {
                UserPrincipal userPrincipal = (UserPrincipal) principal;
                return userPrincipal.hasRole("ADMIN") || userPrincipal.hasRole("ROLE_ADMIN") ||
                       userPrincipal.hasRole("MANAGER") || userPrincipal.hasRole("ROLE_MANAGER") ||
                       userPrincipal.hasRole("ROLE_SUPERADMIN") || userPrincipal.hasRole("ROLE_ATTORNEY");
            } else if (principal instanceof UserDTO) {
                UserDTO userDTO = (UserDTO) principal;
                String role = userDTO.getRoleName();
                return role != null && (role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("ROLE_ADMIN") ||
                       role.equalsIgnoreCase("MANAGER") || role.equalsIgnoreCase("ROLE_MANAGER") ||
                       role.equalsIgnoreCase("ROLE_SUPERADMIN") || role.equalsIgnoreCase("ROLE_ATTORNEY"));
            }
        }
        return false;
    }

    /**
     * Check if the current user can modify a specific task.
     * Admins/Managers can modify any task.
     * Task creator (assignedBy) can modify their own tasks.
     * Task assignee can modify tasks assigned to them.
     */
    private void validateTaskModificationPermission(CaseTask task) {
        if (isAdminOrManager()) {
            return;
        }

        Long currentUserId = getCurrentUserId();
        Long assignedToId = task.getAssignedTo() != null ? task.getAssignedTo().getId() : null;
        Long creatorId = task.getAssignedBy() != null ? task.getAssignedBy().getId() : null;

        // Allow if task is assigned to current user or current user created it
        if ((assignedToId != null && assignedToId.equals(currentUserId))
                || (creatorId != null && creatorId.equals(currentUserId))) {
            return;
        }

        throw new ApiException("You can only modify tasks assigned to you or created by you");
    }

    @Override
    public CaseTaskDTO createTask(CreateTaskRequest request) {
        log.info("Creating new task for case {}", request.getCaseId());
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to fetch the legal case
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(request.getCaseId(), orgId)
            .orElseThrow(() -> new IllegalArgumentException("Legal case not found or access denied: " + request.getCaseId()));
        
        // Get current user as the creator (assigned_by) from security context
        Long currentUserId = getCurrentUserId();
        User assignedBy = userRepository.get(currentUserId);
        if (assignedBy == null) {
            throw new IllegalArgumentException("Current user not found with ID: " + currentUserId);
        }
        
        // Create new CaseTask entity
        CaseTask.CaseTaskBuilder taskBuilder = CaseTask.builder()
            .organizationId(orgId) // SECURITY: Set organization ID
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
            // SECURITY: Use tenant-filtered query
            CaseTask parentTask = caseTaskRepository.findByIdAndOrganizationId(request.getParentTaskId(), orgId)
                .orElseThrow(() -> new IllegalArgumentException("Parent task not found or access denied: " + request.getParentTaskId()));
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

        // Send notifications to case assignees (excluding the current user who created the task)
        try {
            String title = "New Task Created";
            String message = String.format("New task \"%s\" has been created for case \"%s\"",
                savedTask.getTitle(), legalCase.getTitle());

            Set<Long> notificationUserIds = new HashSet<>();

            // SECURITY: Get users assigned to the case with org filter
            List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(savedTask.getLegalCase().getId(), orgId);
            for (CaseAssignment assignment : caseAssignments) {
                if (assignment.getAssignedTo() != null) {
                    notificationUserIds.add(assignment.getAssignedTo().getId());
                }
            }

            // Also notify the assigned user if different from case assignees
            if (savedTask.getAssignedTo() != null) {
                notificationUserIds.add(savedTask.getAssignedTo().getId());
            }

            // Remove the current user from notification list (don't notify yourself)
            notificationUserIds.remove(currentUserId);

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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        // AUTHORIZATION: Check if user can modify this task
        // Admins/Managers can modify any task, others can only modify their assigned tasks
        validateTaskModificationPermission(task);

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
        // Skip notification if user is assigning to themselves (self-assignment)
        Long currentUserId = getCurrentUserId();
        boolean isSelfAssignment = newAssignedToId != null && newAssignedToId.equals(currentUserId);

        if (!isSelfAssignment && newAssignedToId != null && oldAssignedTo != null &&
            !oldAssignedTo.getId().equals(newAssignedToId) && newAssignedToId != 0) {
            // Task was reassigned to a different user (not self)
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
        } else if (!isSelfAssignment && newAssignedToId != null && oldAssignedTo == null && newAssignedToId != 0) {
            // Task was assigned for the first time (not self)
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
        
        // Send status change notifications (excluding the user who made the change)
        if (oldStatus != null && newStatus != null && !oldStatus.equals(newStatus)) {
            try {
                String title = "Task Status Changed";
                String message = String.format("Task \"%s\" status changed from %s to %s",
                    updatedTask.getTitle(), oldStatus, newStatus);

                Set<Long> notificationUserIds = new HashSet<>();

                // SECURITY: Get users assigned to the case with org filter
                List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(updatedTask.getLegalCase().getId(), orgId);
                for (CaseAssignment assignment : caseAssignments) {
                    if (assignment.getAssignedTo() != null) {
                        notificationUserIds.add(assignment.getAssignedTo().getId());
                    }
                }

                // Also notify the assigned user if different from case assignees
                if (updatedTask.getAssignedTo() != null) {
                    notificationUserIds.add(updatedTask.getAssignedTo().getId());
                }

                // Remove the current user from notification list (don't notify yourself)
                notificationUserIds.remove(currentUserId);

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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify ownership before deletion
        if (!caseTaskRepository.existsByIdAndOrganizationId(taskId, orgId)) {
            throw new IllegalArgumentException("Task not found or access denied: " + taskId);
        }

        // Delete the task (this will cascade delete subtasks and comments)
        caseTaskRepository.deleteById(taskId);

        //log.info("Successfully deleted task {}", taskId);
    }

    @Override
    public CaseTaskDTO getTask(Long taskId) {
        //log.info("Getting task {}", taskId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        return convertToDTO(task);
    }

    @Override
    public Page<CaseTaskDTO> getAllTasks(Pageable pageable) {
        //log.info("Getting all tasks with pagination");

        // Use tenant-filtered query - throw exception if no organization context
        Page<CaseTask> tasksPage = tenantService.getCurrentOrganizationId()
            .map(orgId -> caseTaskRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        List<CaseTaskDTO> taskDTOs = tasksPage.getContent().stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());

        return new PageImpl<>(taskDTOs, pageable, tasksPage.getTotalElements());
    }
    
    @Override
    public Page<CaseTaskDTO> getCaseTasks(Long caseId, TaskFilterRequest filter, Pageable pageable) {
        //log.info("Getting tasks for case: {}", caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<CaseTask> tasks = caseTaskRepository.findByOrganizationIdAndCaseId(orgId, caseId);

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
        Long orgId = getRequiredOrganizationId();

        List<TaskStatus> statuses = filter.getStatuses();
        if (statuses == null || statuses.isEmpty()) {
            // Default to active statuses
            statuses = List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.BLOCKED);
        }

        // SECURITY: Use tenant-filtered query
        Page<CaseTask> tasksPage = caseTaskRepository.findByOrganizationIdAndAssignedToAndStatuses(orgId, userId, statuses, pageable);

        List<CaseTaskDTO> taskDTOs = tasksPage.getContent().stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());

        return new PageImpl<>(taskDTOs, pageable, tasksPage.getTotalElements());
    }

    @Override
    public List<CaseTaskDTO> getSubtasks(Long parentTaskId) {
        //log.info("Getting subtasks for parent task: {}", parentTaskId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<CaseTask> subtasks = caseTaskRepository.findByOrganizationIdAndParentTaskId(orgId, parentTaskId);

        return subtasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseTaskDTO> getOverdueTasks(Long userId) {
        //log.info("Getting overdue tasks for user: {}", userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<CaseTask> overdueTasks = caseTaskRepository.findOverdueTasksByOrganizationAndUser(orgId, userId);

        return overdueTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseTaskDTO> getUpcomingTasks(Long userId, int days) {
        //log.info("Getting upcoming tasks for user: {} within {} days", userId, days);
        Long orgId = getRequiredOrganizationId();

        LocalDateTime endDate = LocalDateTime.now().plusDays(days);
        // SECURITY: Use tenant-filtered query
        List<CaseTask> upcomingTasks = caseTaskRepository.findUpcomingTasksByOrganizationAndAssignee(orgId, userId, endDate);

        return upcomingTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public CaseTaskDTO assignTask(Long taskId, Long userId) {
        //log.info("Assigning task {} to user {}", taskId, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));
        
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

        // Send task assignment notification only if NOT self-assignment
        Long currentUserId = getCurrentUserId();
        boolean isSelfAssignment = userId.equals(currentUserId);

        if (!isSelfAssignment) {
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
        }

        //log.info("Successfully assigned task {} to user {}", taskId, userId);
        return convertToDTO(updatedTask);
    }

    @Override
    public CaseTaskDTO updateTaskStatus(Long taskId, TaskStatus status) {
        //log.info("Updating task {} status to {}", taskId, status);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        // AUTHORIZATION: Check if user can modify this task
        // Admins/Managers can modify any task, others can only modify their assigned tasks
        validateTaskModificationPermission(task);

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

        // Send status change notifications (excluding the user who made the change)
        try {
            Long currentUserId = getCurrentUserId();
            String title = "Task Status Changed";
            String message = String.format("Task \"%s\" status changed to %s",
                updatedTask.getTitle(), status);

            Set<Long> notificationUserIds = new HashSet<>();

            // SECURITY: Get users assigned to the case with org filter
            List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(updatedTask.getLegalCase().getId(), orgId);
            for (CaseAssignment assignment : caseAssignments) {
                if (assignment.getAssignedTo() != null) {
                    notificationUserIds.add(assignment.getAssignedTo().getId());
                }
            }

            // Also notify the assigned user if different from case assignees
            if (updatedTask.getAssignedTo() != null) {
                notificationUserIds.add(updatedTask.getAssignedTo().getId());
            }

            // Remove the current user from notification list (don't notify yourself)
            notificationUserIds.remove(currentUserId);

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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        // AUTHORIZATION: Check if user can modify this task
        // Admins/Managers can modify any task, others can only modify their assigned tasks
        validateTaskModificationPermission(task);
        
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        // Get current user from security context
        Long currentUserId = getCurrentUserId();
        User user = userRepository.get(currentUserId);
        if (user == null) {
            throw new IllegalArgumentException("User not found with ID: " + currentUserId);
        }

        // Create new comment with organization context
        TaskComment comment = TaskComment.builder()
            .organizationId(orgId)  // SECURITY: Set organization context
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Check if task exists within organization
        if (!caseTaskRepository.existsByIdAndOrganizationId(taskId, orgId)) {
            throw new IllegalArgumentException("Task not found or access denied: " + taskId);
        }

        // SECURITY: Use tenant-filtered query
        List<TaskComment> comments = taskCommentRepository.findByTaskIdAndOrganizationId(taskId, orgId);

        return comments.stream()
            .map(this::convertCommentToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public void deleteComment(Long commentId) {
        //log.info("Deleting comment {}", commentId);

        // Get organization context
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        // SECURITY: Verify comment exists and belongs to current organization
        TaskComment comment = taskCommentRepository.findByIdAndOrganizationId(commentId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Comment not found with ID: " + commentId));

        // Delete the comment
        taskCommentRepository.delete(comment);

        //log.info("Successfully deleted comment {}", commentId);
    }

    @Override
    public TaskAnalyticsDTO getTaskAnalytics(Long caseId) {
        //log.info("Getting task analytics for case {}", caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to get all tasks for the case
        List<CaseTask> tasks = caseTaskRepository.findByOrganizationIdAndCaseId(orgId, caseId);
        
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
        List<Object[]> statusStats = caseTaskRepository.getTaskStatisticsByOrganizationAndCaseId(orgId, caseId);

        // SECURITY: Use tenant-filtered query to get the case details
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify user belongs to current organization
        User user = userRepository.get(userId);
        if (user == null || !orgId.equals(user.getOrganizationId())) {
            throw new RuntimeException("User not found or access denied: " + userId);
        }

        // Get all active tasks for the user - SECURITY: Use org-filtered query
        List<TaskStatus> activeStatuses = List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.BLOCKED);
        Page<CaseTask> userTasksPage = caseTaskRepository.findByOrganizationIdAndAssignedToAndStatuses(orgId, userId, activeStatuses, Pageable.unpaged());
        List<CaseTask> userTasks = userTasksPage.getContent();

        // Calculate metrics - SECURITY: Use org-filtered queries
        int totalAssignedTasks = userTasks.size();
        int completedTasksCount = caseTaskRepository.findByOrganizationIdAndAssignedToAndStatuses(orgId, userId, List.of(TaskStatus.COMPLETED), Pageable.unpaged()).getNumberOfElements();
        List<CaseTask> overdueTasks = caseTaskRepository.findOverdueTasksByOrganizationAndUser(orgId, userId);
        List<CaseTask> upcomingTasks = caseTaskRepository.findUpcomingTasksByOrganizationAndAssignee(orgId, userId, LocalDateTime.now().plusDays(7));

        // Calculate average completion time - SECURITY: Use org-filtered query
        Double avgCompletionTime = caseTaskRepository.calculateAverageCompletionTimeByOrganization(orgId, userId);
        if (avgCompletionTime == null) {
            avgCompletionTime = 0.0;
        }
        
        // Task priority breakdown
        // Build priority map (user already retrieved above)
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
            .overdueTasks(overdueTasks.size())
            .upcomingTasks(upcomingTasks.size())
            .completionRate(BigDecimal.valueOf(completionRate))
            .averageCompletionTime(BigDecimal.valueOf(avgCompletionTime))
            .tasksByPriority(tasksByPriority)
            .tasksByStatus(tasksByStatus)
            .build();
    }

    @Override
    public void addTaskDependency(Long taskId, Long dependencyTaskId) {
        //log.info("Adding dependency {} to task {}", dependencyTaskId, taskId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        // SECURITY: Check if dependency task exists within organization
        if (!caseTaskRepository.existsByIdAndOrganizationId(dependencyTaskId, orgId)) {
            throw new IllegalArgumentException("Dependency task not found or access denied: " + dependencyTaskId);
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));
        
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to find the task
        CaseTask task = caseTaskRepository.findByIdAndOrganizationId(taskId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found or access denied: " + taskId));

        // Get dependency IDs
        List<Long> dependencyIds = task.getDependencies();
        if (dependencyIds == null || dependencyIds.isEmpty()) {
            return new ArrayList<>();
        }

        // Fetch dependency tasks and filter by organization (extra security layer)
        List<CaseTask> dependencyTasks = caseTaskRepository.findAllById(dependencyIds).stream()
            .filter(t -> orgId.equals(t.getOrganizationId()))
            .collect(Collectors.toList());

        return dependencyTasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseTaskDTO> getBlockedTasks(Long userId) {
        //log.info("Getting blocked tasks for user {}", userId);

        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        // SECURITY: Use tenant-filtered query
        List<CaseTask> blockedTasks = caseTaskRepository.findBlockedTasksByOrganization(orgId);

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