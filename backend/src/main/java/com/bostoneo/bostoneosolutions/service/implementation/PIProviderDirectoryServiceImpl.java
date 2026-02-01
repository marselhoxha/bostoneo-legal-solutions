package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIProviderDirectoryDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PIMedicalRecord;
import com.bostoneo.bostoneosolutions.model.PIProviderDirectory;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PIMedicalRecordRepository;
import com.bostoneo.bostoneosolutions.repository.PIProviderDirectoryRepository;
import com.bostoneo.bostoneosolutions.service.PIProviderDirectoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of PI Provider Directory Service.
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PIProviderDirectoryServiceImpl implements PIProviderDirectoryService {

    private final PIProviderDirectoryRepository repository;
    private final PIMedicalRecordRepository medicalRecordRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PIProviderDirectoryDTO> getAllProviders() {
        Long orgId = getRequiredOrganizationId();
        return repository.findByOrganizationIdOrderByProviderNameAsc(orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PIProviderDirectoryDTO getProviderById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PIProviderDirectory provider = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Provider not found with ID: " + id));
        return mapToDTO(provider);
    }

    @Override
    public List<PIProviderDirectoryDTO> searchProviders(String searchTerm) {
        Long orgId = getRequiredOrganizationId();
        return repository.search(orgId, searchTerm)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIProviderDirectoryDTO> getProvidersByType(String providerType) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByOrganizationIdAndProviderTypeOrderByProviderNameAsc(orgId, providerType)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PIProviderDirectoryDTO createProvider(PIProviderDirectoryDTO providerDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating provider: {} in org: {}", providerDTO.getProviderName(), orgId);

        // Check for duplicate
        if (repository.existsByOrganizationIdAndProviderName(orgId, providerDTO.getProviderName())) {
            throw new RuntimeException("Provider with this name already exists");
        }

        PIProviderDirectory provider = mapToEntity(providerDTO);
        provider.setOrganizationId(orgId);

        PIProviderDirectory saved = repository.save(provider);
        log.info("Provider created with ID: {}", saved.getId());
        return mapToDTO(saved);
    }

    @Override
    public PIProviderDirectoryDTO updateProvider(Long id, PIProviderDirectoryDTO providerDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating provider: {} in org: {}", id, orgId);

        PIProviderDirectory existing = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Provider not found with ID: " + id));

        updateEntityFromDTO(existing, providerDTO);
        PIProviderDirectory saved = repository.save(existing);
        return mapToDTO(saved);
    }

    @Override
    public void deleteProvider(Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting provider: {} in org: {}", id, orgId);

        PIProviderDirectory provider = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Provider not found with ID: " + id));

        repository.delete(provider);
        log.info("Provider deleted successfully");
    }

    @Override
    public List<PIProviderDirectoryDTO> getProvidersWithRecordsContact() {
        Long orgId = getRequiredOrganizationId();
        return repository.findWithRecordsContact(orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIProviderDirectoryDTO> getProvidersWithBillingContact() {
        Long orgId = getRequiredOrganizationId();
        return repository.findWithBillingContact(orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public boolean providerExists(String providerName) {
        Long orgId = getRequiredOrganizationId();
        return repository.existsByOrganizationIdAndProviderName(orgId, providerName);
    }

    @Override
    public long getProviderCount() {
        Long orgId = getRequiredOrganizationId();
        return repository.countByOrganizationId(orgId);
    }

    @Override
    public PIProviderDirectoryDTO saveProviderFromMedicalRecord(Long medicalRecordId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Saving provider from medical record: {}", medicalRecordId);

        PIMedicalRecord record = medicalRecordRepository.findByIdAndOrganizationId(medicalRecordId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found"));

        // Check if provider already exists
        if (repository.existsByOrganizationIdAndProviderName(orgId, record.getProviderName())) {
            // Update existing provider
            PIProviderDirectory existing = repository.findByOrganizationIdAndProviderName(orgId, record.getProviderName())
                    .orElseThrow(() -> new ResourceNotFoundException("Provider not found"));

            // Only update if medical record has more info
            if (record.getRecordsEmail() != null && existing.getRecordsEmail() == null) {
                existing.setRecordsEmail(record.getRecordsEmail());
            }
            if (record.getRecordsPhone() != null && existing.getRecordsPhone() == null) {
                existing.setRecordsPhone(record.getRecordsPhone());
            }
            if (record.getRecordsFax() != null && existing.getRecordsFax() == null) {
                existing.setRecordsFax(record.getRecordsFax());
            }
            if (record.getBillingEmail() != null && existing.getBillingEmail() == null) {
                existing.setBillingEmail(record.getBillingEmail());
            }
            if (record.getBillingPhone() != null && existing.getBillingPhone() == null) {
                existing.setBillingPhone(record.getBillingPhone());
            }

            PIProviderDirectory saved = repository.save(existing);
            return mapToDTO(saved);
        }

        // Create new provider
        PIProviderDirectory provider = PIProviderDirectory.builder()
                .organizationId(orgId)
                .providerName(record.getProviderName())
                .providerType(record.getProviderType())
                .npi(record.getProviderNpi())
                .address(record.getProviderAddress())
                .mainPhone(record.getProviderPhone())
                .mainFax(record.getProviderFax())
                .recordsEmail(record.getRecordsEmail())
                .recordsPhone(record.getRecordsPhone())
                .recordsFax(record.getRecordsFax())
                .billingEmail(record.getBillingEmail())
                .billingPhone(record.getBillingPhone())
                .build();

        PIProviderDirectory saved = repository.save(provider);
        log.info("Provider saved from medical record. ID: {}", saved.getId());
        return mapToDTO(saved);
    }

    // ========================
    // Mapping Helpers
    // ========================

    private PIProviderDirectoryDTO mapToDTO(PIProviderDirectory entity) {
        return PIProviderDirectoryDTO.builder()
                .id(entity.getId())
                .organizationId(entity.getOrganizationId())
                .providerName(entity.getProviderName())
                .providerType(entity.getProviderType())
                .npi(entity.getNpi())
                .mainPhone(entity.getMainPhone())
                .mainEmail(entity.getMainEmail())
                .mainFax(entity.getMainFax())
                .address(entity.getAddress())
                .city(entity.getCity())
                .state(entity.getState())
                .zip(entity.getZip())
                .recordsContactName(entity.getRecordsContactName())
                .recordsPhone(entity.getRecordsPhone())
                .recordsEmail(entity.getRecordsEmail())
                .recordsFax(entity.getRecordsFax())
                .billingContactName(entity.getBillingContactName())
                .billingPhone(entity.getBillingPhone())
                .billingEmail(entity.getBillingEmail())
                .billingFax(entity.getBillingFax())
                .baseFee(entity.getBaseFee())
                .perPageFee(entity.getPerPageFee())
                .rushFee(entity.getRushFee())
                .notes(entity.getNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }

    private PIProviderDirectory mapToEntity(PIProviderDirectoryDTO dto) {
        return PIProviderDirectory.builder()
                .providerName(dto.getProviderName())
                .providerType(dto.getProviderType())
                .npi(dto.getNpi())
                .mainPhone(dto.getMainPhone())
                .mainEmail(dto.getMainEmail())
                .mainFax(dto.getMainFax())
                .address(dto.getAddress())
                .city(dto.getCity())
                .state(dto.getState())
                .zip(dto.getZip())
                .recordsContactName(dto.getRecordsContactName())
                .recordsPhone(dto.getRecordsPhone())
                .recordsEmail(dto.getRecordsEmail())
                .recordsFax(dto.getRecordsFax())
                .billingContactName(dto.getBillingContactName())
                .billingPhone(dto.getBillingPhone())
                .billingEmail(dto.getBillingEmail())
                .billingFax(dto.getBillingFax())
                .baseFee(dto.getBaseFee())
                .perPageFee(dto.getPerPageFee())
                .rushFee(dto.getRushFee())
                .notes(dto.getNotes())
                .createdBy(dto.getCreatedBy())
                .build();
    }

    private void updateEntityFromDTO(PIProviderDirectory entity, PIProviderDirectoryDTO dto) {
        if (dto.getProviderName() != null) entity.setProviderName(dto.getProviderName());
        if (dto.getProviderType() != null) entity.setProviderType(dto.getProviderType());
        if (dto.getNpi() != null) entity.setNpi(dto.getNpi());
        if (dto.getMainPhone() != null) entity.setMainPhone(dto.getMainPhone());
        if (dto.getMainEmail() != null) entity.setMainEmail(dto.getMainEmail());
        if (dto.getMainFax() != null) entity.setMainFax(dto.getMainFax());
        if (dto.getAddress() != null) entity.setAddress(dto.getAddress());
        if (dto.getCity() != null) entity.setCity(dto.getCity());
        if (dto.getState() != null) entity.setState(dto.getState());
        if (dto.getZip() != null) entity.setZip(dto.getZip());
        if (dto.getRecordsContactName() != null) entity.setRecordsContactName(dto.getRecordsContactName());
        if (dto.getRecordsPhone() != null) entity.setRecordsPhone(dto.getRecordsPhone());
        if (dto.getRecordsEmail() != null) entity.setRecordsEmail(dto.getRecordsEmail());
        if (dto.getRecordsFax() != null) entity.setRecordsFax(dto.getRecordsFax());
        if (dto.getBillingContactName() != null) entity.setBillingContactName(dto.getBillingContactName());
        if (dto.getBillingPhone() != null) entity.setBillingPhone(dto.getBillingPhone());
        if (dto.getBillingEmail() != null) entity.setBillingEmail(dto.getBillingEmail());
        if (dto.getBillingFax() != null) entity.setBillingFax(dto.getBillingFax());
        if (dto.getBaseFee() != null) entity.setBaseFee(dto.getBaseFee());
        if (dto.getPerPageFee() != null) entity.setPerPageFee(dto.getPerPageFee());
        if (dto.getRushFee() != null) entity.setRushFee(dto.getRushFee());
        if (dto.getNotes() != null) entity.setNotes(dto.getNotes());
    }
}
