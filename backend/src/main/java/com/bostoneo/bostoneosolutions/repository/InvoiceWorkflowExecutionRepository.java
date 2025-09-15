package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.InvoiceWorkflowExecution;
import org.springframework.data.jpa.repository.JpaRepository;
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
}