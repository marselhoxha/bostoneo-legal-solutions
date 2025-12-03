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
public class ClientPortalAppointmentRequestDTO {
    private Long caseId;
    private String title;
    private String description;
    private String type;
    private LocalDateTime preferredDateTime;
    private LocalDateTime alternativeDateTime;
    private boolean preferVirtual;
    private String notes;
}
