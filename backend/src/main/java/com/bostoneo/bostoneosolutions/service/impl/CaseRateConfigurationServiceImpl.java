package com.bostoneo.bostoneosolutions.service.impl;

import com.bostoneo.bostoneosolutions.dto.CaseRateConfigurationDTO;
import com.bostoneo.bostoneosolutions.model.CaseRateConfiguration;
import com.bostoneo.bostoneosolutions.repository.CaseRateConfigurationRepository;
import com.bostoneo.bostoneosolutions.service.CaseRateConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CaseRateConfigurationServiceImpl implements CaseRateConfigurationService {

    private final CaseRateConfigurationRepository repository;

    @Override
    public CaseRateConfigurationDTO createCaseRateConfiguration(CaseRateConfigurationDTO dto) {
        log.info("Creating case rate configuration for case: {}", dto.getLegalCaseId());
        
        // Check if configuration already exists for this case
        if (repository.existsByLegalCaseIdAndIsActive(dto.getLegalCaseId(), true)) {
            throw new RuntimeException("Rate configuration already exists for case: " + dto.getLegalCaseId());
        }
        
        CaseRateConfiguration entity = mapToEntity(dto);
        CaseRateConfiguration saved = repository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public CaseRateConfigurationDTO updateCaseRateConfiguration(Long id, CaseRateConfigurationDTO dto) {
        log.info("Updating case rate configuration: {}", id);
        
        CaseRateConfiguration existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rate configuration not found with id: " + id));
        
        // Update fields
        existing.setDefaultRate(dto.getDefaultRate());
        existing.setAllowMultipliers(dto.getAllowMultipliers());
        existing.setWeekendMultiplier(dto.getWeekendMultiplier());
        existing.setAfterHoursMultiplier(dto.getAfterHoursMultiplier());
        existing.setEmergencyMultiplier(dto.getEmergencyMultiplier());
        existing.setIsActive(dto.getIsActive());
        
        CaseRateConfiguration updated = repository.save(existing);
        return mapToDTO(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CaseRateConfigurationDTO> getCaseRateConfiguration(Long id) {
        return repository.findById(id).map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CaseRateConfigurationDTO> getCaseRateConfigurationByCase(Long legalCaseId) {
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true).map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getAllCaseRateConfigurations() {
        return repository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getActiveCaseRateConfigurations() {
        return repository.findByIsActive(true).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getCaseRateConfigurationsByCases(List<Long> legalCaseIds) {
        return repository.findByLegalCaseIdInAndIsActive(legalCaseIds, true).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteCaseRateConfiguration(Long id) {
        log.info("Deleting case rate configuration: {}", id);
        repository.deleteById(id);
    }

    @Override
    public void deactivateCaseRateConfiguration(Long id) {
        log.info("Deactivating case rate configuration: {}", id);
        
        CaseRateConfiguration config = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rate configuration not found with id: " + id));
        
        config.setIsActive(false);
        repository.save(config);
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal calculateEffectiveRate(Long legalCaseId, BigDecimal baseRate, boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        log.debug("Calculating effective rate for case: {}, baseRate: {}, weekend: {}, afterHours: {}, emergency: {}", 
                  legalCaseId, baseRate, isWeekend, isAfterHours, isEmergency);
        
        Optional<CaseRateConfiguration> configOpt = repository.findByLegalCaseIdAndIsActive(legalCaseId, true);
        
        if (configOpt.isPresent()) {
            CaseRateConfiguration config = configOpt.get();
            BigDecimal finalRate = config.calculateFinalRate(baseRate, isWeekend, isAfterHours, isEmergency);
            log.debug("Effective rate calculated: {}", finalRate);
            return finalRate;
        } else {
            // Default behavior if no configuration exists
            BigDecimal rate = baseRate != null ? baseRate : new BigDecimal("250.00");
            
            if (isEmergency) {
                rate = rate.multiply(new BigDecimal("2.0"));
            } else {
                if (isWeekend) {
                    rate = rate.multiply(new BigDecimal("1.5"));
                }
                if (isAfterHours) {
                    rate = rate.multiply(new BigDecimal("1.25"));
                }
            }
            
            log.debug("Default effective rate calculated: {}", rate);
            return rate;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getDefaultRateForCase(Long legalCaseId) {
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getDefaultRate)
                .orElse(new BigDecimal("250.00")); // Default fallback rate
    }

    @Override
    @Transactional(readOnly = true)
    public boolean allowsMultipliers(Long legalCaseId) {
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getAllowMultipliers)
                .orElse(true); // Default to allowing multipliers
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getWeekendMultiplier(Long legalCaseId) {
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getWeekendMultiplier)
                .orElse(new BigDecimal("1.5"));
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getAfterHoursMultiplier(Long legalCaseId) {
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getAfterHoursMultiplier)
                .orElse(new BigDecimal("1.25"));
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getEmergencyMultiplier(Long legalCaseId) {
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getEmergencyMultiplier)
                .orElse(new BigDecimal("2.0"));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsForCase(Long legalCaseId) {
        return repository.existsByLegalCaseIdAndIsActive(legalCaseId, true);
    }

    @Override
    public boolean validateRateConfiguration(CaseRateConfigurationDTO dto) {
        if (dto.getLegalCaseId() == null) {
            return false;
        }
        
        if (dto.getDefaultRate() != null && dto.getDefaultRate().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        
        if (dto.getWeekendMultiplier() != null && dto.getWeekendMultiplier().compareTo(BigDecimal.ONE) < 0) {
            return false;
        }
        
        if (dto.getAfterHoursMultiplier() != null && dto.getAfterHoursMultiplier().compareTo(BigDecimal.ONE) < 0) {
            return false;
        }
        
        if (dto.getEmergencyMultiplier() != null && dto.getEmergencyMultiplier().compareTo(BigDecimal.ONE) < 0) {
            return false;
        }
        
        return true;
    }

    @Override
    public CaseRateConfigurationDTO getOrCreateDefaultConfiguration(Long legalCaseId) {
        log.info("Getting or creating default configuration for case: {}", legalCaseId);
        
        Optional<CaseRateConfiguration> existing = repository.findByLegalCaseIdAndIsActive(legalCaseId, true);
        
        if (existing.isPresent()) {
            return mapToDTO(existing.get());
        } else {
            // Create default configuration
            CaseRateConfiguration defaultConfig = CaseRateConfiguration.builder()
                    .legalCaseId(legalCaseId)
                    .defaultRate(new BigDecimal("250.00"))
                    .allowMultipliers(true)
                    .weekendMultiplier(new BigDecimal("1.5"))
                    .afterHoursMultiplier(new BigDecimal("1.25"))
                    .emergencyMultiplier(new BigDecimal("2.0"))
                    .isActive(true)
                    .build();
            
            CaseRateConfiguration saved = repository.save(defaultConfig);
            log.info("Created default rate configuration for case: {}", legalCaseId);
            return mapToDTO(saved);
        }
    }

    @Override
    public void syncWithCaseDefaults(Long legalCaseId, BigDecimal defaultRate) {
        log.info("Syncing rate configuration with case defaults for case: {}", legalCaseId);
        
        Optional<CaseRateConfiguration> configOpt = repository.findByLegalCaseIdAndIsActive(legalCaseId, true);
        
        if (configOpt.isPresent()) {
            CaseRateConfiguration config = configOpt.get();
            config.setDefaultRate(defaultRate);
            repository.save(config);
        } else {
            // Create new configuration with the provided default rate
            getOrCreateDefaultConfiguration(legalCaseId);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getAverageDefaultRate() {
        BigDecimal average = repository.getAverageDefaultRate();
        return average != null ? average : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public Long getCountWithMultipliersEnabled() {
        return repository.countWithMultipliersEnabled();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getCasesByRateRange(BigDecimal minRate, BigDecimal maxRate) {
        return repository.findByDefaultRateBetweenAndIsActive(minRate, maxRate, true).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    // Helper methods for mapping between entity and DTO
    private CaseRateConfigurationDTO mapToDTO(CaseRateConfiguration entity) {
        return CaseRateConfigurationDTO.builder()
                .id(entity.getId())
                .legalCaseId(entity.getLegalCaseId())
                .defaultRate(entity.getDefaultRate())
                .allowMultipliers(entity.getAllowMultipliers())
                .weekendMultiplier(entity.getWeekendMultiplier())
                .afterHoursMultiplier(entity.getAfterHoursMultiplier())
                .emergencyMultiplier(entity.getEmergencyMultiplier())
                .isActive(entity.getIsActive())
                .caseName(entity.getCaseName())
                .caseNumber(entity.getCaseNumber())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private CaseRateConfiguration mapToEntity(CaseRateConfigurationDTO dto) {
        return CaseRateConfiguration.builder()
                .id(dto.getId())
                .legalCaseId(dto.getLegalCaseId())
                .defaultRate(dto.getDefaultRate())
                .allowMultipliers(dto.getAllowMultipliers())
                .weekendMultiplier(dto.getWeekendMultiplier())
                .afterHoursMultiplier(dto.getAfterHoursMultiplier())
                .emergencyMultiplier(dto.getEmergencyMultiplier())
                .isActive(dto.getIsActive())
                .build();
    }
} 