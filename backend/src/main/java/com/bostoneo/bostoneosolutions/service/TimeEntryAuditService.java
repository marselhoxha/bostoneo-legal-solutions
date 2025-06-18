package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.TimeEntryDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TimeEntryStatus;

public interface TimeEntryAuditService {
    
    /**
     * Record time entry creation
     */
    void recordCreation(TimeEntryDTO timeEntry, Long createdBy);
    
    /**
     * Record time entry update with field changes
     */
    void recordUpdate(Long timeEntryId, TimeEntryDTO oldEntry, TimeEntryDTO newEntry, Long updatedBy);
    
    /**
     * Record status change
     */
    void recordStatusChange(Long timeEntryId, TimeEntryStatus oldStatus, TimeEntryStatus newStatus, 
                           Long changedBy, String reason);
    
    /**
     * Record time entry deletion
     */
    void recordDeletion(Long timeEntryId, TimeEntryDTO deletedEntry, Long deletedBy, String reason);
    
    /**
     * Record rate adjustment
     */
    void recordRateAdjustment(Long timeEntryId, java.math.BigDecimal oldRate, java.math.BigDecimal newRate, 
                             Long adjustedBy, String reason);
    
    /**
     * Record hours adjustment  
     */
    void recordHoursAdjustment(Long timeEntryId, java.math.BigDecimal oldHours, java.math.BigDecimal newHours,
                              Long adjustedBy, String reason);
} 