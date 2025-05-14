package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCalendarEventRequest {
    @NotBlank(message = "Title is required")
    private String title;
    
    private String description;
    
    @NotNull(message = "Start time is required")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;
    
    private String location;
    
    @NotBlank(message = "Event type is required")
    private String eventType;
    
    private String status;
    
    private Boolean allDay;
    
    private String recurrenceRule;
    
    private String color;
    
    private Long caseId;
    
    private Integer reminderMinutes;
    
    // Notification preferences
    private Boolean emailNotification;
    private Boolean pushNotification;
    
    // Flag for high priority deadlines
    private Boolean highPriority;
    
    // Additional reminder times (minutes before deadline)
    private List<Integer> additionalReminders;
    
    private String externalCalendar;
} 