package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.BillingRateDTO;
import com.bostoneo.bostoneosolutions.enumeration.RateType;
import com.bostoneo.bostoneosolutions.service.BillingRateService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/billing-rates")
@RequiredArgsConstructor
@Slf4j
public class BillingRateController {

    private final BillingRateService billingRateService;

    @GetMapping
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<Page<BillingRateDTO>>> getAllBillingRates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Retrieving all billing rates - page: {}, size: {}", page, size);
        
        try {
            Page<BillingRateDTO> rates = billingRateService.getBillingRates(page, size);
            return ResponseEntity.ok(new CustomHttpResponse<>(200, "Billing rates retrieved successfully", rates));
        } catch (Exception e) {
            log.error("Error retrieving billing rates", e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(400, "Failed to retrieve billing rates: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<BillingRateDTO>> getBillingRateById(@PathVariable Long id) {
        log.info("Retrieving billing rate with ID: {}", id);
        
        try {
            BillingRateDTO rate = billingRateService.getBillingRate(id);
            return ResponseEntity.ok(new CustomHttpResponse<>("Billing rate retrieved successfully", rate));
        } catch (IllegalArgumentException e) {
            log.warn("Billing rate not found with ID: {}", id);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(404, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error retrieving billing rate with ID: {}", id, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve billing rate: " + e.getMessage(), null));
        }
    }

    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<Page<BillingRateDTO>>> getBillingRatesByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Retrieving billing rates for user: {} - page: {}, size: {}", userId, page, size);
        
        try {
            Page<BillingRateDTO> rates = billingRateService.getBillingRatesByUser(userId, page, size);
            return ResponseEntity.ok(new CustomHttpResponse<>("User billing rates retrieved successfully", rates));
        } catch (Exception e) {
            log.error("Error retrieving billing rates for user: {}", userId, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve user billing rates: " + e.getMessage(), null));
        }
    }

    @GetMapping("/user/{userId}/active")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<List<BillingRateDTO>>> getActiveBillingRatesForUser(@PathVariable Long userId) {
        log.info("Retrieving active billing rates for user: {}", userId);
        
        try {
            List<BillingRateDTO> rates = billingRateService.getActiveBillingRatesForUser(userId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Active billing rates retrieved successfully", rates));
        } catch (Exception e) {
            log.error("Error retrieving active billing rates for user: {}", userId, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve active billing rates: " + e.getMessage(), null));
        }
    }

    @GetMapping("/user/{userId}/history")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<List<BillingRateDTO>>> getRateHistoryForUser(@PathVariable Long userId) {
        log.info("Retrieving rate history for user: {}", userId);
        
        try {
            List<BillingRateDTO> rates = billingRateService.getRateHistoryForUser(userId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Rate history retrieved successfully", rates));
        } catch (Exception e) {
            log.error("Error retrieving rate history for user: {}", userId, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve rate history: " + e.getMessage(), null));
        }
    }

    @GetMapping("/effective-rate")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<BigDecimal>> getEffectiveRate(
            @RequestParam Long userId,
            @RequestParam(required = false) Long legalCaseId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long matterTypeId,
            @RequestParam(required = false) String date) {
        log.info("Getting effective rate for user: {}, case: {}, customer: {}, matterType: {}, date: {}", 
                userId, legalCaseId, customerId, matterTypeId, date);
        
        try {
            LocalDate effectiveDate = date != null ? LocalDate.parse(date) : LocalDate.now();
            BigDecimal rate = billingRateService.getEffectiveRate(userId, legalCaseId, customerId, matterTypeId, effectiveDate);
            return ResponseEntity.ok(new CustomHttpResponse<>("Effective rate calculated successfully", rate));
        } catch (Exception e) {
            log.error("Error calculating effective rate", e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to calculate effective rate: " + e.getMessage(), null));
        }
    }

    @GetMapping("/type/{rateType}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<List<BillingRateDTO>>> getRatesByType(@PathVariable RateType rateType) {
        log.info("Retrieving billing rates by type: {}", rateType);
        
        try {
            List<BillingRateDTO> rates = billingRateService.getRatesByType(rateType);
            return ResponseEntity.ok(new CustomHttpResponse<>("Rates by type retrieved successfully", rates));
        } catch (Exception e) {
            log.error("Error retrieving rates by type: {}", rateType, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve rates by type: " + e.getMessage(), null));
        }
    }

    @PostMapping
    @PreAuthorize("hasAuthority('TIME_TRACKING:CREATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "CREATE", entityType = "BILLING_RATE", description = "Created new billing rate")
    public ResponseEntity<CustomHttpResponse<BillingRateDTO>> createBillingRate(@Valid @RequestBody BillingRateDTO billingRateDTO) {
        log.info("Creating billing rate for user: {}", billingRateDTO.getUserId());
        
        try {
            // Validate required fields
            if (billingRateDTO.getUserId() == null) {
                throw new IllegalArgumentException("User ID is required");
            }
            if (billingRateDTO.getRateAmount() == null) {
                throw new IllegalArgumentException("Rate amount is required");
            }
            if (billingRateDTO.getRateType() == null) {
                throw new IllegalArgumentException("Rate type is required");
            }
            if (billingRateDTO.getEffectiveDate() == null) {
                throw new IllegalArgumentException("Effective date is required");
            }
            
            // Set defaults
            if (billingRateDTO.getIsActive() == null) {
                billingRateDTO.setIsActive(true);
            }
            
            BillingRateDTO createdRate = billingRateService.createBillingRate(billingRateDTO);
            return ResponseEntity.ok(new CustomHttpResponse<>("Billing rate created successfully", createdRate));
        } catch (IllegalArgumentException e) {
            log.warn("Invalid billing rate data: {}", e.getMessage());
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(400, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error creating billing rate", e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to create billing rate: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:UPDATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "UPDATE", entityType = "BILLING_RATE", description = "Updated billing rate")
    public ResponseEntity<CustomHttpResponse<BillingRateDTO>> updateBillingRate(
            @PathVariable Long id,
            @Valid @RequestBody BillingRateDTO billingRateDTO) {
        log.info("Updating billing rate with ID: {}", id);
        
        try {
            BillingRateDTO updatedRate = billingRateService.updateBillingRate(id, billingRateDTO);
            return ResponseEntity.ok(new CustomHttpResponse<>("Billing rate updated successfully", updatedRate));
        } catch (IllegalArgumentException e) {
            log.warn("Invalid billing rate update: {}", e.getMessage());
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(400, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error updating billing rate with ID: {}", id, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to update billing rate: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:DELETE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "DELETE", entityType = "BILLING_RATE", description = "Deleted billing rate")
    public ResponseEntity<CustomHttpResponse<Void>> deleteBillingRate(@PathVariable Long id) {
        log.info("Deleting billing rate with ID: {}", id);
        
        try {
            billingRateService.deleteBillingRate(id);
            return ResponseEntity.ok(new CustomHttpResponse<>("Billing rate deleted successfully", null));
        } catch (Exception e) {
            log.error("Error deleting billing rate with ID: {}", id, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to delete billing rate: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('TIME_TRACKING:UPDATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "UPDATE", entityType = "BILLING_RATE", description = "Deactivated billing rate")
    public ResponseEntity<CustomHttpResponse<Void>> deactivateBillingRate(
            @PathVariable Long id,
            @RequestParam(required = false) String endDate) {
        log.info("Deactivating billing rate with ID: {}", id);
        
        try {
            if (endDate != null) {
                LocalDate parsedEndDate = LocalDate.parse(endDate);
                billingRateService.deactivateBillingRate(id, parsedEndDate);
            } else {
                billingRateService.deactivateBillingRate(id);
            }
            return ResponseEntity.ok(new CustomHttpResponse<>("Billing rate deactivated successfully", null));
        } catch (Exception e) {
            log.error("Error deactivating billing rate with ID: {}", id, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to deactivate billing rate: " + e.getMessage(), null));
        }
    }

    @GetMapping("/analytics/average-by-user/{userId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<BigDecimal>> getAverageRateByUser(@PathVariable Long userId) {
        log.info("Getting average rate for user: {}", userId);
        
        try {
            BigDecimal averageRate = billingRateService.getAverageRateByUser(userId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Average rate calculated successfully", averageRate));
        } catch (Exception e) {
            log.error("Error calculating average rate for user: {}", userId, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to calculate average rate: " + e.getMessage(), null));
        }
    }

    @GetMapping("/analytics/average-by-matter-type/{matterTypeId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<BigDecimal>> getAverageRateByMatterType(@PathVariable Long matterTypeId) {
        log.info("Getting average rate for matter type: {}", matterTypeId);
        
        try {
            BigDecimal averageRate = billingRateService.getAverageRateByMatterType(matterTypeId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Average rate calculated successfully", averageRate));
        } catch (Exception e) {
            log.error("Error calculating average rate for matter type: {}", matterTypeId, e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to calculate average rate: " + e.getMessage(), null));
        }
    }

    @PostMapping("/set-user-rate")
    @PreAuthorize("hasAuthority('TIME_TRACKING:CREATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "CREATE", entityType = "BILLING_RATE", description = "Set user billing rate")
    public ResponseEntity<CustomHttpResponse<BillingRateDTO>> setUserRate(
            @RequestParam Long userId,
            @RequestParam BigDecimal rate,
            @RequestParam RateType rateType,
            @RequestParam String effectiveDate) {
        log.info("Setting user rate for user: {}, rate: {}, type: {}", userId, rate, rateType);
        
        try {
            LocalDate parsedDate = LocalDate.parse(effectiveDate);
            BillingRateDTO billingRate = billingRateService.setUserRate(userId, rate, rateType, parsedDate);
            return ResponseEntity.ok(new CustomHttpResponse<>("User rate set successfully", billingRate));
        } catch (Exception e) {
            log.error("Error setting user rate", e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to set user rate: " + e.getMessage(), null));
        }
    }

    @GetMapping("/analytics/usage-by-user/{userId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<Map<String, Object>>> getBillingRateUsageByUser(@PathVariable Long userId) {
        log.info("Getting billing rate usage analytics for user: {}", userId);
        
        try {
            Map<String, Object> usageData = billingRateService.getBillingRateUsageAnalytics(userId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Billing rate usage analytics retrieved successfully", usageData));
        } catch (Exception e) {
            log.error("Error retrieving billing rate usage analytics for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve billing rate usage analytics: " + e.getMessage(), null));
        }
    }

    @GetMapping("/analytics/rate-performance/{rateId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<Map<String, Object>>> getRatePerformanceAnalytics(@PathVariable Long rateId) {
        log.info("Getting performance analytics for billing rate: {}", rateId);
        
        try {
            Map<String, Object> performanceData = billingRateService.getRatePerformanceAnalytics(rateId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Rate performance analytics retrieved successfully", performanceData));
        } catch (Exception e) {
            log.error("Error retrieving rate performance analytics for rate {}: {}", rateId, e.getMessage());
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve rate performance analytics: " + e.getMessage(), null));
        }
    }

    @GetMapping("/analytics/time-entries-by-rate/{userId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:VIEW') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<Map<String, Object>>> getTimeEntriesByBillingRate(@PathVariable Long userId) {
        log.info("Getting time entries grouped by billing rate for user: {}", userId);
        
        try {
            Map<String, Object> timeEntriesData = billingRateService.getTimeEntriesByBillingRate(userId);
            return ResponseEntity.ok(new CustomHttpResponse<>("Time entries by billing rate retrieved successfully", timeEntriesData));
        } catch (Exception e) {
            log.error("Error retrieving time entries by billing rate for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(500, "Failed to retrieve time entries by billing rate: " + e.getMessage(), null));
        }
    }
} 