package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.VendorDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.VendorDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.model.Vendor;
import com.***REMOVED***.***REMOVED***solutions.repository.VendorRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VendorService {
    private final VendorRepository vendorRepository;

    @Transactional(readOnly = true)
    public List<VendorDTO> getAllVendors() {
        return vendorRepository.findAll().stream()
                .map(VendorDTOMapper::fromVendor)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public VendorDTO getVendorById(Long id) {
        return vendorRepository.findById(id)
                .map(VendorDTOMapper::fromVendor)
                .orElseThrow(() -> new EntityNotFoundException("Vendor not found with id: " + id));
    }

    @Transactional
    public VendorDTO createVendor(VendorDTO vendorDTO) {
        Vendor vendor = VendorDTOMapper.toVendor(vendorDTO);
        vendor = vendorRepository.save(vendor);
        return VendorDTOMapper.fromVendor(vendor);
    }

    @Transactional
    public VendorDTO updateVendor(Long id, VendorDTO vendorDTO) {
        if (!vendorRepository.existsById(id)) {
            throw new EntityNotFoundException("Vendor not found with id: " + id);
        }
        Vendor vendor = VendorDTOMapper.toVendor(vendorDTO);
        vendor.setId(id);
        vendor = vendorRepository.save(vendor);
        return VendorDTOMapper.fromVendor(vendor);
    }

    @Transactional
    public void deleteVendor(Long id) {
        if (!vendorRepository.existsById(id)) {
            throw new EntityNotFoundException("Vendor not found with id: " + id);
        }
        vendorRepository.deleteById(id);
    }
} 