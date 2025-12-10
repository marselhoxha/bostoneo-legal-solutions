package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}
