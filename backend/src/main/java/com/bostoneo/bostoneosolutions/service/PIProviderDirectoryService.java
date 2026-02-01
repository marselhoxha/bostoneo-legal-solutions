package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PIProviderDirectoryDTO;

import java.util.List;

/**
 * Service interface for PI Provider Directory operations.
 * Manages reusable medical provider contact information.
 */
public interface PIProviderDirectoryService {

    /**
     * Get all providers for the current organization.
     */
    List<PIProviderDirectoryDTO> getAllProviders();

    /**
     * Get a provider by ID.
     */
    PIProviderDirectoryDTO getProviderById(Long id);

    /**
     * Search providers by name.
     */
    List<PIProviderDirectoryDTO> searchProviders(String searchTerm);

    /**
     * Get providers by type (e.g., HOSPITAL, CLINIC).
     */
    List<PIProviderDirectoryDTO> getProvidersByType(String providerType);

    /**
     * Create a new provider.
     */
    PIProviderDirectoryDTO createProvider(PIProviderDirectoryDTO providerDTO);

    /**
     * Update an existing provider.
     */
    PIProviderDirectoryDTO updateProvider(Long id, PIProviderDirectoryDTO providerDTO);

    /**
     * Delete a provider.
     */
    void deleteProvider(Long id);

    /**
     * Get providers with records department contact info.
     */
    List<PIProviderDirectoryDTO> getProvidersWithRecordsContact();

    /**
     * Get providers with billing department contact info.
     */
    List<PIProviderDirectoryDTO> getProvidersWithBillingContact();

    /**
     * Check if a provider name already exists.
     */
    boolean providerExists(String providerName);

    /**
     * Count total providers for the organization.
     */
    long getProviderCount();

    /**
     * Find or create provider from medical record data.
     * Saves provider info to directory for future use.
     */
    PIProviderDirectoryDTO saveProviderFromMedicalRecord(Long medicalRecordId);
}
