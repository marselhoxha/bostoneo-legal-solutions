package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InvoiceWorkflowRuleRepository extends JpaRepository<InvoiceWorkflowRule, Long> {
    
    List<InvoiceWorkflowRule> findByIsActiveTrue();
    
    List<InvoiceWorkflowRule> findByTriggerEventAndIsActiveTrue(InvoiceWorkflowRule.TriggerEvent triggerEvent);
    
    List<InvoiceWorkflowRule> findByActionTypeAndIsActiveTrue(InvoiceWorkflowRule.ActionType actionType);

    // ==================== TENANT-FILTERED METHODS ====================

    List<InvoiceWorkflowRule> findByOrganizationId(Long organizationId);

    java.util.Optional<InvoiceWorkflowRule> findByIdAndOrganizationId(Long id, Long organizationId);

    List<InvoiceWorkflowRule> findByOrganizationIdAndIsActiveTrue(Long organizationId);

    /** SECURITY: Find active rules by trigger event and organization */
    List<InvoiceWorkflowRule> findByOrganizationIdAndTriggerEventAndIsActiveTrue(Long organizationId, InvoiceWorkflowRule.TriggerEvent triggerEvent);
}