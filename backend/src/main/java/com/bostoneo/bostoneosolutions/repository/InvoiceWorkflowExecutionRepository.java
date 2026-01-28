package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.InvoiceWorkflowExecution;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InvoiceWorkflowExecutionRepository extends JpaRepository<InvoiceWorkflowExecution, Long> {
    
    List<InvoiceWorkflowExecution> findByInvoice_Id(Long invoiceId);
    
    List<InvoiceWorkflowExecution> findByInvoice_IdOrderByExecutedAtDesc(Long invoiceId);
    
    List<InvoiceWorkflowExecution> findByWorkflowRule_Id(Long workflowRuleId);
    
    List<InvoiceWorkflowExecution> findByWorkflowRule_IdOrderByExecutedAtDesc(Long workflowRuleId);
    
    long countByWorkflowRule_IdAndInvoice_Id(Long workflowRuleId, Long invoiceId);
    
    boolean existsByWorkflowRule_IdAndInvoice_IdAndExecutedAtAfter(Long workflowRuleId, Long invoiceId, LocalDateTime after);
    
    List<InvoiceWorkflowExecution> findByStatus(String status);

    // ==================== TENANT-FILTERED METHODS ====================

    Page<InvoiceWorkflowExecution> findByOrganizationIdOrderByExecutedAtDesc(Long organizationId, Pageable pageable);

    @Query("SELECT e FROM InvoiceWorkflowExecution e WHERE e.invoice.organizationId = :orgId ORDER BY e.executedAt DESC")
    Page<InvoiceWorkflowExecution> findByInvoiceOrganizationId(@Param("orgId") Long organizationId, Pageable pageable);

    @Query("SELECT e FROM InvoiceWorkflowExecution e WHERE e.invoice.organizationId = :orgId AND e.invoice.id = :invoiceId ORDER BY e.executedAt DESC")
    List<InvoiceWorkflowExecution> findByOrganizationIdAndInvoiceId(@Param("orgId") Long organizationId, @Param("invoiceId") Long invoiceId);

    @Query("SELECT e FROM InvoiceWorkflowExecution e WHERE e.invoice.organizationId = :orgId AND e.workflowRule.id = :workflowId ORDER BY e.executedAt DESC")
    List<InvoiceWorkflowExecution> findByOrganizationIdAndWorkflowRuleId(@Param("orgId") Long organizationId, @Param("workflowId") Long workflowId);

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    java.util.Optional<InvoiceWorkflowExecution> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}