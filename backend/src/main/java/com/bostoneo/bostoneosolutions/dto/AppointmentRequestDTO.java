package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentRequestDTO {
    private Long id;
    private Long calendarEventId;
    private Long caseId;
    private String caseNumber;
    private Long clientId;
    private String clientName;
    private Long attorneyId;
    private String attorneyName;
    private String title;
    private String description;
    private String appointmentType;
    private LocalDateTime preferredDatetime;
    private LocalDateTime alternativeDatetime;
    private Integer durationMinutes;
    private Boolean isVirtual;
    private String meetingLink;
    private String location;
    private String status;
    private String notes;
    private String attorneyNotes;
    private LocalDateTime confirmedDatetime;
    private String cancelledBy;
    private String cancellationReason;

    // Reschedule request fields (for client-initiated reschedule requests)
    private LocalDateTime requestedRescheduleTime;
    private String rescheduleReason;
    private LocalDateTime originalConfirmedTime;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
