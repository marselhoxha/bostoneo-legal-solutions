package com.bostoneo.bostoneosolutions.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_workflow_executions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceWorkflowExecution {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "workflow_rule_id", nullable = false)
    private InvoiceWorkflowRule workflowRule;
    
    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;
    
    // Execution details
    @Column(name = "executed_at")
    private LocalDateTime executedAt = LocalDateTime.now();
    
    @NotNull
    @Column(nullable = false, length = 20)
    private String status; // SUCCESS, FAILED, SKIPPED
    
    @Column(name = "result_message", columnDefinition = "TEXT")
    private String resultMessage;
    
    // Transient fields for API responses
    @Transient
    private Long workflowRuleId;
    
    @Transient
    private Long invoiceId;
    
    @PostLoad
    private void postLoad() {
        if (workflowRule != null) {
            this.workflowRuleId = workflowRule.getId();
        }
        if (invoice != null) {
            this.invoiceId = invoice.getId();
        }
    }
}