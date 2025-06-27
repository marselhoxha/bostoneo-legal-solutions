package com.***REMOVED***.***REMOVED***solutions.service.impl;

import com.***REMOVED***.***REMOVED***solutions.dto.TimeEntryDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.TimeEntryFilterRequest;
import com.***REMOVED***.***REMOVED***solutions.enumeration.TimeEntryStatus;
import com.***REMOVED***.***REMOVED***solutions.model.TimeEntry;
import com.***REMOVED***.***REMOVED***solutions.model.ValidationResult;
import com.***REMOVED***.***REMOVED***solutions.repository.TimeEntryRepository;
import com.***REMOVED***.***REMOVED***solutions.service.TimeTrackingService;
import com.***REMOVED***.***REMOVED***solutions.service.TimeEntryValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TimeTrackingServiceImpl implements TimeTrackingService {

    private final TimeEntryRepository timeEntryRepository;
    private final TimeEntryValidationService timeEntryValidationService;

    @Override
    public TimeEntryDTO createTimeEntry(TimeEntryDTO timeEntryDTO) {
        log.info("Creating time entry for user: {} and case: {}", timeEntryDTO.getUserId(), timeEntryDTO.getLegalCaseId());
        
        // Validate business rules before creating
        ValidationResult validationResult = timeEntryValidationService.validateTimeEntry(timeEntryDTO);
        if (!validationResult.isValid()) {
            String errorMessage = "Time entry validation failed: " + String.join(", ", validationResult.getErrors());
            log.error(errorMessage);
            throw new RuntimeException(errorMessage);
        }
        
        // Log warnings if any
        if (validationResult.hasWarnings()) {
            log.warn("Time entry validation warnings: {}", String.join(", ", validationResult.getWarnings()));
        }

        TimeEntry timeEntry = TimeEntry.builder()
                .legalCaseId(timeEntryDTO.getLegalCaseId())
                .userId(timeEntryDTO.getUserId())
                .date(timeEntryDTO.getDate())
                .startTime(timeEntryDTO.getStartTime())
                .endTime(timeEntryDTO.getEndTime())
                .hours(timeEntryDTO.getHours())
                .rate(timeEntryDTO.getRate())
                .description(timeEntryDTO.getDescription())
                .status(timeEntryDTO.getStatus() != null ? timeEntryDTO.getStatus() : TimeEntryStatus.DRAFT)
                .billable(timeEntryDTO.getBillable() != null ? timeEntryDTO.getBillable() : true)
                .build();

        TimeEntry saved = timeEntryRepository.save(timeEntry);
        log.info("Time entry created successfully with ID: {}", saved.getId());
        return mapToDTO(saved);
    }

    @Override
    public TimeEntryDTO updateTimeEntry(Long id, TimeEntryDTO timeEntryDTO) {
        log.info("Updating time entry with id: {}", id);
        
        TimeEntry existingEntry = timeEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Time entry not found with id: " + id));

        // Validate business rules before updating
        ValidationResult validationResult = timeEntryValidationService.validateTimeEntry(timeEntryDTO);
        if (!validationResult.isValid()) {
            String errorMessage = "Time entry validation failed: " + String.join(", ", validationResult.getErrors());
            log.error(errorMessage);
            throw new RuntimeException(errorMessage);
        }

        existingEntry.setLegalCaseId(timeEntryDTO.getLegalCaseId());
        existingEntry.setDate(timeEntryDTO.getDate());
        existingEntry.setStartTime(timeEntryDTO.getStartTime());
        existingEntry.setEndTime(timeEntryDTO.getEndTime());
        existingEntry.setHours(timeEntryDTO.getHours());
        existingEntry.setRate(timeEntryDTO.getRate());
        existingEntry.setDescription(timeEntryDTO.getDescription());
        existingEntry.setBillable(timeEntryDTO.getBillable());
        
        // Update status if provided
        if (timeEntryDTO.getStatus() != null) {
            existingEntry.setStatus(timeEntryDTO.getStatus());
        }
        
        // Update invoice-related fields if provided
        if (timeEntryDTO.getInvoiceId() != null) {
            existingEntry.setInvoiceId(timeEntryDTO.getInvoiceId());
        }
        
        if (timeEntryDTO.getBilledAmount() != null) {
            existingEntry.setBilledAmount(timeEntryDTO.getBilledAmount());
        }
        
        // Update status if provided
        if (timeEntryDTO.getStatus() != null) {
            existingEntry.setStatus(timeEntryDTO.getStatus());
        }
        
        // Update invoice-related fields if provided
        if (timeEntryDTO.getInvoiceId() != null) {
            existingEntry.setInvoiceId(timeEntryDTO.getInvoiceId());
        }
        
        if (timeEntryDTO.getBilledAmount() != null) {
            existingEntry.setBilledAmount(timeEntryDTO.getBilledAmount());
        }

        TimeEntry updated = timeEntryRepository.save(existingEntry);
        log.info("Time entry updated successfully: {}", updated.getId());
        return mapToDTO(updated);
    }

    @Override
    public TimeEntryDTO bulkTimeEntry(TimeEntryDTO timeEntryDTO, Integer days) {
        log.info("Creating bulk time entries for {} days", days);
        
        LocalDate startDate = timeEntryDTO.getDate();
        for (int i = 0; i < days; i++) {
            TimeEntryDTO dailyEntry = TimeEntryDTO.builder()
                    .legalCaseId(timeEntryDTO.getLegalCaseId())
                    .userId(timeEntryDTO.getUserId())
                    .date(startDate.plusDays(i))
                    .startTime(timeEntryDTO.getStartTime())
                    .endTime(timeEntryDTO.getEndTime())
                    .hours(timeEntryDTO.getHours())
                    .rate(timeEntryDTO.getRate())
                    .description(timeEntryDTO.getDescription())
                    .status(TimeEntryStatus.DRAFT)
                    .billable(timeEntryDTO.getBillable())
                    .build();
            createTimeEntry(dailyEntry);
        }
        
        return timeEntryDTO;
    }

    @Override
    @Transactional(readOnly = true)
    public TimeEntryDTO getTimeEntry(Long id) {
        log.info("Retrieving time entry with id: {}", id);
        
        TimeEntry timeEntry = timeEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Time entry not found with id: " + id));
        
        return mapToDTO(timeEntry);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TimeEntryDTO> getTimeEntries(int page, int size) {
        log.info("Retrieving time entries, page: {}, size: {}", page, size);
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date"));
        Page<TimeEntry> timeEntries = timeEntryRepository.findAll(pageable);
        
        return timeEntries.map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TimeEntryDTO> getTimeEntriesByUser(Long userId, int page, int size) {
        log.info("Retrieving time entries for user: {}, page: {}, size: {}", userId, page, size);
        
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date"));
            log.debug("Created pageable: {}", pageable);
            
            Page<TimeEntry> timeEntries = timeEntryRepository.findByUserId(userId, pageable);
            log.info("Found {} time entries for user {}", timeEntries.getTotalElements(), userId);
            
            Page<TimeEntryDTO> result = timeEntries.map(this::mapToDTO);
            log.debug("Mapped to DTOs successfully");
            
            return result;
        } catch (Exception e) {
            log.error("Error retrieving time entries for user {}: {}", userId, e.getMessage(), e);
            
            // Return empty page as fallback to unblock frontend
            log.warn("Returning empty page as fallback for user {}", userId);
            Pageable pageable = PageRequest.of(page, size);
            return Page.empty(pageable);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TimeEntryDTO> getTimeEntriesByMatter(Long legalCaseId, int page, int size) {
        log.info("Retrieving time entries for case: {}", legalCaseId);
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date"));
        Page<TimeEntry> timeEntries = timeEntryRepository.findByLegalCaseId(legalCaseId, pageable);
        
        return timeEntries.map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TimeEntryDTO> getTimeEntriesWithFilters(TimeEntryFilterRequest filterRequest) {
        log.info("Retrieving time entries with filters");
        
        Pageable pageable = PageRequest.of(
                filterRequest.getPage(), 
                filterRequest.getSize(),
                "asc".equalsIgnoreCase(filterRequest.getSortDirection()) ? 
                    Sort.by(Sort.Direction.ASC, filterRequest.getSortBy()) :
                    Sort.by(Sort.Direction.DESC, filterRequest.getSortBy())
        );

        // Convert status list to single status for now (simplified)
        TimeEntryStatus status = null;
        if (filterRequest.getStatuses() != null && !filterRequest.getStatuses().isEmpty()) {
            status = filterRequest.getStatuses().get(0);
        }

        Page<TimeEntry> timeEntries = timeEntryRepository.findWithFilters(
                filterRequest.getUserId(),
                filterRequest.getLegalCaseId(),
                filterRequest.getStartDate(),
                filterRequest.getEndDate(),
                status,
                filterRequest.getBillable(),
                filterRequest.getDescription(),
                pageable
        );
        
        return timeEntries.map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TimeEntryDTO> getTimeEntriesByDateRange(Long userId, LocalDate startDate, LocalDate endDate) {
        log.info("Retrieving time entries for user {} between {} and {}", userId, startDate, endDate);
        
        Pageable pageable = PageRequest.of(0, 1000, Sort.by(Sort.Direction.ASC, "date"));
        Page<TimeEntry> timeEntries = timeEntryRepository.findByUserIdAndDateBetween(userId, startDate, endDate, pageable);
        
        return timeEntries.getContent().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<TimeEntryDTO> getTimeEntriesByStatus(Long userId, TimeEntryStatus status) {
        log.info("Retrieving time entries for user {} with status {}", userId, status);
        
        List<TimeEntry> timeEntries = timeEntryRepository.findByUserIdAndStatus(userId, status);
        
        return timeEntries.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteTimeEntry(Long id) {
        log.info("Deleting time entry with id: {}", id);
        
        if (!timeEntryRepository.existsById(id)) {
            throw new RuntimeException("Time entry not found with id: " + id);
        }
        
        timeEntryRepository.deleteById(id);
    }

    @Override
    public void deleteMultipleTimeEntries(List<Long> ids) {
        log.info("Deleting multiple time entries: {}", ids);
        
        timeEntryRepository.deleteAllById(ids);
    }

    @Override
    public TimeEntryDTO updateTimeEntryStatus(Long id, TimeEntryStatus status) {
        log.info("Updating time entry {} to status {}", id, status);
        
        TimeEntry timeEntry = timeEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Time entry not found with id: " + id));
        
        timeEntry.setStatus(status);
        TimeEntry updated = timeEntryRepository.save(timeEntry);
        
        return mapToDTO(updated);
    }

    @Override
    public TimeEntryDTO updateTimeEntryInvoice(Long id, Long invoiceId, TimeEntryStatus status) {
        log.info("Updating time entry {} with invoice {} and status {}", id, invoiceId, status);
        
        TimeEntry timeEntry = timeEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Time entry not found with id: " + id));
        
        // Validate invoice exists if invoiceId is provided
        if (invoiceId != null) {
            boolean invoiceExists = timeEntryRepository.existsInvoiceById(invoiceId);
            if (!invoiceExists) {
                log.error("Invoice with ID {} does not exist, cannot update time entry {}", invoiceId, id);
                throw new RuntimeException("Invoice with ID " + invoiceId + " does not exist");
            }
        }
        
        // Simple approach: try to update and handle constraint violations gracefully
        try {
            timeEntry.setInvoiceId(invoiceId);
            timeEntry.setStatus(status);
            
            // Set billed amount if invoicing
            if (invoiceId != null && timeEntry.getHours() != null && timeEntry.getRate() != null) {
                timeEntry.setBilledAmount(timeEntry.getHours().multiply(timeEntry.getRate()));
            }
            
            TimeEntry updated = timeEntryRepository.save(timeEntry);
            log.info("Time entry {} updated with invoice {} and status {}", id, invoiceId, status);
            
            return mapToDTO(updated);
            
        } catch (Exception e) {
            // Handle foreign key constraint violations
            if (e.getMessage() != null && e.getMessage().contains("foreign key constraint")) {
                log.error("Foreign key constraint violation when updating time entry {} with invoice {}: {}", 
                         id, invoiceId, e.getMessage());
                
                // Check again if invoice exists (it might have been deleted)
                if (invoiceId != null) {
                    boolean invoiceExists = timeEntryRepository.existsInvoiceById(invoiceId);
                    if (!invoiceExists) {
                        throw new RuntimeException("Invoice with ID " + invoiceId + " was deleted or does not exist");
                    }
                }
                
                // Try a few times with delays in case it's a transaction timing issue
                for (int attempt = 1; attempt <= 3; attempt++) {
                    try {
                        Thread.sleep(300 * attempt); // Increasing delay: 300ms, 600ms, 900ms
                        
                        // Refresh the time entry and try again
                        TimeEntry refreshedEntry = timeEntryRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Time entry not found with id: " + id));
                        
                        // Re-check invoice exists
                        if (invoiceId != null && !timeEntryRepository.existsInvoiceById(invoiceId)) {
                            throw new RuntimeException("Invoice with ID " + invoiceId + " does not exist");
                        }
                        
                        refreshedEntry.setInvoiceId(invoiceId);
                        refreshedEntry.setStatus(status);
                        
                        if (invoiceId != null && refreshedEntry.getHours() != null && refreshedEntry.getRate() != null) {
                            refreshedEntry.setBilledAmount(refreshedEntry.getHours().multiply(refreshedEntry.getRate()));
                        }
                        
                        TimeEntry updated = timeEntryRepository.save(refreshedEntry);
                        log.info("Time entry {} updated with invoice {} and status {} after {} attempts", 
                                id, invoiceId, status, attempt);
                        
                        return mapToDTO(updated);
                        
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Update interrupted", ie);
                    } catch (Exception retryException) {
                        log.warn("Attempt {} failed for time entry {}: {}", attempt, id, retryException.getMessage());
                        if (attempt == 3) {
                            // Last attempt failed, throw the original error
                            throw new RuntimeException("Failed to update time entry after 3 attempts. Invoice ID " + 
                                                     invoiceId + " may not exist or there's a database issue.", e);
                        }
                    }
                }
            }
            
            // Re-throw other exceptions
            throw new RuntimeException("Failed to update time entry: " + e.getMessage(), e);
        }
    }

    @Override
    public List<TimeEntryDTO> bulkUpdateStatus(List<Long> ids, TimeEntryStatus status) {
        log.info("Bulk updating {} time entries to status {}", ids.size(), status);
        
        return ids.stream()
                .map(id -> updateTimeEntryStatus(id, status))
                .collect(Collectors.toList());
    }

    @Override
    public TimeEntryDTO submitTimeEntry(Long id) {
        return updateTimeEntryStatus(id, TimeEntryStatus.SUBMITTED);
    }

    @Override
    public TimeEntryDTO approveTimeEntry(Long id) {
        return updateTimeEntryStatus(id, TimeEntryStatus.BILLING_APPROVED);
    }

    @Override
    public TimeEntryDTO rejectTimeEntry(Long id, String reason) {
        log.info("Rejecting time entry {} with reason: {}", id, reason);
        // For now, just update status. In future, store rejection reason
        return updateTimeEntryStatus(id, TimeEntryStatus.REJECTED);
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getTotalHoursByCase(Long legalCaseId) {
        log.info("Getting total hours for case: {}", legalCaseId);
        
        BigDecimal total = timeEntryRepository.getTotalHoursByCase(legalCaseId);
        return total != null ? total : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getTotalAmountByCase(Long legalCaseId) {
        log.info("Getting total amount for case: {}", legalCaseId);
        
        BigDecimal total = timeEntryRepository.getTotalAmountByCase(legalCaseId);
        return total != null ? total : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getTotalHoursByUser(Long userId, LocalDate startDate, LocalDate endDate) {
        log.info("Getting total hours for user {} between {} and {}", userId, startDate, endDate);
        
        BigDecimal total = timeEntryRepository.getTotalHoursByUserAndDateRange(userId, startDate, endDate);
        return total != null ? total : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getTotalBillableAmountByUser(Long userId) {
        log.info("Getting total billable amount for user: {}", userId);
        
        BigDecimal total = timeEntryRepository.getTotalBillableAmountByUser(userId);
        return total != null ? total : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TimeEntryDTO> getUnbilledApprovedEntries(Long legalCaseId) {
        log.info("Getting unbilled approved entries for case: {}", legalCaseId);
        
        List<TimeEntry> entries = timeEntryRepository.findUnbilledApprovedEntriesByCase(legalCaseId);
        
        return entries.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public boolean canEditTimeEntry(Long timeEntryId, Long userId) {
        // Basic implementation - can edit if it's your entry and not billed
        TimeEntry entry = timeEntryRepository.findById(timeEntryId).orElse(null);
        return entry != null && 
               entry.getUserId().equals(userId) && 
               entry.getStatus() != TimeEntryStatus.INVOICED;
    }

    @Override
    public boolean canDeleteTimeEntry(Long timeEntryId, Long userId) {
        // Basic implementation - can delete if it's your entry and in draft status
        TimeEntry entry = timeEntryRepository.findById(timeEntryId).orElse(null);
        return entry != null && 
               entry.getUserId().equals(userId) && 
               entry.getStatus() == TimeEntryStatus.DRAFT;
    }

    @Override
    public boolean canApproveTimeEntry(Long timeEntryId, Long userId) {
        // Basic implementation - for now, anyone can approve (should be role-based)
        TimeEntry entry = timeEntryRepository.findById(timeEntryId).orElse(null);
        return entry != null && 
               entry.getStatus() == TimeEntryStatus.SUBMITTED;
    }

    @Override
    public BigDecimal getEffectiveRateForUser(Long userId, Long legalCaseId, LocalDate date) {
        // Basic implementation - return default rate
        // In future, integrate with BillingRateService
        return new BigDecimal("250.00");
    }

    @Override
    public List<TimeEntryDTO> bulkUpdateTimeEntriesForInvoice(List<Long> timeEntryIds, Long invoiceId, TimeEntryStatus status) {
        log.info("Bulk updating {} time entries with invoice {} and status {}", timeEntryIds.size(), invoiceId, status);
        
        // Validate invoice exists first if invoiceId is provided
        if (invoiceId != null) {
            boolean invoiceExists = timeEntryRepository.existsInvoiceById(invoiceId);
            if (!invoiceExists) {
                log.error("Invoice with ID {} does not exist, cannot update time entries", invoiceId);
                throw new RuntimeException("Invoice with ID " + invoiceId + " does not exist");
            }
        }
        
        List<TimeEntryDTO> updatedEntries = new ArrayList<>();
        List<String> failedEntries = new ArrayList<>();
        
        for (Long timeEntryId : timeEntryIds) {
            try {
                TimeEntryDTO updated = updateTimeEntryInvoice(timeEntryId, invoiceId, status);
                updatedEntries.add(updated);
            } catch (Exception e) {
                log.error("Failed to update time entry {} with invoice {}: {}", timeEntryId, invoiceId, e.getMessage());
                failedEntries.add("Time entry " + timeEntryId + ": " + e.getMessage());
                // Continue with other entries even if one fails
            }
        }
        
        log.info("Successfully updated {} of {} time entries with invoice {}", 
                updatedEntries.size(), timeEntryIds.size(), invoiceId);
        
        if (!failedEntries.isEmpty()) {
            log.warn("Failed to update {} time entries: {}", failedEntries.size(), String.join("; ", failedEntries));
        }
        
        return updatedEntries;
    }

    // Helper method to map entity to DTO
    private TimeEntryDTO mapToDTO(TimeEntry timeEntry) {
        return TimeEntryDTO.builder()
                .id(timeEntry.getId())
                .legalCaseId(timeEntry.getLegalCaseId())
                .userId(timeEntry.getUserId())
                .date(timeEntry.getDate())
                .startTime(timeEntry.getStartTime())
                .endTime(timeEntry.getEndTime())
                .hours(timeEntry.getHours())
                .rate(timeEntry.getRate())
                .description(timeEntry.getDescription())
                .status(timeEntry.getStatus())
                .billable(timeEntry.getBillable())
                .invoiceId(timeEntry.getInvoiceId())
                .billedAmount(timeEntry.getBilledAmount())
                .totalAmount(timeEntry.getTotalAmount())
                .caseName(timeEntry.getCaseName())
                .caseNumber(timeEntry.getCaseNumber())
                .userName(timeEntry.getUserName())
                .userEmail(timeEntry.getUserEmail())
                .createdAt(timeEntry.getCreatedAt())
                .updatedAt(timeEntry.getUpdatedAt())
                .build();
    }
} 