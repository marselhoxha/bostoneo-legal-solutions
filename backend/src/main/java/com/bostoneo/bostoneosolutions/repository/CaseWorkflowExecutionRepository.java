package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseWorkflowExecutionRepository extends JpaRepository<CaseWorkflowExecution, Long> {

    List<CaseWorkflowExecution> findByCollectionId(Long collectionId);

    List<CaseWorkflowExecution> findByLegalCaseId(Long caseId);

    List<CaseWorkflowExecution> findByCreatedById(Long userId);

    List<CaseWorkflowExecution> findByStatus(WorkflowExecutionStatus status);

    List<CaseWorkflowExecution> findByCreatedByIdAndStatus(Long userId, WorkflowExecutionStatus status);

    @Query("SELECT e FROM CaseWorkflowExecution e WHERE e.status IN :statuses ORDER BY e.createdAt DESC")
    List<CaseWorkflowExecution> findByStatusIn(@Param("statuses") List<WorkflowExecutionStatus> statuses);

    @Query("SELECT e FROM CaseWorkflowExecution e WHERE e.createdBy.id = :userId ORDER BY e.createdAt DESC")
    List<CaseWorkflowExecution> findRecentByUser(@Param("userId") Long userId);

    @Query("SELECT COUNT(e) FROM CaseWorkflowExecution e WHERE e.status = :status")
    long countByStatus(@Param("status") WorkflowExecutionStatus status);

    @Query("SELECT e FROM CaseWorkflowExecution e LEFT JOIN FETCH e.template LEFT JOIN FETCH e.legalCase ORDER BY e.createdAt DESC")
    List<CaseWorkflowExecution> findAllWithTemplateAndCase();

    @Query("SELECT e FROM CaseWorkflowExecution e LEFT JOIN FETCH e.template LEFT JOIN FETCH e.legalCase WHERE e.createdBy.id = :userId ORDER BY e.createdAt DESC")
    List<CaseWorkflowExecution> findByUserIdWithTemplateAndCase(@Param("userId") Long userId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find execution by ID and organization (SECURITY: tenant isolation)
     */
    Optional<CaseWorkflowExecution> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find all executions for an organization (SECURITY: tenant isolation)
     */
    @Query("SELECT e FROM CaseWorkflowExecution e LEFT JOIN FETCH e.template LEFT JOIN FETCH e.legalCase WHERE e.organizationId = :orgId ORDER BY e.createdAt DESC")
    List<CaseWorkflowExecution> findByOrganizationIdWithTemplateAndCase(@Param("orgId") Long organizationId);

    /**
     * Find executions by user within an organization (SECURITY: tenant isolation)
     */
    @Query("SELECT e FROM CaseWorkflowExecution e LEFT JOIN FETCH e.template LEFT JOIN FETCH e.legalCase WHERE e.organizationId = :orgId AND e.createdBy.id = :userId ORDER BY e.createdAt DESC")
    List<CaseWorkflowExecution> findByOrganizationIdAndUserIdWithTemplateAndCase(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    /**
     * Find executions by collection within an organization (SECURITY: tenant isolation)
     */
    List<CaseWorkflowExecution> findByOrganizationIdAndCollectionId(Long organizationId, Long collectionId);

    /**
     * Find executions by case within an organization (SECURITY: tenant isolation)
     */
    List<CaseWorkflowExecution> findByOrganizationIdAndLegalCaseId(Long organizationId, Long caseId);

    /**
     * SECURITY: Find all workflow executions for an organization (tenant isolation)
     */
    List<CaseWorkflowExecution> findByOrganizationId(Long organizationId);
}
