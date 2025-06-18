package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.BillingRateDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.RateType;
import org.springframework.data.domain.Page;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public interface BillingRateService {
    
    // Create and Update
    BillingRateDTO createBillingRate(BillingRateDTO billingRateDTO);
    
    BillingRateDTO updateBillingRate(Long id, BillingRateDTO billingRateDTO);
    
    // Retrieve
    BillingRateDTO getBillingRate(Long id);
    
    Page<BillingRateDTO> getBillingRates(int page, int size);
    
    Page<BillingRateDTO> getBillingRatesByUser(Long userId, int page, int size);
    
    List<BillingRateDTO> getActiveBillingRatesForUser(Long userId);
    
    List<BillingRateDTO> getBillingRatesByMatterType(Long matterTypeId);
    
    List<BillingRateDTO> getBillingRatesByClient(Long clientId);
    
    List<BillingRateDTO> getBillingRatesByCase(Long legalCaseId);
    
    // Delete and Deactivate
    void deleteBillingRate(Long id);
    
    void deactivateBillingRate(Long id);
    
    void deactivateBillingRate(Long id, LocalDate endDate);
    
    // Rate Setting Methods
    BillingRateDTO setUserRate(Long userId, BigDecimal rate, RateType rateType, LocalDate effectiveDate);
    
    BillingRateDTO setMatterRate(Long userId, Long matterTypeId, BigDecimal rate, RateType rateType, LocalDate effectiveDate);
    
    BillingRateDTO setClientRate(Long userId, Long clientId, BigDecimal rate, RateType rateType, LocalDate effectiveDate);
    
    BillingRateDTO setCaseRate(Long userId, Long legalCaseId, BigDecimal rate, RateType rateType, LocalDate effectiveDate);
    
    // Rate Retrieval Methods
    BigDecimal getEffectiveRate(Long userId, Long legalCaseId, Long clientId, Long matterTypeId, LocalDate date);
    
    BigDecimal getEffectiveRateForCase(Long userId, Long legalCaseId, LocalDate date);
    
    BigDecimal getEffectiveRateForUser(Long userId, LocalDate date);
    
    BillingRateDTO getMostSpecificRate(Long userId, Long legalCaseId, Long clientId, Long matterTypeId, LocalDate date);
    
    // Rate History
    List<BillingRateDTO> getRateHistoryForUser(Long userId);
    
    List<BillingRateDTO> getEffectiveRatesForUser(Long userId, LocalDate date);
    
    List<BillingRateDTO> getCurrentActiveRates();
    
    // Validation
    boolean hasOverlappingRate(BillingRateDTO billingRateDTO);
    
    boolean isValidRateStructure(BillingRateDTO billingRateDTO);
    
    // Rate Analytics
    BigDecimal getAverageRateByUser(Long userId);
    
    BigDecimal getAverageRateByMatterType(Long matterTypeId);
    
    List<BillingRateDTO> getRatesByType(RateType rateType);
    
    /**
     * Calculate effective billing rate based on context
     */
    BigDecimal calculateEffectiveRate(Long userId, Long legalCaseId, LocalDate date, LocalTime timeOfDay);
    
    /**
     * Get user's base rate by role
     */
    BigDecimal getUserBaseRate(Long userId);
    
    /**
     * Get case-specific rate override
     */
    BigDecimal getCaseSpecificRate(Long legalCaseId, Long userId);
    
    /**
     * Get client-specific rate
     */
    BigDecimal getClientSpecificRate(Long clientId, String userRole);
    
    /**
     * Apply time-based multipliers (weekend, after-hours, emergency)
     */
    BigDecimal applyTimeMultipliers(BigDecimal baseRate, LocalDate date, LocalTime timeOfDay, boolean isEmergency);
    
    /**
     * Check if work was performed on weekend
     */
    boolean isWeekendWork(LocalDate date);
    
    /**
     * Check if work was performed after hours (6 PM - 8 AM)
     */
    boolean isAfterHoursWork(LocalTime timeOfDay);
    
    /**
     * Get effective rate for time entry (main method used by TimerService)
     */
    BigDecimal getEffectiveRateForTimeEntry(Long userId, Long legalCaseId, LocalDate date);
    
    // Time Tracking Integration Analytics
    /**
     * Get billing rate usage analytics for a user including time entries count and total billed
     */
    Map<String, Object> getBillingRateUsageAnalytics(Long userId);
    
    /**
     * Get performance analytics for a specific billing rate
     */
    Map<String, Object> getRatePerformanceAnalytics(Long rateId);
    
    /**
     * Get time entries grouped by billing rate for a user
     */
    Map<String, Object> getTimeEntriesByBillingRate(Long userId);
} 
 
 