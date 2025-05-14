package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarEventDTO {
    private Long id;
    private String title;
    private String description;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;
    
    private String location;
    private String eventType; // From CalendarEventType enum
    private String status;    // From CalendarEventStatus enum
    private Boolean allDay;
    private String recurrenceRule;
    private String color;
    
    private Long caseId;
    private String caseTitle;
    private String caseNumber;
    
    private Long userId;
    private String userName;
    
    private Integer reminderMinutes;
    private Boolean reminderSent;
    
    // Notification preferences
    private Boolean emailNotification;
    private Boolean pushNotification;
    
    // New field to store additional reminder times
    private List<Integer> additionalReminders;
    
    // New field to track which additional reminders have been sent
    private List<Integer> remindersSent;
    
    // New field for deadline priority
    private Boolean highPriority;
    
    private String externalId;
    private String externalCalendar;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;
} 