package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PIDamageCalculationDTO;
import com.bostoneo.bostoneosolutions.dto.PIDamageElementDTO;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Service interface for PI Damage Calculation operations
 */
public interface PIDamageCalculationService {

    // ===== Damage Elements =====

    /**
     * Get all damage elements for a case
     */
    List<PIDamageElementDTO> getDamageElementsByCaseId(Long caseId);

    /**
     * Get a specific damage element by ID
     */
    PIDamageElementDTO getDamageElementById(Long id);

    /**
     * Create a new damage element
     */
    PIDamageElementDTO createDamageElement(Long caseId, PIDamageElementDTO elementDTO);

    /**
     * Update an existing damage element
     */
    PIDamageElementDTO updateDamageElement(Long id, PIDamageElementDTO elementDTO);

    /**
     * Delete a damage element
     */
    void deleteDamageElement(Long id);

    /**
     * Get damage elements by type
     */
    List<PIDamageElementDTO> getDamageElementsByType(Long caseId, String elementType);

    /**
     * Reorder damage elements
     */
    void reorderDamageElements(Long caseId, List<Long> elementIds);

    // ===== Damage Calculation Summary =====

    /**
     * Get the damage calculation summary for a case
     */
    PIDamageCalculationDTO getDamageCalculation(Long caseId);

    /**
     * Calculate and save the damage totals for a case
     */
    PIDamageCalculationDTO calculateDamages(Long caseId);

    /**
     * Calculate and save with AI comparable analysis
     */
    PIDamageCalculationDTO calculateDamagesWithAI(Long caseId, Map<String, Object> caseContext);

    /**
     * Get summary amounts by damage type
     */
    Map<String, BigDecimal> getSummaryByDamageType(Long caseId);

    /**
     * Get economic vs non-economic breakdown
     */
    Map<String, BigDecimal> getEconomicBreakdown(Long caseId);

    /**
     * Create or update medical expense damage element from medical records
     */
    PIDamageElementDTO syncMedicalExpenses(Long caseId);

    /**
     * Get AI-powered comparable case analysis
     */
    Map<String, Object> getComparableAnalysis(Long caseId, String injuryType, String jurisdiction);

    /**
     * Calculate household services damages
     */
    PIDamageElementDTO calculateHouseholdServices(Long caseId, BigDecimal monthlyRate, int months, String notes);

    /**
     * Calculate mileage damages
     */
    PIDamageElementDTO calculateMileage(Long caseId, double miles, BigDecimal ratePerMile, String notes);

    /**
     * Calculate lost wages from employment info
     */
    PIDamageElementDTO calculateLostWages(Long caseId, BigDecimal hourlyRate, int hoursLost,
                                          String employerName, String notes);

    /**
     * Calculate pain and suffering using multiplier method
     */
    PIDamageElementDTO calculatePainSuffering(Long caseId, String calculationMethod,
                                               BigDecimal economicBase, BigDecimal multiplierOrPerDiem,
                                               Integer durationDays, String notes);
}
