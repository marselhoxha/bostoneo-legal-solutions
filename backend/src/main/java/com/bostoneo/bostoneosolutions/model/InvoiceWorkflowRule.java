package com.bostoneo.bostoneosolutions.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;

@Entity
@Table(name = "invoice_workflow_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceWorkflowRule {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @NotBlank(message = "Workflow name is required")
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(length = 500)
    private String description;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    // Trigger conditions
    @NotNull(message = "Trigger event is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_event", nullable = false, length = 50)
    private TriggerEvent triggerEvent;
    
    @Column(name = "trigger_status", length = 20)
    private String triggerStatus;
    
    @Column(name = "days_before_due")
    private Integer daysBeforeDue;
    
    @Column(name = "days_after_due")
    private Integer daysAfterDue;
    
    // Actions
    @NotNull(message = "Action type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 50)
    private ActionType actionType;
    
    @Column(name = "action_config", columnDefinition = "TEXT")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> actionConfig;
    
    // Execution settings
    @Column(name = "execution_time")
    private LocalTime executionTime;
    
    @Column(name = "max_executions")
    private Integer maxExecutions = 1;
    
    // Metadata
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // Enums
    public enum TriggerEvent {
        CREATED,
        STATUS_CHANGED,
        SCHEDULED,
        OVERDUE,
        PAYMENT_RECEIVED
    }
    
    public enum ActionType {
        SEND_EMAIL,
        UPDATE_STATUS,
        CREATE_REMINDER,
        APPLY_LATE_FEE
    }
}