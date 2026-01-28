package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.TaskPriority;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.model.CaseTask;
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
     * @deprecated Use findByTagAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT * FROM case_tasks ct WHERE ct.tags @> :tag::jsonb",
           nativeQuery = true)
    List<CaseTask> findByTag(@Param("tag") String tag);

    /**
     * Calculate average task completion time
     * @deprecated Use calculateAverageCompletionTimeByOrganization instead for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (ct.completed_at - ct.created_at))/3600) " +
           "FROM case_tasks ct WHERE ct.assigned_to = :userId " +
           "AND ct.status = 'COMPLETED' AND ct.completed_at IS NOT NULL",
           nativeQuery = true)
    Double calculateAverageCompletionTime(@Param("userId") Long userId);

    // ==================== TENANT-FILTERED METHODS ====================

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId ORDER BY ct.priority DESC, ct.dueDate ASC")
    Page<CaseTask> findByOrganizationId(@Param("orgId") Long organizationId, Pageable pageable);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId AND ct.legalCase.id = :caseId " +
           "ORDER BY ct.priority DESC, ct.dueDate ASC")
    List<CaseTask> findByOrganizationIdAndCaseId(@Param("orgId") Long organizationId, @Param("caseId") Long caseId);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId AND ct.assignedTo.id = :userId " +
           "AND ct.status IN :statuses ORDER BY ct.priority DESC, ct.dueDate ASC")
    Page<CaseTask> findByOrganizationIdAndAssignedToAndStatuses(@Param("orgId") Long organizationId,
                                                                @Param("userId") Long userId,
                                                                @Param("statuses") List<TaskStatus> statuses,
                                                                Pageable pageable);

    @Query("SELECT COUNT(ct) FROM CaseTask ct WHERE ct.organizationId = :orgId")
    long countByOrganizationId(@Param("orgId") Long organizationId);

    @Query("SELECT COUNT(ct) FROM CaseTask ct WHERE ct.organizationId = :orgId " +
           "AND ct.dueDate < CURRENT_TIMESTAMP AND ct.status NOT IN ('COMPLETED', 'CANCELLED')")
    int countOverdueTasksByOrganization(@Param("orgId") Long organizationId);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId AND (ct.status = 'BLOCKED' " +
           "OR (ct.dependencies IS NOT NULL AND SIZE(ct.dependencies) > 0))")
    List<CaseTask> findBlockedTasksByOrganization(@Param("orgId") Long organizationId);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.id = :id AND ct.organizationId = :orgId")
    java.util.Optional<CaseTask> findByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long organizationId);

    @Query("SELECT CASE WHEN COUNT(ct) > 0 THEN true ELSE false END FROM CaseTask ct WHERE ct.id = :id AND ct.organizationId = :orgId")
    boolean existsByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long organizationId);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId AND ct.parentTask.id = :parentTaskId")
    List<CaseTask> findByOrganizationIdAndParentTaskId(@Param("orgId") Long organizationId, @Param("parentTaskId") Long parentTaskId);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId AND ct.assignedTo.id = :userId " +
           "AND ct.dueDate < CURRENT_TIMESTAMP AND ct.status NOT IN ('COMPLETED', 'CANCELLED')")
    List<CaseTask> findOverdueTasksByOrganizationAndUser(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    @Query("SELECT ct FROM CaseTask ct WHERE ct.organizationId = :orgId AND ct.assignedTo.id = :userId " +
           "AND ct.dueDate BETWEEN CURRENT_TIMESTAMP AND :endDate " +
           "AND ct.status NOT IN ('COMPLETED', 'CANCELLED') " +
           "ORDER BY ct.dueDate ASC")
    List<CaseTask> findUpcomingTasksByOrganizationAndAssignee(@Param("orgId") Long organizationId,
                                                               @Param("userId") Long userId,
                                                               @Param("endDate") LocalDateTime endDate);

    @Query("SELECT ct.status, COUNT(ct) FROM CaseTask ct " +
           "WHERE ct.organizationId = :orgId AND ct.legalCase.id = :caseId GROUP BY ct.status")
    List<Object[]> getTaskStatisticsByOrganizationAndCaseId(@Param("orgId") Long organizationId, @Param("caseId") Long caseId);

    /**
     * SECURITY: Find tasks by tag within an organization
     */
    @Query(value = "SELECT * FROM case_tasks ct WHERE ct.organization_id = :orgId AND ct.tags @> :tag::jsonb",
           nativeQuery = true)
    List<CaseTask> findByTagAndOrganizationId(@Param("tag") String tag, @Param("orgId") Long organizationId);

    /**
     * SECURITY: Calculate average task completion time within an organization
     */
    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (ct.completed_at - ct.created_at))/3600) " +
           "FROM case_tasks ct WHERE ct.organization_id = :orgId AND ct.assigned_to = :userId " +
           "AND ct.status = 'COMPLETED' AND ct.completed_at IS NOT NULL",
           nativeQuery = true)
    Double calculateAverageCompletionTimeByOrganization(@Param("orgId") Long organizationId, @Param("userId") Long userId);
}