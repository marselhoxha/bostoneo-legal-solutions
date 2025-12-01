package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowStepExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseWorkflowStepExecutionRepository extends JpaRepository<CaseWorkflowStepExecution, Long> {

    List<CaseWorkflowStepExecution> findByWorkflowExecutionIdOrderByStepNumber(Long executionId);

    Optional<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndStepNumber(Long executionId, Integer stepNumber);

    List<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndStatus(Long executionId, WorkflowExecutionStatus status);

    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId AND s.status = 'PENDING' ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findPendingSteps(@Param("executionId") Long executionId);

    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findAllStepsOrdered(@Param("executionId") Long executionId);

    @Query("SELECT COUNT(s) FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId AND s.status = 'COMPLETED'")
    long countCompletedSteps(@Param("executionId") Long executionId);
}
