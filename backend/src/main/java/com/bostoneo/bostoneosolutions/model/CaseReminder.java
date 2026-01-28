package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for case reminders - persisted to database with tenant isolation
 */
@Entity
@Table(name = "case_reminders", indexes = {
    @Index(name = "idx_case_reminders_org_id", columnList = "organization_id"),
    @Index(name = "idx_case_reminders_case_id", columnList = "case_id"),
    @Index(name = "idx_case_reminders_user_id", columnList = "user_id"),
    @Index(name = "idx_case_reminders_status", columnList = "status"),
    @Index(name = "idx_case_reminders_due_date", columnList = "due_date")
})
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * SECURITY: Organization ID for tenant isolation
     */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "reminder_date")
    private LocalDateTime reminderDate;

    /**
     * Status: PENDING, COMPLETED, CANCELLED
     */
    @Column(nullable = false)
    private String status;

    /**
     * Priority: LOW, MEDIUM, HIGH, URGENT
     */
    @Column(nullable = false)
    private String priority;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "PENDING";
        }
        if (priority == null) {
            priority = "MEDIUM";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
