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

    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /** @deprecated Use findByWorkflowExecutionIdAndOrganizationIdOrderByStepNumber instead for tenant isolation */
    @Deprecated
    List<CaseWorkflowStepExecution> findByWorkflowExecutionIdOrderByStepNumber(Long executionId);

    /** @deprecated Use findByWorkflowExecutionIdAndStepNumberAndOrganizationId instead for tenant isolation */
    @Deprecated
    Optional<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndStepNumber(Long executionId, Integer stepNumber);

    /** @deprecated Use findByWorkflowExecutionIdAndStatusAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndStatus(Long executionId, WorkflowExecutionStatus status);

    /** @deprecated Use findPendingStepsByOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId AND s.status = 'PENDING' ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findPendingSteps(@Param("executionId") Long executionId);

    /** @deprecated Use findAllStepsOrderedByOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findAllStepsOrdered(@Param("executionId") Long executionId);

    /** @deprecated Use countCompletedStepsByOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT COUNT(s) FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId AND s.status = 'COMPLETED'")
    long countCompletedSteps(@Param("executionId") Long executionId);

    // ==================== TENANT-FILTERED METHODS ====================
    // Note: These filter through the parent CaseWorkflowExecution which has organization_id

    /** SECURITY: Find steps by workflow execution within organization */
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId " +
           "AND s.workflowExecution.organizationId = :orgId ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndOrganizationIdOrderByStepNumber(
        @Param("executionId") Long executionId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find step by execution and step number within organization */
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId " +
           "AND s.stepNumber = :stepNumber AND s.workflowExecution.organizationId = :orgId")
    Optional<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndStepNumberAndOrganizationId(
        @Param("executionId") Long executionId,
        @Param("stepNumber") Integer stepNumber,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find steps by execution and status within organization */
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId " +
           "AND s.status = :status AND s.workflowExecution.organizationId = :orgId")
    List<CaseWorkflowStepExecution> findByWorkflowExecutionIdAndStatusAndOrganizationId(
        @Param("executionId") Long executionId,
        @Param("status") WorkflowExecutionStatus status,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find pending steps within organization */
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId " +
           "AND s.status = 'PENDING' AND s.workflowExecution.organizationId = :orgId ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findPendingStepsByOrganizationId(
        @Param("executionId") Long executionId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find all steps ordered within organization */
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId " +
           "AND s.workflowExecution.organizationId = :orgId ORDER BY s.stepNumber ASC")
    List<CaseWorkflowStepExecution> findAllStepsOrderedByOrganizationId(
        @Param("executionId") Long executionId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Count completed steps within organization */
    @Query("SELECT COUNT(s) FROM CaseWorkflowStepExecution s WHERE s.workflowExecution.id = :executionId " +
           "AND s.status = 'COMPLETED' AND s.workflowExecution.organizationId = :orgId")
    long countCompletedStepsByOrganizationId(
        @Param("executionId") Long executionId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find step by ID within organization (joins through parent workflow execution) */
    @Query("SELECT s FROM CaseWorkflowStepExecution s WHERE s.id = :stepId " +
           "AND s.workflowExecution.organizationId = :orgId")
    Optional<CaseWorkflowStepExecution> findByIdAndOrganizationId(
        @Param("stepId") Long stepId,
        @Param("orgId") Long organizationId);
}
