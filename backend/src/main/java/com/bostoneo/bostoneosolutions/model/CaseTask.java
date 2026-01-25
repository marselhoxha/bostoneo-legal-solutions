package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.TaskPriority;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.enumeration.TaskType;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "case_tasks")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseTask {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private LegalCase legalCase;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_task_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private CaseTask parentTask;
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "task_type", nullable = false)
    private TaskType taskType;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPriority priority = TaskPriority.MEDIUM;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.TODO;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User assignedTo;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User assignedBy;
    
    @Column(name = "estimated_hours", precision = 5, scale = 2)
    private BigDecimal estimatedHours;
    
    @Column(name = "actual_hours", precision = 5, scale = 2)
    private BigDecimal actualHours;
    
    @Column(name = "due_date")
    private LocalDateTime dueDate;
    
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    
    @Column(name = "reminder_date")
    private LocalDateTime reminderDate;
    
    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private List<Long> dependencies = new ArrayList<>();
    
    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private List<String> tags = new ArrayList<>();
    
    @OneToMany(mappedBy = "parentTask", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"parentTask", "legalCase"})
    private List<CaseTask> subtasks = new ArrayList<>();
    
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnoreProperties("task")
    private List<TaskComment> comments = new ArrayList<>();
    
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
    
    /**
     * Check if task is overdue
     */
    public boolean isOverdue() {
        return dueDate != null && 
               LocalDateTime.now().isAfter(dueDate) && 
               status != TaskStatus.COMPLETED && 
               status != TaskStatus.CANCELLED;
    }
    
    /**
     * Check if task is blocked by dependencies
     */
    public boolean isBlocked() {
        return status == TaskStatus.BLOCKED || 
               (dependencies != null && !dependencies.isEmpty());
    }
    
    /**
     * Calculate progress percentage based on subtasks
     */
    public int calculateProgress() {
        if (subtasks == null || subtasks.isEmpty()) {
            return status == TaskStatus.COMPLETED ? 100 : 0;
        }
        
        long completedSubtasks = subtasks.stream()
            .filter(task -> task.getStatus() == TaskStatus.COMPLETED)
            .count();
        
        return (int) ((completedSubtasks * 100) / subtasks.size());
    }
}