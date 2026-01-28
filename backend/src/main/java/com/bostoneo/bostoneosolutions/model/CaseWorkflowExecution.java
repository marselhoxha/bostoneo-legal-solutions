package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "case_workflow_executions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseWorkflowExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name")
    private String name;

    @Column(name = "collection_id")
    private Long collectionId;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private LegalCase legalCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private CaseWorkflowTemplate template;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private WorkflowExecutionStatus status = WorkflowExecutionStatus.PENDING;

    @Column(name = "current_step")
    @Builder.Default
    private Integer currentStep = 0;

    @Column(name = "total_steps", nullable = false)
    private Integer totalSteps;

    @Column(name = "progress_percentage")
    @Builder.Default
    private Integer progressPercentage = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User createdBy;

    @OneToMany(mappedBy = "workflowExecution", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnoreProperties("workflowExecution")
    @Builder.Default
    private List<CaseWorkflowStepExecution> stepExecutions = new ArrayList<>();

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

    public void updateProgress() {
        if (totalSteps != null && totalSteps > 0) {
            long completedSteps = stepExecutions.stream()
                .filter(step -> step.getStatus() == WorkflowExecutionStatus.COMPLETED)
                .count();
            this.progressPercentage = (int) ((completedSteps * 100) / totalSteps);
        }
    }

    public boolean isComplete() {
        return status == WorkflowExecutionStatus.COMPLETED;
    }

    public boolean isRunning() {
        return status == WorkflowExecutionStatus.RUNNING;
    }
}
