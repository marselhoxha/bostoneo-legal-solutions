package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskPriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TaskStatus;
import com.***REMOVED***.***REMOVED***solutions.model.CaseTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CaseTaskRepository extends JpaRepository<CaseTask, Long> {
    
    /**
     * Find tasks by case ID
     */
    @Query("SELECT ct FROM CaseTask ct WHERE ct.legalCase.id = :caseId " +
           "ORDER BY ct.priority DESC, ct.dueDate ASC")
    List<CaseTask> findByCaseId(@Param("caseId") Long caseId);
    
    /**
     * Find tasks assigned to a user
     */
    @Query("SELECT ct FROM CaseTask ct WHERE ct.assignedTo.id = :userId " +
           "AND ct.status IN :statuses ORDER BY ct.priority DESC, ct.dueDate ASC")
    Page<CaseTask> findByAssignedToAndStatuses(
        @Param("userId") Long userId,
        @Param("statuses") List<TaskStatus> statuses,
        Pageable pageable
    );
    
    /**
     * Find overdue tasks for a user
     */
    @Query("SELECT ct FROM CaseTask ct WHERE ct.assignedTo.id = :userId " +
           "AND ct.dueDate < CURRENT_TIMESTAMP AND ct.status NOT IN ('COMPLETED', 'CANCELLED')")
    List<CaseTask> findOverdueTasksByUser(@Param("userId") Long userId);
    
    /**
     * Count overdue tasks for a user
     */
    @Query("SELECT COUNT(ct) FROM CaseTask ct WHERE ct.assignedTo.id = :userId " +
           "AND ct.dueDate < CURRENT_TIMESTAMP AND ct.status NOT IN ('COMPLETED', 'CANCELLED')")
    int countOverdueTasksByUserId(@Param("userId") Long userId);
    
    /**
     * Find upcoming tasks with deadlines
     */
    @Query("SELECT ct FROM CaseTask ct WHERE ct.assignedTo.id = :userId " +
           "AND ct.dueDate BETWEEN CURRENT_TIMESTAMP AND :endDate " +
           "AND ct.status NOT IN ('COMPLETED', 'CANCELLED') " +
           "ORDER BY ct.dueDate ASC")
    List<CaseTask> findUpcomingTasksByAssignee(
        @Param("userId") Long userId,
        @Param("endDate") LocalDateTime endDate
    );
    
    /**
     * Count upcoming deadlines
     */
    @Query("SELECT COUNT(ct) FROM CaseTask ct WHERE ct.assignedTo.id = :userId " +
           "AND ct.dueDate BETWEEN CURRENT_TIMESTAMP AND :endDate " +
           "AND ct.status NOT IN ('COMPLETED', 'CANCELLED')")
    int countUpcomingDeadlinesByUserId(
        @Param("userId") Long userId,
        @Param("endDate") LocalDateTime endDate
    );
    
    /**
     * Find tasks by status and priority
     */
    List<CaseTask> findByStatusAndPriority(TaskStatus status, TaskPriority priority);
    
    /**
     * Find subtasks of a parent task
     */
    List<CaseTask> findByParentTaskId(Long parentTaskId);
    
    /**
     * Find tasks with reminders due
     */
    @Query("SELECT ct FROM CaseTask ct WHERE ct.reminderDate <= CURRENT_TIMESTAMP " +
           "AND ct.reminderDate > :lastCheck AND ct.status NOT IN ('COMPLETED', 'CANCELLED')")
    List<CaseTask> findTasksWithDueReminders(@Param("lastCheck") LocalDateTime lastCheck);
    
    /**
     * Find blocked tasks
     */
    @Query("SELECT ct FROM CaseTask ct WHERE ct.status = 'BLOCKED' " +
           "OR (ct.dependencies IS NOT NULL AND SIZE(ct.dependencies) > 0)")
    List<CaseTask> findBlockedTasks();
    
    /**
     * Get task completion statistics for a case
     */
    @Query("SELECT ct.status, COUNT(ct) FROM CaseTask ct " +
           "WHERE ct.legalCase.id = :caseId GROUP BY ct.status")
    List<Object[]> getTaskStatisticsByCaseId(@Param("caseId") Long caseId);
    
    /**
     * Find tasks by tag
     */
    @Query(value = "SELECT * FROM case_tasks ct WHERE JSON_CONTAINS(ct.tags, :tag, '$')", 
           nativeQuery = true)
    List<CaseTask> findByTag(@Param("tag") String tag);
    
    /**
     * Calculate average task completion time
     */
    @Query(value = "SELECT AVG(TIMESTAMPDIFF(HOUR, ct.created_at, ct.completed_at)) " +
           "FROM case_tasks ct WHERE ct.assigned_to = :userId " +
           "AND ct.status = 'COMPLETED' AND ct.completed_at IS NOT NULL",
           nativeQuery = true)
    Double calculateAverageCompletionTime(@Param("userId") Long userId);
}