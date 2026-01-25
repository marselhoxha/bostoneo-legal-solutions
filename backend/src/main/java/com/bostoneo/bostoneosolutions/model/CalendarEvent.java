package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "calendar_events")
public class CalendarEvent {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;
    
    @Column(name = "title", nullable = false)
    private String title;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;
    
    @Column(name = "end_time")
    private LocalDateTime endTime;
    
    @Column(name = "location")
    private String location;
    
    @Column(name = "event_type", nullable = false)
    private String eventType; // COURT_DATE, DEADLINE, MEETING, etc.
    
    @Column(name = "status")
    private String status; // SCHEDULED, COMPLETED, CANCELLED, etc.
    
    @Column(name = "all_day")
    private Boolean allDay;
    
    @Column(name = "recurrence_rule")
    private String recurrenceRule; // For recurring events (iCal format)
    
    @Column(name = "color")
    private String color; // For UI display
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id")
    private LegalCase legalCase;
    
    @Column(name = "case_id", insertable = false, updatable = false)
    private Long caseId;
    
    @Column(name = "user_id")
    private Long userId; // Creator of the event
    
    @Column(name = "reminder_minutes")
    private Integer reminderMinutes; // Minutes before event to send reminder
    
    @Column(name = "reminder_sent")
    private Boolean reminderSent;
    
    // Notification preference fields
    @Column(name = "email_notification")
    private Boolean emailNotification;
    
    @Column(name = "push_notification")
    private Boolean pushNotification;
    
    // New field to track additional reminders
    @Column(name = "additional_reminders")
    private String additionalReminders; // Comma-separated values of minutes

    // New field to track which additional reminders have been sent
    @Column(name = "reminders_sent")
    private String remindersSent; // Comma-separated values of minutes
    
    // New field to mark high priority deadlines
    @Column(name = "high_priority")
    private Boolean highPriority;
    
    @Column(name = "external_id")
    private String externalId; // ID in external calendar system
    
    @Column(name = "external_calendar")
    private String externalCalendar; // GOOGLE, OUTLOOK, etc.
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    // Helper methods for additional reminders
    public List<Integer> getAdditionalRemindersList() {
        if (additionalReminders == null || additionalReminders.isEmpty()) {
            return List.of();
        }
        return List.of(additionalReminders.split(",")).stream()
            .map(Integer::parseInt)
            .toList();
    }
    
    public void setAdditionalRemindersList(List<Integer> minutes) {
        if (minutes == null || minutes.isEmpty()) {
            this.additionalReminders = null;
            return;
        }
        this.additionalReminders = String.join(",", minutes.stream().map(String::valueOf).toList());
    }
    
    public List<Integer> getRemindersSentList() {
        if (remindersSent == null || remindersSent.isEmpty()) {
            return List.of();
        }
        return List.of(remindersSent.split(",")).stream()
            .map(Integer::parseInt)
            .toList();
    }
    
    public void setRemindersSentList(List<Integer> minutes) {
        if (minutes == null || minutes.isEmpty()) {
            this.remindersSent = null;
            return;
        }
        this.remindersSent = String.join(",", minutes.stream().map(String::valueOf).toList());
    }
} 