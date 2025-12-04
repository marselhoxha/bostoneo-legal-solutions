package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttorneyAvailabilityDTO {
    private Long id;
    private Long attorneyId;
    private Integer dayOfWeek; // 0=Sunday, 1=Monday, ..., 6=Saturday
    private String dayName;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer slotDurationMinutes;
    private Integer bufferMinutes;
    private Boolean isActive;
}
