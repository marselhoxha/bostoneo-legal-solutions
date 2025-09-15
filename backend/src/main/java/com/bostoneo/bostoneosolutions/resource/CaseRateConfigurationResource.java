package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.CaseRateConfigurationDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CaseRateConfigurationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/case-rate-configurations")
@RequiredArgsConstructor
@Slf4j
public class CaseRateConfigurationResource {

    private final CaseRateConfigurationService caseRateConfigurationService;

    // Create new case rate configuration
    @PostMapping
    @PreAuthorize("hasAuthority('ADMIN:CREATE') or hasAuthority('MANAGER:CREATE')")
    public ResponseEntity<HttpResponse> createCaseRateConfiguration(@Valid @RequestBody CaseRateConfigurationDTO dto) {
        try {
            log.info("Creating case rate configuration for case: {}", dto.getLegalCaseId());
            CaseRateConfigurationDTO created = caseRateConfigurationService.createCaseRateConfiguration(dto);
            
            return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("configuration", created))
                    .message("Case rate configuration created successfully")
                    .status(CREATED)
                    .statusCode(CREATED.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error creating case rate configuration: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to create case rate configuration: " + e.getMessage())
                    .build()
            );
        }
    }

    // Update existing case rate configuration
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN:EDIT') or hasAuthority('MANAGER:EDIT')")
    public ResponseEntity<HttpResponse> updateCaseRateConfiguration(@PathVariable Long id, @Valid @RequestBody CaseRateConfigurationDTO dto) {
        try {
            log.info("Updating case rate configuration: {}", id);
            CaseRateConfigurationDTO updated = caseRateConfigurationService.updateCaseRateConfiguration(id, dto);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("configuration", updated))
                    .message("Case rate configuration updated successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error updating case rate configuration: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to update case rate configuration: " + e.getMessage())
                    .build()
            );
        }
    }

    // Get case rate configuration by ID
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getCaseRateConfiguration(@PathVariable Long id) {
        Optional<CaseRateConfigurationDTO> config = caseRateConfigurationService.getCaseRateConfiguration(id);
        
        if (config.isPresent()) {
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("configuration", config.get()))
                    .message("Case rate configuration retrieved")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } else {
            return ResponseEntity.status(NOT_FOUND).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(NOT_FOUND.value())
                    .status(NOT_FOUND)
                    .message("Case rate configuration not found")
                    .build()
            );
        }
    }

    // Get case rate configuration by legal case ID
    @GetMapping("/case/{legalCaseId}")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getCaseRateConfigurationByCase(@PathVariable Long legalCaseId) {
        Optional<CaseRateConfigurationDTO> config = caseRateConfigurationService.getCaseRateConfigurationByCase(legalCaseId);
        
        if (config.isPresent()) {
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("configuration", config.get()))
                    .message("Case rate configuration retrieved")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } else {
            // Return default configuration for the case
            CaseRateConfigurationDTO defaultConfig = caseRateConfigurationService.getOrCreateDefaultConfiguration(legalCaseId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("configuration", defaultConfig))
                    .message("Default case rate configuration created and retrieved")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        }
    }

    // Get all active case rate configurations
    @GetMapping
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getActiveCaseRateConfigurations() {
        List<CaseRateConfigurationDTO> configurations = caseRateConfigurationService.getActiveCaseRateConfigurations();
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("configurations", configurations))
                .message("Active case rate configurations retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Get case rate configurations for multiple cases
    @PostMapping("/batch")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getCaseRateConfigurationsByCases(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> legalCaseIds = (List<Long>) request.get("legalCaseIds");
            
            List<CaseRateConfigurationDTO> configurations = caseRateConfigurationService.getCaseRateConfigurationsByCases(legalCaseIds);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("configurations", configurations))
                    .message("Case rate configurations retrieved")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error retrieving batch case rate configurations: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to retrieve case rate configurations: " + e.getMessage())
                    .build()
            );
        }
    }

    // Calculate effective rate for a case
    @PostMapping("/case/{legalCaseId}/calculate-rate")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> calculateEffectiveRate(@PathVariable Long legalCaseId, @RequestBody Map<String, Object> request) {
        try {
            BigDecimal baseRate = new BigDecimal(request.get("baseRate").toString());
            Boolean isWeekend = (Boolean) request.get("isWeekend");
            Boolean isAfterHours = (Boolean) request.get("isAfterHours");
            Boolean isEmergency = (Boolean) request.get("isEmergency");
            
            BigDecimal effectiveRate = caseRateConfigurationService.calculateEffectiveRate(
                legalCaseId, baseRate, isWeekend, isAfterHours, isEmergency);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of(
                        "baseRate", baseRate,
                        "effectiveRate", effectiveRate,
                        "isWeekend", isWeekend,
                        "isAfterHours", isAfterHours,
                        "isEmergency", isEmergency
                    ))
                    .message("Effective rate calculated")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error calculating effective rate: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to calculate effective rate: " + e.getMessage())
                    .build()
            );
        }
    }

    // Get default rate for a case
    @GetMapping("/case/{legalCaseId}/default-rate")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getDefaultRateForCase(@PathVariable Long legalCaseId) {
        BigDecimal defaultRate = caseRateConfigurationService.getDefaultRateForCase(legalCaseId);
        boolean allowsMultipliers = caseRateConfigurationService.allowsMultipliers(legalCaseId);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "defaultRate", defaultRate,
                    "allowsMultipliers", allowsMultipliers,
                    "weekendMultiplier", caseRateConfigurationService.getWeekendMultiplier(legalCaseId),
                    "afterHoursMultiplier", caseRateConfigurationService.getAfterHoursMultiplier(legalCaseId),
                    "emergencyMultiplier", caseRateConfigurationService.getEmergencyMultiplier(legalCaseId)
                ))
                .message("Default rate information retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Deactivate case rate configuration
    @PostMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('ADMIN:EDIT') or hasAuthority('MANAGER:EDIT')")
    public ResponseEntity<HttpResponse> deactivateCaseRateConfiguration(@PathVariable Long id) {
        try {
            caseRateConfigurationService.deactivateCaseRateConfiguration(id);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Case rate configuration deactivated successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error deactivating case rate configuration: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to deactivate case rate configuration: " + e.getMessage())
                    .build()
            );
        }
    }

    // Delete case rate configuration
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN:DELETE')")
    public ResponseEntity<HttpResponse> deleteCaseRateConfiguration(@PathVariable Long id) {
        try {
            caseRateConfigurationService.deleteCaseRateConfiguration(id);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Case rate configuration deleted successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error deleting case rate configuration: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to delete case rate configuration: " + e.getMessage())
                    .build()
            );
        }
    }

    // Analytics endpoints
    @GetMapping("/analytics/average-rate")
    @PreAuthorize("hasAuthority('ADMIN:VIEW') or hasAuthority('MANAGER:VIEW')")
    public ResponseEntity<HttpResponse> getAverageDefaultRate() {
        BigDecimal averageRate = caseRateConfigurationService.getAverageDefaultRate();
        Long countWithMultipliers = caseRateConfigurationService.getCountWithMultipliersEnabled();
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of(
                    "averageDefaultRate", averageRate,
                    "countWithMultipliersEnabled", countWithMultipliers
                ))
                .message("Rate analytics retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    @GetMapping("/analytics/rate-range")
    @PreAuthorize("hasAuthority('ADMIN:VIEW') or hasAuthority('MANAGER:VIEW')")
    public ResponseEntity<HttpResponse> getCasesByRateRange(@RequestParam BigDecimal minRate, @RequestParam BigDecimal maxRate) {
        List<CaseRateConfigurationDTO> configurations = caseRateConfigurationService.getCasesByRateRange(minRate, maxRate);
        
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("configurations", configurations))
                .message("Cases in rate range retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
} 