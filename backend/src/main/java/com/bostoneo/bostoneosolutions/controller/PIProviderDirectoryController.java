package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PIProviderDirectoryDTO;
import com.bostoneo.bostoneosolutions.service.PIProviderDirectoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for PI Provider Directory operations.
 * CRUD operations for managing medical provider contact information.
 */
@RestController
@RequestMapping("/api/pi/provider-directory")
@RequiredArgsConstructor
@Slf4j
public class PIProviderDirectoryController {

    private final PIProviderDirectoryService providerService;

    /**
     * Get all providers for the organization.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllProviders(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type) {
        log.info("Getting providers. Search: {}, Type: {}", search, type);

        List<PIProviderDirectoryDTO> providers;
        if (search != null && !search.isEmpty()) {
            providers = providerService.searchProviders(search);
        } else if (type != null && !type.isEmpty()) {
            providers = providerService.getProvidersByType(type);
        } else {
            providers = providerService.getAllProviders();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "providers", providers,
                "count", providers.size()
        ));
    }

    /**
     * Get a specific provider by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getProviderById(@PathVariable Long id) {
        log.info("Getting provider by ID: {}", id);

        PIProviderDirectoryDTO provider = providerService.getProviderById(id);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "provider", provider
        ));
    }

    /**
     * Create a new provider.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createProvider(
            @Valid @RequestBody PIProviderDirectoryDTO providerDTO) {
        log.info("Creating provider: {}", providerDTO.getProviderName());

        PIProviderDirectoryDTO created = providerService.createProvider(providerDTO);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Provider created successfully",
                "provider", created
        ));
    }

    /**
     * Update an existing provider.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateProvider(
            @PathVariable Long id,
            @Valid @RequestBody PIProviderDirectoryDTO providerDTO) {
        log.info("Updating provider: {}", id);

        PIProviderDirectoryDTO updated = providerService.updateProvider(id, providerDTO);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Provider updated successfully",
                "provider", updated
        ));
    }

    /**
     * Delete a provider.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteProvider(@PathVariable Long id) {
        log.info("Deleting provider: {}", id);

        providerService.deleteProvider(id);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Provider deleted successfully"
        ));
    }

    /**
     * Get providers with records department contact info.
     */
    @GetMapping("/with-records-contact")
    public ResponseEntity<Map<String, Object>> getProvidersWithRecordsContact() {
        log.info("Getting providers with records contact");

        List<PIProviderDirectoryDTO> providers = providerService.getProvidersWithRecordsContact();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "providers", providers,
                "count", providers.size()
        ));
    }

    /**
     * Get providers with billing department contact info.
     */
    @GetMapping("/with-billing-contact")
    public ResponseEntity<Map<String, Object>> getProvidersWithBillingContact() {
        log.info("Getting providers with billing contact");

        List<PIProviderDirectoryDTO> providers = providerService.getProvidersWithBillingContact();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "providers", providers,
                "count", providers.size()
        ));
    }

    /**
     * Save provider from medical record data.
     */
    @PostMapping("/from-medical-record/{medicalRecordId}")
    public ResponseEntity<Map<String, Object>> saveProviderFromMedicalRecord(
            @PathVariable Long medicalRecordId) {
        log.info("Saving provider from medical record: {}", medicalRecordId);

        PIProviderDirectoryDTO provider = providerService.saveProviderFromMedicalRecord(medicalRecordId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Provider saved to directory",
                "provider", provider
        ));
    }

    /**
     * Get provider statistics.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getProviderStats() {
        log.info("Getting provider stats");

        long totalCount = providerService.getProviderCount();
        List<PIProviderDirectoryDTO> withRecords = providerService.getProvidersWithRecordsContact();
        List<PIProviderDirectoryDTO> withBilling = providerService.getProvidersWithBillingContact();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "stats", Map.of(
                        "totalProviders", totalCount,
                        "withRecordsContact", withRecords.size(),
                        "withBillingContact", withBilling.size()
                )
        ));
    }
}
