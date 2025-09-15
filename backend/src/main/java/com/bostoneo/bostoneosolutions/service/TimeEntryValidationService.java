package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.TimeEntryDTO;
import com.bostoneo.bostoneosolutions.model.ValidationResult;

public interface TimeEntryValidationService {
    
    /**
     * Validate time entry against all business rules
     */
    ValidationResult validateTimeEntry(TimeEntryDTO timeEntry);
    
    /**
     * Check for overlapping time entries
     */
    boolean hasOverlappingEntries(TimeEntryDTO timeEntry);
    
    /**
     * Validate maximum daily hours
     */
    boolean exceedsMaxDailyHours(TimeEntryDTO timeEntry);
    
    /**
     * Validate time increment (must be in 6-minute intervals)
     */
    boolean isValidTimeIncrement(TimeEntryDTO timeEntry);
    
    /**
     * Check if description meets minimum quality standards
     */
    boolean hasAdequateDescription(TimeEntryDTO timeEntry);
    
    /**
     * Check if weekend/holiday work requires pre-approval
     */
    boolean requiresSpecialApproval(TimeEntryDTO timeEntry);
    
    /**
     * Validate if user can work on this case
     */
    boolean canUserWorkOnCase(Long userId, Long legalCaseId);
} 