package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.TimeEntryDTO;
import com.bostoneo.bostoneosolutions.dto.TimeEntryFilterRequest;
import com.bostoneo.bostoneosolutions.enumeration.TimeEntryStatus;
import org.springframework.data.domain.Page;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface TimeTrackingService {
    
    // Create and Update
    TimeEntryDTO createTimeEntry(TimeEntryDTO timeEntryDTO);
    
    TimeEntryDTO updateTimeEntry(Long id, TimeEntryDTO timeEntryDTO);
    
    TimeEntryDTO bulkTimeEntry(TimeEntryDTO timeEntryDTO, Integer days);
    
    // Retrieve
    TimeEntryDTO getTimeEntry(Long id);
    
    Page<TimeEntryDTO> getTimeEntries(int page, int size);
    
    Page<TimeEntryDTO> getTimeEntriesByUser(Long userId, int page, int size);
    
    Page<TimeEntryDTO> getTimeEntriesByMatter(Long legalCaseId, int page, int size);
    
    Page<TimeEntryDTO> getTimeEntriesWithFilters(TimeEntryFilterRequest filterRequest);
    
    List<TimeEntryDTO> getTimeEntriesByDateRange(Long userId, LocalDate startDate, LocalDate endDate);
    
    List<TimeEntryDTO> getTimeEntriesByStatus(Long userId, TimeEntryStatus status);
    
    // Delete
    void deleteTimeEntry(Long id);
    
    void deleteMultipleTimeEntries(List<Long> ids);
    
    // Status Management
    TimeEntryDTO updateTimeEntryStatus(Long id, TimeEntryStatus status);
    
    TimeEntryDTO updateTimeEntryInvoice(Long id, Long invoiceId, TimeEntryStatus status);
    
    List<TimeEntryDTO> bulkUpdateTimeEntriesForInvoice(List<Long> timeEntryIds, Long invoiceId, TimeEntryStatus status);
    
    List<TimeEntryDTO> bulkUpdateStatus(List<Long> ids, TimeEntryStatus status);
    
    TimeEntryDTO submitTimeEntry(Long id);
    
    TimeEntryDTO approveTimeEntry(Long id);
    
    TimeEntryDTO rejectTimeEntry(Long id, String reason);
    
    // Analytics and Reporting
    BigDecimal getTotalHoursByCase(Long legalCaseId);
    
    BigDecimal getTotalAmountByCase(Long legalCaseId);
    
    BigDecimal getTotalHoursByUser(Long userId, LocalDate startDate, LocalDate endDate);
    
    BigDecimal getTotalBillableAmountByUser(Long userId);
    
    List<TimeEntryDTO> getUnbilledApprovedEntries(Long legalCaseId);
    
    // Validation
    boolean canEditTimeEntry(Long timeEntryId, Long userId);
    
    boolean canDeleteTimeEntry(Long timeEntryId, Long userId);
    
    boolean canApproveTimeEntry(Long timeEntryId, Long userId);
    
    // Rate Management
    BigDecimal getEffectiveRateForUser(Long userId, Long legalCaseId, LocalDate date);

    // Comprehensive Case Summary
    Map<String, Object> getCaseTimeSummary(Long legalCaseId);
} 
 
 
 
 
 
 