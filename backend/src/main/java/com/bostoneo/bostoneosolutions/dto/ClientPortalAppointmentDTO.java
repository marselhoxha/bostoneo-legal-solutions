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
public class ClientPortalAppointmentDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String title;
    private String description;
    private String type; // CONSULTATION, MEETING, COURT_DATE, etc.
    private String status; // SCHEDULED, CONFIRMED, CANCELLED, COMPLETED
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String location;
    private String attorneyName;
    private boolean isVirtual;
    private String meetingLink;
}
