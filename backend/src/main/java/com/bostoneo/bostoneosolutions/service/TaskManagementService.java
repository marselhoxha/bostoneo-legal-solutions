package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface TaskManagementService {
    
    // Task CRUD operations
    CaseTaskDTO createTask(CreateTaskRequest request);
    CaseTaskDTO updateTask(Long taskId, UpdateTaskRequest request);
    void deleteTask(Long taskId);
    CaseTaskDTO getTask(Long taskId);
    
    // Task queries
    Page<CaseTaskDTO> getAllTasks(Pageable pageable);
    Page<CaseTaskDTO> getCaseTasks(Long caseId, TaskFilterRequest filter, Pageable pageable);
    Page<CaseTaskDTO> getUserTasks(Long userId, TaskFilterRequest filter, Pageable pageable);
    List<CaseTaskDTO> getSubtasks(Long parentTaskId);
    List<CaseTaskDTO> getOverdueTasks(Long userId);
    List<CaseTaskDTO> getUpcomingTasks(Long userId, int days);
    
    // Task operations
    CaseTaskDTO assignTask(Long taskId, Long userId);
    CaseTaskDTO updateTaskStatus(Long taskId, TaskStatus status);
    CaseTaskDTO completeTask(Long taskId, CompleteTaskRequest request);
    
    // Task comments
    TaskCommentDTO addComment(Long taskId, CreateCommentRequest request);
    List<TaskCommentDTO> getTaskComments(Long taskId);
    void deleteComment(Long commentId);
    
    // Task analytics
    TaskAnalyticsDTO getTaskAnalytics(Long caseId);
    UserTaskMetricsDTO getUserTaskMetrics(Long userId);
    
    // Task dependencies
    void addTaskDependency(Long taskId, Long dependencyTaskId);
    void removeTaskDependency(Long taskId, Long dependencyTaskId);
    List<CaseTaskDTO> getTaskDependencies(Long taskId);
    List<CaseTaskDTO> getBlockedTasks(Long userId);
} 