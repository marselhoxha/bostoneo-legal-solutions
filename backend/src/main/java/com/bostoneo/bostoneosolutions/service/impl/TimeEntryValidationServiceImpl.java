package com.***REMOVED***.***REMOVED***solutions.service.impl;

import com.***REMOVED***.***REMOVED***solutions.dto.TimeEntryDTO;
import com.***REMOVED***.***REMOVED***solutions.model.ValidationResult;
import com.***REMOVED***.***REMOVED***solutions.repository.TimeEntryRepository;
import com.***REMOVED***.***REMOVED***solutions.service.TimeEntryValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class TimeEntryValidationServiceImpl implements TimeEntryValidationService {

    private final TimeEntryRepository timeEntryRepository;
    
    // Business rule constants
    private static final BigDecimal MAX_DAILY_HOURS = new BigDecimal("16.00");
    private static final BigDecimal TIME_INCREMENT = new BigDecimal("0.1"); // 6 minutes
    private static final int MIN_DESCRIPTION_LENGTH = 10;
    
    @Override
    public ValidationResult validateTimeEntry(TimeEntryDTO timeEntry) {
        log.debug("Validating time entry for user: {}, case: {}", timeEntry.getUserId(), timeEntry.getLegalCaseId());
        
        ValidationResult result = ValidationResult.builder().build();
        
        // 1. Check maximum daily hours
        if (exceedsMaxDailyHours(timeEntry)) {
            result.addError("Exceeds maximum daily hours (16.0). Total daily hours would be: " + 
                          calculateTotalDailyHours(timeEntry));
        }
        
        // 2. Validate time increment (6-minute intervals)
        if (!isValidTimeIncrement(timeEntry)) {
            result.addError("Time must be in 6-minute (0.1 hour) increments. Current: " + timeEntry.getHours());
        }
        
        // 3. Check description quality
        if (!hasAdequateDescription(timeEntry)) {
            result.addError("Description must be at least " + MIN_DESCRIPTION_LENGTH + " characters for billing purposes");
        }
        
        // 4. Check for overlapping entries
        if (hasOverlappingEntries(timeEntry)) {
            result.addError("Time entry overlaps with existing entry for the same date and time period");
        }
        
        // 5. Weekend/holiday work validation
        if (requiresSpecialApproval(timeEntry)) {
            result.addWarning("Weekend or holiday work may require pre-approval from management");
        }
        
        // 6. User authorization for case
        if (!canUserWorkOnCase(timeEntry.getUserId(), timeEntry.getLegalCaseId())) {
            result.addError("User is not authorized to work on this case");
        }
        
        // 7. Future date validation
        if (timeEntry.getDate().isAfter(LocalDate.now())) {
            result.addError("Cannot create time entries for future dates");
        }
        
        // 8. Rate validation
        if (timeEntry.getRate() != null && timeEntry.getRate().compareTo(BigDecimal.ZERO) <= 0) {
            result.addError("Billing rate must be greater than zero");
        }
        
        log.debug("Validation completed. Valid: {}, Errors: {}, Warnings: {}", 
                 result.isValid(), result.getErrors().size(), result.getWarnings().size());
        
        return result;
    }
    
    @Override
    public boolean hasOverlappingEntries(TimeEntryDTO timeEntry) {
        if (timeEntry.getStartTime() == null || timeEntry.getEndTime() == null) {
            return false; // No time range specified, can't overlap
        }
        
        // Check for overlapping entries on the same date for the same user
        // This is a simplified check - in reality, you'd query the database
        log.debug("Checking for overlapping entries for user: {} on date: {}", 
                 timeEntry.getUserId(), timeEntry.getDate());
        
        // TODO: Implement actual database query to find overlaps
        // For now, return false as placeholder
        return false;
    }
    
    @Override
    public boolean exceedsMaxDailyHours(TimeEntryDTO timeEntry) {
        BigDecimal totalDailyHours = calculateTotalDailyHours(timeEntry);
        return totalDailyHours.compareTo(MAX_DAILY_HOURS) > 0;
    }
    
    @Override
    public boolean isValidTimeIncrement(TimeEntryDTO timeEntry) {
        if (timeEntry.getHours() == null) return false;
        
        // Check if hours is in 0.1 (6-minute) increments
        BigDecimal remainder = timeEntry.getHours().remainder(TIME_INCREMENT);
        return remainder.compareTo(BigDecimal.ZERO) == 0;
    }
    
    @Override
    public boolean hasAdequateDescription(TimeEntryDTO timeEntry) {
        return timeEntry.getDescription() != null && 
               timeEntry.getDescription().trim().length() >= MIN_DESCRIPTION_LENGTH;
    }
    
    @Override
    public boolean requiresSpecialApproval(TimeEntryDTO timeEntry) {
        if (timeEntry.getDate() == null) return false;
        
        // Weekend work requires approval
        DayOfWeek dayOfWeek = timeEntry.getDate().getDayOfWeek();
        boolean isWeekend = dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
        
        // TODO: Add holiday checking logic
        boolean isHoliday = false; // Placeholder
        
        return isWeekend || isHoliday;
    }
    
    @Override
    public boolean canUserWorkOnCase(Long userId, Long legalCaseId) {
        // Simplified authorization check
        // In reality, check user permissions and case assignments
        log.debug("Checking if user: {} can work on case: {}", userId, legalCaseId);
        
        // TODO: Implement actual authorization logic
        // For now, allow all users to work on all cases
        return true;
    }
    
    private BigDecimal calculateTotalDailyHours(TimeEntryDTO timeEntry) {
        // Get existing hours for the user on this date
        BigDecimal existingHours = timeEntryRepository
            .getTotalHoursByUserAndDateRange(
                timeEntry.getUserId(), 
                timeEntry.getDate(), 
                timeEntry.getDate()
            );
        
        if (existingHours == null) existingHours = BigDecimal.ZERO;
        
        // Add new entry hours (excluding this entry if it's an update)
        BigDecimal newHours = timeEntry.getHours() != null ? timeEntry.getHours() : BigDecimal.ZERO;
        
        return existingHours.add(newHours);
    }
} 