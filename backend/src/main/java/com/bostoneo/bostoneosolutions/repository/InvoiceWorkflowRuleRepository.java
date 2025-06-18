package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.InvoiceWorkflowRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InvoiceWorkflowRuleRepository extends JpaRepository<InvoiceWorkflowRule, Long> {
    
    List<InvoiceWorkflowRule> findByIsActiveTrue();
    
    List<InvoiceWorkflowRule> findByTriggerEventAndIsActiveTrue(InvoiceWorkflowRule.TriggerEvent triggerEvent);
    
    List<InvoiceWorkflowRule> findByActionTypeAndIsActiveTrue(InvoiceWorkflowRule.ActionType actionType);
}