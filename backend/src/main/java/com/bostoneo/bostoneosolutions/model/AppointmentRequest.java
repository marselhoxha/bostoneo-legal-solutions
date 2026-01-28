package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Tracks appointment requests from clients to attorneys.
 * Once confirmed, links to a CalendarEvent for the actual scheduled event.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "appointment_requests")
public class AppointmentRequest {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "calendar_event_id")
    private Long calendarEventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calendar_event_id", insertable = false, updatable = false)
    private CalendarEvent calendarEvent;

    @Column(name = "case_id")
    private Long caseId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", insertable = false, updatable = false)
    private LegalCase legalCase;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", insertable = false, updatable = false)
    private Client client;

    @Column(name = "attorney_id", nullable = false)
    private Long attorneyId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Type: CONSULTATION, MEETING, FOLLOW_UP, CASE_REVIEW, etc.
     */
    @Column(name = "appointment_type", nullable = false)
    private String appointmentType;

    @Column(name = "preferred_datetime", nullable = false)
    private LocalDateTime preferredDatetime;

    @Column(name = "alternative_datetime")
    private LocalDateTime alternativeDatetime;

    @Column(name = "duration_minutes", nullable = false)
    @Builder.Default
    private Integer durationMinutes = 30;

    @Column(name = "is_virtual", nullable = false)
    @Builder.Default
    private Boolean isVirtual = false;

    @Column(name = "meeting_link")
    private String meetingLink;

    @Column(name = "location")
    private String location;

    /**
     * Status: PENDING, CONFIRMED, RESCHEDULED, CANCELLED, COMPLETED
     */
    @Column(name = "status", nullable = false)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "attorney_notes", columnDefinition = "TEXT")
    private String attorneyNotes;

    @Column(name = "confirmed_datetime")
    private LocalDateTime confirmedDatetime;

    /**
     * Who cancelled: CLIENT or ATTORNEY
     */
    @Column(name = "cancelled_by")
    private String cancelledBy;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    // Reschedule request fields (for client-initiated reschedule requests)
    @Column(name = "requested_reschedule_time")
    private LocalDateTime requestedRescheduleTime;

    @Column(name = "reschedule_reason", columnDefinition = "TEXT")
    private String rescheduleReason;

    @Column(name = "original_confirmed_time")
    private LocalDateTime originalConfirmedTime;

    @Column(name = "reminder_sent", nullable = false)
    @Builder.Default
    private Boolean reminderSent = false;

    @Column(name = "reminder_24h_sent", nullable = false)
    @Builder.Default
    private Boolean reminder24hSent = false;

    @Column(name = "reminder_1h_sent", nullable = false)
    @Builder.Default
    private Boolean reminder1hSent = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Helper methods
    public boolean isPending() {
        return "PENDING".equals(status);
    }

    public boolean isConfirmed() {
        return "CONFIRMED".equals(status);
    }

    public boolean isCancelled() {
        return "CANCELLED".equals(status);
    }

    public boolean isCompleted() {
        return "COMPLETED".equals(status);
    }

    public boolean isPendingReschedule() {
        return "PENDING_RESCHEDULE".equals(status);
    }

    public LocalDateTime getScheduledDateTime() {
        return confirmedDatetime != null ? confirmedDatetime : preferredDatetime;
    }
}
