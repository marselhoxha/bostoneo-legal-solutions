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
public class ClientPortalCaseDTO {
    private Long id;
    private String caseNumber;
    private String title;
    private String type;
    private String status;
    private String description;
    private String attorneyName;
    private LocalDateTime openDate;
    private LocalDateTime lastUpdated;
    private int documentCount;
    private int upcomingAppointments;
}
