package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateReminderRequest {
    @Size(max = 255, message = "Title cannot exceed 255 characters")
    private String title;
    
    private String description;
    
    @FutureOrPresent(message = "Due date cannot be in the past")
    private LocalDateTime dueDate;
    
    private LocalDateTime reminderDate;
    
    private String status; // PENDING, COMPLETED, CANCELLED
    
    private String priority; // LOW, MEDIUM, HIGH, URGENT
} 