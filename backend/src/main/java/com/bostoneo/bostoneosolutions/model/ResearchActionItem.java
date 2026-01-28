package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "research_action_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResearchActionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * SECURITY: Organization ID for multi-tenant isolation
     */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "research_session_id", nullable = false)
    private Long researchSessionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "case_id")
    private Long caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private ActionType actionType;

    @Column(name = "source_finding", nullable = false, columnDefinition = "TEXT")
    private String sourceFinding;

    @Column(name = "source_citation", length = 500)
    private String sourceCitation;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_status")
    private ActionStatus actionStatus = ActionStatus.PENDING;

    // For DRAFT_MOTION
    @Column(name = "draft_document_id", length = 36)
    private String draftDocumentId; // UUID reference to legal_documents

    @Column(name = "document_type", length = 100)
    private String documentType;

    // For CREATE_DEADLINE
    @Column(name = "deadline_date")
    private LocalDateTime deadlineDate;

    @Column(name = "deadline_type", length = 100)
    private String deadlineType;

    @Column(name = "calendar_event_id")
    private Long calendarEventId;

    // For CREATE_TASK
    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "task_description", columnDefinition = "TEXT")
    private String taskDescription;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_priority")
    private TaskPriority taskPriority;

    // Metadata
    @Column(name = "ai_confidence_score", precision = 5, scale = 2)
    private BigDecimal aiConfidenceScore;

    @Column(name = "user_modified")
    private Boolean userModified = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "dismissed_at")
    private LocalDateTime dismissedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (actionStatus == null) {
            actionStatus = ActionStatus.PENDING;
        }
        if (userModified == null) {
            userModified = false;
        }
    }

    public enum ActionType {
        DRAFT_MOTION,
        CREATE_DEADLINE,
        ATTACH_DOCUMENT,
        CREATE_TASK,
        ADD_NOTE,
        SCHEDULE_EVENT
    }

    public enum ActionStatus {
        PENDING,
        IN_PROGRESS,
        COMPLETED,
        DISMISSED
    }

    public enum TaskPriority {
        LOW,
        MEDIUM,
        HIGH,
        URGENT
    }
}
