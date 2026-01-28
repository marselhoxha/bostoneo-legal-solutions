package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.VendorDTO;
import com.bostoneo.bostoneosolutions.dtomapper.VendorDTOMapper;
import com.bostoneo.bostoneosolutions.model.Vendor;
import com.bostoneo.bostoneosolutions.repository.VendorRepository;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VendorService {
    private final VendorRepository vendorRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Transactional(readOnly = true)
    public List<VendorDTO> getAllVendors() {
        Long orgId = getRequiredOrganizationId();
        log.debug("Getting all vendors for organization: {}", orgId);
        // SECURITY: Use tenant-filtered query
        return vendorRepository.findByOrganizationId(orgId).stream()
                .map(VendorDTOMapper::fromVendor)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public VendorDTO getVendorById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return vendorRepository.findByIdAndOrganizationId(id, orgId)
                .map(VendorDTOMapper::fromVendor)
                .orElseThrow(() -> new EntityNotFoundException("Vendor not found with id: " + id));
    }

    @Transactional
    public VendorDTO createVendor(VendorDTO vendorDTO) {
        Long orgId = getRequiredOrganizationId();
        Vendor vendor = VendorDTOMapper.toVendor(vendorDTO);
        // SECURITY: Set organization ID when creating
        vendor.setOrganizationId(orgId);
        vendor = vendorRepository.save(vendor);
        return VendorDTOMapper.fromVendor(vendor);
    }

    @Transactional
    public VendorDTO updateVendor(Long id, VendorDTO vendorDTO) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Vendor existingVendor = vendorRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Vendor not found with id: " + id));

        Vendor vendor = VendorDTOMapper.toVendor(vendorDTO);
        vendor.setId(id);
        vendor.setOrganizationId(orgId); // Preserve organization ID
        vendor = vendorRepository.save(vendor);
        return VendorDTOMapper.fromVendor(vendor);
    }

    @Transactional
    public void deleteVendor(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Vendor vendor = vendorRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Vendor not found with id: " + id));
        vendorRepository.delete(vendor);
    }
} 