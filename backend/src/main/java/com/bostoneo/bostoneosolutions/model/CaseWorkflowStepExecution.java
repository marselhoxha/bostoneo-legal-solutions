package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.enumeration.WorkflowStepType;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "case_workflow_step_executions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseWorkflowStepExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_execution_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "stepExecutions"})
    private CaseWorkflowExecution workflowExecution;

    @Column(name = "step_number", nullable = false)
    private Integer stepNumber;

    @Column(name = "step_name", nullable = false)
    private String stepName;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false)
    private WorkflowStepType stepType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private WorkflowExecutionStatus status = WorkflowExecutionStatus.PENDING;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Type(JsonType.class)
    @Column(name = "input_data", columnDefinition = "json")
    private Map<String, Object> inputData;

    @Type(JsonType.class)
    @Column(name = "output_data", columnDefinition = "json")
    private Map<String, Object> outputData;

    @Column(name = "related_resource_type")
    private String relatedResourceType;

    @Column(name = "related_resource_id")
    private Long relatedResourceId;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
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

    public boolean isComplete() {
        return status == WorkflowExecutionStatus.COMPLETED;
    }

    public boolean isFailed() {
        return status == WorkflowExecutionStatus.FAILED;
    }

    public boolean isWaitingForUser() {
        return status == WorkflowExecutionStatus.WAITING_USER;
    }
}
