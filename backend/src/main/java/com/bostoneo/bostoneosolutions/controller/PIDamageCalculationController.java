package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PIDamageCalculationDTO;
import com.bostoneo.bostoneosolutions.dto.PIDamageElementDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PIDamageCalculationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

/**
 * REST Controller for PI Damage Calculation
 */
@RestController
@RequestMapping("/api/pi/cases/{caseId}/damages")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class PIDamageCalculationController {

    private final PIDamageCalculationService damageService;

    // ===== Damage Elements =====

    /**
     * Get all damage elements for a case
     */
    @GetMapping("/elements")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getDamageElements(@PathVariable("caseId") Long caseId) {

        log.info("Getting damage elements for case: {}", caseId);

        List<PIDamageElementDTO> elements = damageService.getDamageElementsByCaseId(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("elements", elements))
                        .message("Damage elements retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get a specific damage element
     */
    @GetMapping("/elements/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getDamageElementById(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Getting damage element {} for case: {}", id, caseId);

        PIDamageElementDTO element = damageService.getDamageElementById(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", element))
                        .message("Damage element retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Create a new damage element
     */
    @PostMapping("/elements")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createDamageElement(
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody PIDamageElementDTO elementDTO) {

        log.info("Creating damage element for case: {}", caseId);

        PIDamageElementDTO created = damageService.createDamageElement(caseId, elementDTO);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", created))
                        .message("Damage element created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Update a damage element
     */
    @PutMapping("/elements/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> updateDamageElement(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id,
            @Valid @RequestBody PIDamageElementDTO elementDTO) {

        log.info("Updating damage element {} for case: {}", id, caseId);

        PIDamageElementDTO updated = damageService.updateDamageElement(id, elementDTO);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", updated))
                        .message("Damage element updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Delete a damage element
     */
    @DeleteMapping("/elements/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteDamageElement(
            @PathVariable("caseId") Long caseId,
            @PathVariable("id") Long id) {

        log.info("Deleting damage element {} for case: {}", id, caseId);

        damageService.deleteDamageElement(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Damage element deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get elements by type
     */
    @GetMapping("/elements/by-type/{type}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getElementsByType(
            @PathVariable("caseId") Long caseId,
            @PathVariable("type") String type) {

        log.info("Getting damage elements of type {} for case: {}", type, caseId);

        List<PIDamageElementDTO> elements = damageService.getDamageElementsByType(caseId, type);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("elements", elements))
                        .message("Damage elements retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Reorder damage elements
     */
    @PutMapping("/elements/reorder")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> reorderElements(
            @PathVariable("caseId") Long caseId,
            @RequestBody List<Long> elementIds) {

        log.info("Reordering {} damage elements for case: {}", elementIds.size(), caseId);

        damageService.reorderDamageElements(caseId, elementIds);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Elements reordered successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // ===== Damage Calculation Summary =====

    /**
     * Get damage calculation summary
     */
    @GetMapping("/calculation")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getDamageCalculation(@PathVariable("caseId") Long caseId) {

        log.info("Getting damage calculation for case: {}", caseId);

        PIDamageCalculationDTO calculation = damageService.getDamageCalculation(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("calculation", calculation))
                        .message("Damage calculation retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Calculate damages
     */
    @PostMapping("/calculate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> calculateDamages(@PathVariable("caseId") Long caseId) {

        log.info("Calculating damages for case: {}", caseId);

        PIDamageCalculationDTO calculation = damageService.calculateDamages(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("calculation", calculation))
                        .message("Damages calculated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Calculate damages with AI comparable analysis
     */
    @PostMapping("/calculate-with-ai")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> calculateDamagesWithAI(
            @PathVariable("caseId") Long caseId,
            @RequestBody(required = false) Map<String, Object> caseContext) {

        log.info("Calculating damages with AI analysis for case: {}", caseId);

        PIDamageCalculationDTO calculation = damageService.calculateDamagesWithAI(caseId, caseContext);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("calculation", calculation))
                        .message("Damages calculated with AI analysis")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get summary by damage type
     */
    @GetMapping("/summary-by-type")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getSummaryByType(@PathVariable("caseId") Long caseId) {

        log.info("Getting damage summary by type for case: {}", caseId);

        Map<String, BigDecimal> summary = damageService.getSummaryByDamageType(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("summary", summary))
                        .message("Summary retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get economic vs non-economic breakdown
     */
    @GetMapping("/economic-breakdown")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getEconomicBreakdown(@PathVariable("caseId") Long caseId) {

        log.info("Getting economic breakdown for case: {}", caseId);

        Map<String, BigDecimal> breakdown = damageService.getEconomicBreakdown(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("breakdown", breakdown))
                        .message("Breakdown retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Sync medical expenses from medical records
     */
    @PostMapping("/sync-medical")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> syncMedicalExpenses(@PathVariable("caseId") Long caseId) {

        log.info("Syncing medical expenses for case: {}", caseId);

        PIDamageElementDTO element = damageService.syncMedicalExpenses(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", element))
                        .message("Medical expenses synced successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get AI comparable analysis
     */
    @PostMapping("/comparable-analysis")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getComparableAnalysis(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, String> request) {

        log.info("Getting comparable analysis for case: {}", caseId);

        String injuryType = request.getOrDefault("injuryType", "general");
        String jurisdiction = request.getOrDefault("jurisdiction", "Massachusetts");

        Map<String, Object> analysis = damageService.getComparableAnalysis(caseId, injuryType, jurisdiction);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("analysis", analysis))
                        .message("Comparable analysis retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Save settlement analysis from case value calculation
     */
    @PostMapping("/settlement-analysis")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> saveSettlementAnalysis(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, Object> settlementAnalysis) {

        log.info("Saving settlement analysis for case: {}", caseId);

        PIDamageCalculationDTO calculation = damageService.saveSettlementAnalysis(caseId, settlementAnalysis);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("calculation", calculation))
                        .message("Settlement analysis saved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // ===== Quick Damage Calculators =====

    /**
     * Calculate household services damages
     */
    @PostMapping("/calculate/household-services")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> calculateHouseholdServices(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, Object> request) {

        log.info("Calculating household services for case: {}", caseId);

        BigDecimal monthlyRate = new BigDecimal(request.get("monthlyRate").toString());
        int months = Integer.parseInt(request.get("months").toString());
        String notes = (String) request.getOrDefault("notes", "");

        PIDamageElementDTO element = damageService.calculateHouseholdServices(caseId, monthlyRate, months, notes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", element))
                        .message("Household services calculated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Calculate mileage damages
     */
    @PostMapping("/calculate/mileage")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> calculateMileage(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, Object> request) {

        log.info("Calculating mileage for case: {}", caseId);

        double miles = Double.parseDouble(request.get("miles").toString());
        BigDecimal ratePerMile = request.get("ratePerMile") != null ?
                new BigDecimal(request.get("ratePerMile").toString()) : null;
        String notes = (String) request.getOrDefault("notes", "");

        PIDamageElementDTO element = damageService.calculateMileage(caseId, miles, ratePerMile, notes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", element))
                        .message("Mileage calculated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Calculate lost wages
     */
    @PostMapping("/calculate/lost-wages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> calculateLostWages(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, Object> request) {

        log.info("Calculating lost wages for case: {}", caseId);

        BigDecimal hourlyRate = new BigDecimal(request.get("hourlyRate").toString());
        int hoursLost = Integer.parseInt(request.get("hoursLost").toString());
        String employerName = (String) request.getOrDefault("employerName", "");
        String notes = (String) request.getOrDefault("notes", "");

        PIDamageElementDTO element = damageService.calculateLostWages(caseId, hourlyRate, hoursLost, employerName, notes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", element))
                        .message("Lost wages calculated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Calculate pain and suffering
     */
    @PostMapping("/calculate/pain-suffering")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> calculatePainSuffering(
            @PathVariable("caseId") Long caseId,
            @RequestBody Map<String, Object> request) {

        log.info("Calculating pain & suffering for case: {}", caseId);

        String method = (String) request.getOrDefault("method", "MULTIPLIER");
        BigDecimal economicBase = new BigDecimal(request.get("economicBase").toString());
        BigDecimal multiplierOrPerDiem = new BigDecimal(request.get("multiplierOrPerDiem").toString());
        Integer durationDays = request.get("durationDays") != null ?
                Integer.parseInt(request.get("durationDays").toString()) : null;
        String notes = (String) request.getOrDefault("notes", "");

        PIDamageElementDTO element = damageService.calculatePainSuffering(
                caseId, method, economicBase, multiplierOrPerDiem, durationDays, notes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("element", element))
                        .message("Pain & suffering calculated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
