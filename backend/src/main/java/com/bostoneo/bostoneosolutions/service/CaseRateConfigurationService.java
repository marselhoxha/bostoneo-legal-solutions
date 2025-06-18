package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.CaseRateConfigurationDTO;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface CaseRateConfigurationService {
    
    // Create and Update
    CaseRateConfigurationDTO createCaseRateConfiguration(CaseRateConfigurationDTO dto);
    CaseRateConfigurationDTO updateCaseRateConfiguration(Long id, CaseRateConfigurationDTO dto);
    
    // Retrieve
    Optional<CaseRateConfigurationDTO> getCaseRateConfiguration(Long id);
    Optional<CaseRateConfigurationDTO> getCaseRateConfigurationByCase(Long legalCaseId);
    List<CaseRateConfigurationDTO> getAllCaseRateConfigurations();
    List<CaseRateConfigurationDTO> getActiveCaseRateConfigurations();
    
    // Batch operations
    List<CaseRateConfigurationDTO> getCaseRateConfigurationsByCases(List<Long> legalCaseIds);
    
    // Delete and Deactivate
    void deleteCaseRateConfiguration(Long id);
    void deactivateCaseRateConfiguration(Long id);
    
    // Rate calculation methods
    BigDecimal calculateEffectiveRate(Long legalCaseId, BigDecimal baseRate, boolean isWeekend, boolean isAfterHours, boolean isEmergency);
    BigDecimal getDefaultRateForCase(Long legalCaseId);
    boolean allowsMultipliers(Long legalCaseId);
    
    // Multiplier methods
    BigDecimal getWeekendMultiplier(Long legalCaseId);
    BigDecimal getAfterHoursMultiplier(Long legalCaseId);
    BigDecimal getEmergencyMultiplier(Long legalCaseId);
    
    // Validation
    boolean existsForCase(Long legalCaseId);
    boolean validateRateConfiguration(CaseRateConfigurationDTO dto);
    
    // Utility methods
    CaseRateConfigurationDTO getOrCreateDefaultConfiguration(Long legalCaseId);
    void syncWithCaseDefaults(Long legalCaseId, BigDecimal defaultRate);
    
    // Statistics
    BigDecimal getAverageDefaultRate();
    Long getCountWithMultipliersEnabled();
    List<CaseRateConfigurationDTO> getCasesByRateRange(BigDecimal minRate, BigDecimal maxRate);
} 