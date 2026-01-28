package com.bostoneo.bostoneosolutions.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "invoice_reminders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceReminder {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;
    
    // Reminder details
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "reminder_type", nullable = false, length = 50)
    private ReminderType reminderType;
    
    @NotNull
    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;
    
    @Column(name = "scheduled_time")
    private LocalTime scheduledTime;
    
    // Status
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ReminderStatus status = ReminderStatus.PENDING;
    
    @Column(name = "sent_at")
    private LocalDateTime sentAt;
    
    // Content
    @Column(length = 255)
    private String subject;
    
    @Column(columnDefinition = "TEXT")
    private String message;
    
    @Column(columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> recipients;
    
    // Metadata
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_workflow")
    private InvoiceWorkflowRule createdByWorkflow;

    @Column(name = "organization_id")
    private Long organizationId;
    
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
    public enum ReminderType {
        DUE_SOON,
        OVERDUE,
        PAYMENT_RECEIVED,
        CUSTOM
    }
    
    public enum ReminderStatus {
        PENDING,
        SENT,
        CANCELLED
    }
}