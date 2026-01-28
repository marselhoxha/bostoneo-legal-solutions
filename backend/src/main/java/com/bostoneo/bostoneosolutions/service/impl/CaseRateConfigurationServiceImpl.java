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
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;
    private final com.bostoneo.bostoneosolutions.repository.LegalCaseRepository legalCaseRepository;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    private void verifyCaseBelongsToOrganization(Long legalCaseId) {
        Long orgId = getRequiredOrganizationId();
        if (!legalCaseRepository.existsByIdAndOrganizationId(legalCaseId, orgId)) {
            throw new RuntimeException("Case not found or access denied: " + legalCaseId);
        }
    }

    @Override
    public CaseRateConfigurationDTO createCaseRateConfiguration(CaseRateConfigurationDTO dto) {
        log.info("Creating case rate configuration for case: {}", dto.getLegalCaseId());

        // SECURITY: Verify case belongs to current organization
        verifyCaseBelongsToOrganization(dto.getLegalCaseId());

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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        CaseRateConfiguration existing = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Rate configuration not found or access denied: " + id));
        
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByIdAndOrganizationId(id, orgId).map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CaseRateConfigurationDTO> getCaseRateConfigurationByCase(Long legalCaseId) {
        verifyCaseBelongsToOrganization(legalCaseId);
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true).map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getAllCaseRateConfigurations() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByOrganizationId(orgId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getActiveCaseRateConfigurations() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByOrganizationIdAndIsActive(orgId, true).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getCaseRateConfigurationsByCases(List<Long> legalCaseIds) {
        // SECURITY: Verify all cases belong to current organization
        for (Long caseId : legalCaseIds) {
            verifyCaseBelongsToOrganization(caseId);
        }
        return repository.findByLegalCaseIdInAndIsActive(legalCaseIds, true).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteCaseRateConfiguration(Long id) {
        log.info("Deleting case rate configuration: {}", id);
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before deletion
        if (!repository.existsByIdAndOrganizationId(id, orgId)) {
            throw new RuntimeException("Rate configuration not found or access denied: " + id);
        }
        repository.deleteById(id);
    }

    @Override
    public void deactivateCaseRateConfiguration(Long id) {
        log.info("Deactivating case rate configuration: {}", id);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        CaseRateConfiguration config = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Rate configuration not found or access denied: " + id));

        config.setIsActive(false);
        repository.save(config);
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal calculateEffectiveRate(Long legalCaseId, BigDecimal baseRate, boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        log.debug("Calculating effective rate for case: {}, baseRate: {}, weekend: {}, afterHours: {}, emergency: {}",
                  legalCaseId, baseRate, isWeekend, isAfterHours, isEmergency);

        // SECURITY: Verify case belongs to current organization
        verifyCaseBelongsToOrganization(legalCaseId);

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
        verifyCaseBelongsToOrganization(legalCaseId);
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getDefaultRate)
                .orElse(new BigDecimal("250.00")); // Default fallback rate
    }

    @Override
    @Transactional(readOnly = true)
    public boolean allowsMultipliers(Long legalCaseId) {
        verifyCaseBelongsToOrganization(legalCaseId);
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getAllowMultipliers)
                .orElse(true); // Default to allowing multipliers
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getWeekendMultiplier(Long legalCaseId) {
        verifyCaseBelongsToOrganization(legalCaseId);
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getWeekendMultiplier)
                .orElse(new BigDecimal("1.5"));
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getAfterHoursMultiplier(Long legalCaseId) {
        verifyCaseBelongsToOrganization(legalCaseId);
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getAfterHoursMultiplier)
                .orElse(new BigDecimal("1.25"));
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getEmergencyMultiplier(Long legalCaseId) {
        verifyCaseBelongsToOrganization(legalCaseId);
        return repository.findByLegalCaseIdAndIsActive(legalCaseId, true)
                .map(CaseRateConfiguration::getEmergencyMultiplier)
                .orElse(new BigDecimal("2.0"));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsForCase(Long legalCaseId) {
        verifyCaseBelongsToOrganization(legalCaseId);
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

        // SECURITY: Verify case belongs to current organization
        verifyCaseBelongsToOrganization(legalCaseId);

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

        // SECURITY: Verify case belongs to current organization
        verifyCaseBelongsToOrganization(legalCaseId);

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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        BigDecimal average = repository.getAverageDefaultRateByOrganization(orgId);
        return average != null ? average : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public Long getCountWithMultipliersEnabled() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.countWithMultipliersEnabledByOrganization(orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CaseRateConfigurationDTO> getCasesByRateRange(BigDecimal minRate, BigDecimal maxRate) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByOrganizationIdAndDefaultRateBetweenAndIsActive(orgId, minRate, maxRate).stream()
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