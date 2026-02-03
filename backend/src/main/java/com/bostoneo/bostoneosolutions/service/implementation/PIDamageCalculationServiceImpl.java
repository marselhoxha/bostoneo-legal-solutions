package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIDamageCalculationDTO;
import com.bostoneo.bostoneosolutions.dto.PIDamageElementDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PIDamageCalculation;
import com.bostoneo.bostoneosolutions.model.PIDamageElement;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PIDamageCalculationRepository;
import com.bostoneo.bostoneosolutions.repository.PIDamageElementRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalRecordRepository;
import com.bostoneo.bostoneosolutions.service.PIDamageCalculationService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of PI Damage Calculation Service
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PIDamageCalculationServiceImpl implements PIDamageCalculationService {

    private final PIDamageElementRepository elementRepository;
    private final PIDamageCalculationRepository calculationRepository;
    private final PIMedicalRecordRepository medicalRecordRepository;
    private final TenantService tenantService;
    private final ClaudeSonnet4Service claudeService;

    // IRS mileage rate for 2024
    private static final BigDecimal IRS_MILEAGE_RATE = new BigDecimal("0.67");

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // ===== Damage Elements =====

    @Override
    public List<PIDamageElementDTO> getDamageElementsByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting damage elements for case: {} in org: {}", caseId, orgId);

        return elementRepository.findByCaseIdAndOrganizationIdOrderByDisplayOrderAsc(caseId, orgId)
                .stream()
                .map(this::mapElementToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PIDamageElementDTO getDamageElementById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PIDamageElement element = elementRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Damage element not found with ID: " + id));
        return mapElementToDTO(element);
    }

    @Override
    public PIDamageElementDTO createDamageElement(Long caseId, PIDamageElementDTO elementDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating damage element for case: {} in org: {}", caseId, orgId);

        PIDamageElement element = mapDTOToElement(elementDTO);
        element.setCaseId(caseId);
        element.setOrganizationId(orgId);

        // Set display order
        Integer maxOrder = elementRepository.getMaxDisplayOrder(caseId, orgId);
        element.setDisplayOrder(maxOrder + 1);

        // Calculate amount if not provided
        if (element.getCalculatedAmount() == null) {
            element.setCalculatedAmount(calculateElementAmount(element));
        }

        PIDamageElement saved = elementRepository.save(element);
        log.info("Damage element created with ID: {}", saved.getId());
        return mapElementToDTO(saved);
    }

    @Override
    public PIDamageElementDTO updateDamageElement(Long id, PIDamageElementDTO elementDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating damage element: {} in org: {}", id, orgId);

        PIDamageElement existing = elementRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Damage element not found with ID: " + id));

        updateElementFromDTO(existing, elementDTO);

        // Recalculate amount if base values changed
        if (elementDTO.getBaseAmount() != null || elementDTO.getMultiplier() != null ||
                elementDTO.getDurationValue() != null) {
            existing.setCalculatedAmount(calculateElementAmount(existing));
        }

        PIDamageElement saved = elementRepository.save(existing);
        return mapElementToDTO(saved);
    }

    @Override
    public void deleteDamageElement(Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting damage element: {} in org: {}", id, orgId);

        PIDamageElement element = elementRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Damage element not found with ID: " + id));

        elementRepository.delete(element);
        log.info("Damage element deleted successfully");
    }

    @Override
    public List<PIDamageElementDTO> getDamageElementsByType(Long caseId, String elementType) {
        Long orgId = getRequiredOrganizationId();
        return elementRepository.findByCaseIdAndOrganizationIdAndElementType(caseId, orgId, elementType)
                .stream()
                .map(this::mapElementToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public void reorderDamageElements(Long caseId, List<Long> elementIds) {
        Long orgId = getRequiredOrganizationId();
        log.info("Reordering {} damage elements for case: {}", elementIds.size(), caseId);

        for (int i = 0; i < elementIds.size(); i++) {
            PIDamageElement element = elementRepository.findByIdAndOrganizationId(elementIds.get(i), orgId)
                    .orElseThrow(() -> new ResourceNotFoundException("Element not found"));
            element.setDisplayOrder(i);
            elementRepository.save(element);
        }
    }

    // ===== Damage Calculation Summary =====

    @Override
    public PIDamageCalculationDTO getDamageCalculation(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return calculationRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(this::mapCalculationToDTO)
                .orElse(null);
    }

    @Override
    public PIDamageCalculationDTO calculateDamages(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Calculating damages for case: {} in org: {}", caseId, orgId);

        // Get all damage elements
        List<PIDamageElement> elements = elementRepository
                .findByCaseIdAndOrganizationIdOrderByDisplayOrderAsc(caseId, orgId);

        // Sum by type
        Map<String, BigDecimal> sumsByType = new HashMap<>();
        for (PIDamageElement element : elements) {
            sumsByType.merge(element.getElementType(),
                    element.getCalculatedAmount() != null ? element.getCalculatedAmount() : BigDecimal.ZERO,
                    BigDecimal::add);
        }

        // Get or create calculation record
        PIDamageCalculation calculation = calculationRepository
                .findByCaseIdAndOrganizationId(caseId, orgId)
                .orElse(PIDamageCalculation.builder()
                        .caseId(caseId)
                        .organizationId(orgId)
                        .build());

        // Set category totals
        calculation.setPastMedicalTotal(sumsByType.getOrDefault("PAST_MEDICAL", BigDecimal.ZERO));
        calculation.setFutureMedicalTotal(sumsByType.getOrDefault("FUTURE_MEDICAL", BigDecimal.ZERO));
        calculation.setLostWagesTotal(sumsByType.getOrDefault("LOST_WAGES", BigDecimal.ZERO));
        calculation.setEarningCapacityTotal(sumsByType.getOrDefault("EARNING_CAPACITY", BigDecimal.ZERO));
        calculation.setHouseholdServicesTotal(sumsByType.getOrDefault("HOUSEHOLD_SERVICES", BigDecimal.ZERO));
        calculation.setPainSufferingTotal(sumsByType.getOrDefault("PAIN_SUFFERING", BigDecimal.ZERO));
        calculation.setMileageTotal(sumsByType.getOrDefault("MILEAGE", BigDecimal.ZERO));
        calculation.setOtherDamagesTotal(sumsByType.getOrDefault("OTHER", BigDecimal.ZERO));

        // Calculate economic damages
        BigDecimal economicTotal = calculation.getPastMedicalTotal()
                .add(calculation.getFutureMedicalTotal())
                .add(calculation.getLostWagesTotal())
                .add(calculation.getEarningCapacityTotal())
                .add(calculation.getHouseholdServicesTotal())
                .add(calculation.getMileageTotal())
                .add(calculation.getOtherDamagesTotal());
        calculation.setEconomicDamagesTotal(economicTotal);

        // Non-economic is pain & suffering
        calculation.setNonEconomicDamagesTotal(calculation.getPainSufferingTotal());

        // Gross total
        calculation.setGrossDamagesTotal(economicTotal.add(calculation.getPainSufferingTotal()));

        // Apply comparative negligence if set
        if (calculation.getComparativeNegligencePercent() != null && calculation.getComparativeNegligencePercent() > 0) {
            BigDecimal negligenceFactor = BigDecimal.ONE.subtract(
                    new BigDecimal(calculation.getComparativeNegligencePercent()).divide(new BigDecimal(100), 4, RoundingMode.HALF_UP));
            calculation.setAdjustedDamagesTotal(calculation.getGrossDamagesTotal().multiply(negligenceFactor));
        } else {
            calculation.setAdjustedDamagesTotal(calculation.getGrossDamagesTotal());
        }

        // Set value ranges (simplified - ±25%)
        BigDecimal midValue = calculation.getAdjustedDamagesTotal();
        calculation.setMidValue(midValue);
        calculation.setLowValue(midValue.multiply(new BigDecimal("0.75")));
        calculation.setHighValue(midValue.multiply(new BigDecimal("1.25")));

        calculation.setCalculatedAt(LocalDateTime.now());

        PIDamageCalculation saved = calculationRepository.save(calculation);
        log.info("Damage calculation saved with total: {}", saved.getAdjustedDamagesTotal());

        return mapCalculationToDTO(saved);
    }

    @Override
    public PIDamageCalculationDTO calculateDamagesWithAI(Long caseId, Map<String, Object> caseContext) {
        // First calculate the raw damages
        PIDamageCalculationDTO calculation = calculateDamages(caseId);

        // Then get AI comparable analysis
        String injuryType = caseContext != null ? (String) caseContext.get("injuryType") : "general";
        String jurisdiction = caseContext != null ? (String) caseContext.getOrDefault("jurisdiction", "Massachusetts") : "Massachusetts";

        Map<String, Object> aiAnalysis = getComparableAnalysis(caseId, injuryType, jurisdiction);

        // Update with AI analysis
        Long orgId = getRequiredOrganizationId();
        PIDamageCalculation entity = calculationRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Calculation not found"));

        entity.setComparableAnalysis(aiAnalysis);

        // Check if settlement analysis was provided in the context
        @SuppressWarnings("unchecked")
        Map<String, Object> settlementAnalysis = caseContext != null ?
                (Map<String, Object>) caseContext.get("settlementAnalysis") : null;
        if (settlementAnalysis != null) {
            entity.setSettlementAnalysis(settlementAnalysis);
            calculation.setSettlementAnalysis(settlementAnalysis);
        }

        calculationRepository.save(entity);

        calculation.setComparableAnalysis(aiAnalysis);
        return calculation;
    }

    /**
     * Save settlement analysis from case value calculation
     */
    public PIDamageCalculationDTO saveSettlementAnalysis(Long caseId, Map<String, Object> settlementAnalysis) {
        Long orgId = getRequiredOrganizationId();
        log.info("Saving settlement analysis for case: {} in org: {}", caseId, orgId);

        // Get or create calculation record
        PIDamageCalculation calculation = calculationRepository
                .findByCaseIdAndOrganizationId(caseId, orgId)
                .orElse(PIDamageCalculation.builder()
                        .caseId(caseId)
                        .organizationId(orgId)
                        .build());

        calculation.setSettlementAnalysis(settlementAnalysis);

        // Update value ranges from settlement analysis if present
        if (settlementAnalysis.get("settlementRangeLow") != null) {
            calculation.setLowValue(toBigDecimal(settlementAnalysis.get("settlementRangeLow")));
        }
        if (settlementAnalysis.get("realisticRecovery") != null) {
            calculation.setMidValue(toBigDecimal(settlementAnalysis.get("realisticRecovery")));
        }
        if (settlementAnalysis.get("settlementRangeHigh") != null) {
            calculation.setHighValue(toBigDecimal(settlementAnalysis.get("settlementRangeHigh")));
        }
        if (settlementAnalysis.get("economicDamages") != null) {
            calculation.setEconomicDamagesTotal(toBigDecimal(settlementAnalysis.get("economicDamages")));
        }
        if (settlementAnalysis.get("nonEconomicDamages") != null) {
            calculation.setNonEconomicDamagesTotal(toBigDecimal(settlementAnalysis.get("nonEconomicDamages")));
        }

        calculation.setCalculatedAt(LocalDateTime.now());
        PIDamageCalculation saved = calculationRepository.save(calculation);
        log.info("Settlement analysis saved for case: {}", caseId);

        return mapCalculationToDTO(saved);
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Number) return BigDecimal.valueOf(((Number) value).doubleValue());
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    public Map<String, BigDecimal> getSummaryByDamageType(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        List<Object[]> results = elementRepository.sumAmountsByElementType(caseId, orgId);

        Map<String, BigDecimal> summary = new HashMap<>();
        for (Object[] row : results) {
            summary.put((String) row[0], (BigDecimal) row[1]);
        }
        return summary;
    }

    @Override
    public Map<String, BigDecimal> getEconomicBreakdown(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        Map<String, BigDecimal> breakdown = new HashMap<>();
        breakdown.put("economic", elementRepository.sumEconomicDamages(caseId, orgId));
        breakdown.put("nonEconomic", elementRepository.sumNonEconomicDamages(caseId, orgId));
        breakdown.put("total", elementRepository.sumTotalCalculatedAmount(caseId, orgId));
        return breakdown;
    }

    @Override
    public PIDamageElementDTO syncMedicalExpenses(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Syncing medical expenses from records for case: {}", caseId);

        BigDecimal totalBilled = medicalRecordRepository.sumBilledAmountByCaseId(caseId, orgId);
        if (totalBilled == null) totalBilled = BigDecimal.ZERO;

        // Find or create past medical element
        List<PIDamageElement> existingMedical = elementRepository
                .findByCaseIdAndOrganizationIdAndElementType(caseId, orgId, "PAST_MEDICAL");

        PIDamageElement medicalElement;
        if (!existingMedical.isEmpty()) {
            medicalElement = existingMedical.get(0);
        } else {
            medicalElement = PIDamageElement.builder()
                    .caseId(caseId)
                    .organizationId(orgId)
                    .elementType("PAST_MEDICAL")
                    .elementName("Past Medical Expenses")
                    .calculationMethod("Actual")
                    .confidenceLevel("HIGH")
                    .displayOrder(0)
                    .build();
        }

        medicalElement.setBaseAmount(totalBilled);
        medicalElement.setCalculatedAmount(totalBilled);
        medicalElement.setNotes("Synced from medical records on " + LocalDateTime.now().toLocalDate());

        PIDamageElement saved = elementRepository.save(medicalElement);
        return mapElementToDTO(saved);
    }

    @Override
    public Map<String, Object> getComparableAnalysis(Long caseId, String injuryType, String jurisdiction) {
        log.info("Getting AI comparable analysis for case: {}, injury: {}", caseId, injuryType);

        Long orgId = getRequiredOrganizationId();
        BigDecimal totalDamages = elementRepository.sumTotalCalculatedAmount(caseId, orgId);

        String prompt = String.format("""
            You are a personal injury settlement analyst. Analyze this case and provide comparable case data.

            CASE INFORMATION:
            Injury Type: %s
            Jurisdiction: %s
            Total Calculated Damages: $%,.2f

            Please provide analysis in this format:
            1. SETTLEMENT RANGE ANALYSIS
               - Median settlement for similar cases
               - 25th percentile
               - 75th percentile
               - Key factors that affect value

            2. VALUE FACTORS
               - Factors that could increase value
               - Factors that could decrease value
               - Settlement vs trial considerations

            3. COMPARABLE CASES SUMMARY
               - General trends for this injury type in %s
               - Important precedents or benchmarks

            Format as a clear, structured analysis suitable for case evaluation.
            """,
                injuryType,
                jurisdiction,
                totalDamages != null ? totalDamages.doubleValue() : 0,
                jurisdiction
        );

        Map<String, Object> analysis = new HashMap<>();
        try {
            String response = claudeService.generateCompletion(prompt, false).get();
            analysis.put("success", true);
            analysis.put("analysis", response);
            analysis.put("injuryType", injuryType);
            analysis.put("jurisdiction", jurisdiction);
            analysis.put("generatedAt", LocalDateTime.now().toString());
        } catch (Exception e) {
            log.error("Error getting AI comparable analysis: ", e);
            analysis.put("success", false);
            analysis.put("error", e.getMessage());
        }

        return analysis;
    }

    @Override
    public PIDamageElementDTO calculateHouseholdServices(Long caseId, BigDecimal monthlyRate, int months, String notes) {
        Long orgId = getRequiredOrganizationId();
        log.info("Calculating household services for case: {}", caseId);

        BigDecimal total = monthlyRate.multiply(BigDecimal.valueOf(months));

        PIDamageElement element = PIDamageElement.builder()
                .caseId(caseId)
                .organizationId(orgId)
                .elementType("HOUSEHOLD_SERVICES")
                .elementName("Household Services Loss")
                .calculationMethod("Monthly Rate")
                .baseAmount(monthlyRate)
                .durationValue(BigDecimal.valueOf(months))
                .durationUnit("Months")
                .calculatedAmount(total)
                .confidenceLevel("MEDIUM")
                .notes(notes)
                .displayOrder(elementRepository.getMaxDisplayOrder(caseId, orgId) + 1)
                .build();

        PIDamageElement saved = elementRepository.save(element);
        return mapElementToDTO(saved);
    }

    @Override
    public PIDamageElementDTO calculateMileage(Long caseId, double miles, BigDecimal ratePerMile, String notes) {
        Long orgId = getRequiredOrganizationId();
        log.info("Calculating mileage for case: {}", caseId);

        BigDecimal rate = ratePerMile != null ? ratePerMile : IRS_MILEAGE_RATE;
        BigDecimal total = rate.multiply(BigDecimal.valueOf(miles));

        PIDamageElement element = PIDamageElement.builder()
                .caseId(caseId)
                .organizationId(orgId)
                .elementType("MILEAGE")
                .elementName("Medical Travel Mileage")
                .calculationMethod("IRS Rate")
                .baseAmount(rate)
                .durationValue(BigDecimal.valueOf(miles))
                .durationUnit("Miles")
                .calculatedAmount(total)
                .confidenceLevel("HIGH")
                .notes(notes)
                .displayOrder(elementRepository.getMaxDisplayOrder(caseId, orgId) + 1)
                .build();

        PIDamageElement saved = elementRepository.save(element);
        return mapElementToDTO(saved);
    }

    @Override
    public PIDamageElementDTO calculateLostWages(Long caseId, BigDecimal hourlyRate, int hoursLost,
                                                  String employerName, String notes) {
        Long orgId = getRequiredOrganizationId();
        log.info("Calculating lost wages for case: {}", caseId);

        BigDecimal total = hourlyRate.multiply(BigDecimal.valueOf(hoursLost));

        PIDamageElement element = PIDamageElement.builder()
                .caseId(caseId)
                .organizationId(orgId)
                .elementType("LOST_WAGES")
                .elementName("Lost Wages")
                .calculationMethod("Hourly")
                .baseAmount(hourlyRate)
                .durationValue(BigDecimal.valueOf(hoursLost))
                .durationUnit("Hours")
                .calculatedAmount(total)
                .sourceEmployer(employerName)
                .confidenceLevel("HIGH")
                .notes(notes)
                .displayOrder(elementRepository.getMaxDisplayOrder(caseId, orgId) + 1)
                .build();

        PIDamageElement saved = elementRepository.save(element);
        return mapElementToDTO(saved);
    }

    @Override
    public PIDamageElementDTO calculatePainSuffering(Long caseId, String calculationMethod,
                                                      BigDecimal economicBase, BigDecimal multiplierOrPerDiem,
                                                      Integer durationDays, String notes) {
        Long orgId = getRequiredOrganizationId();
        log.info("Calculating pain & suffering for case: {} using {} method", caseId, calculationMethod);

        BigDecimal total;
        String elementName;

        if ("MULTIPLIER".equalsIgnoreCase(calculationMethod)) {
            total = economicBase.multiply(multiplierOrPerDiem);
            elementName = String.format("Pain & Suffering (%sx Multiplier)", multiplierOrPerDiem);
        } else if ("PER_DIEM".equalsIgnoreCase(calculationMethod)) {
            total = multiplierOrPerDiem.multiply(BigDecimal.valueOf(durationDays));
            elementName = String.format("Pain & Suffering ($%s/day)", multiplierOrPerDiem);
        } else {
            total = economicBase; // Direct amount
            elementName = "Pain & Suffering";
        }

        PIDamageElement element = PIDamageElement.builder()
                .caseId(caseId)
                .organizationId(orgId)
                .elementType("PAIN_SUFFERING")
                .elementName(elementName)
                .calculationMethod(calculationMethod)
                .baseAmount(economicBase)
                .multiplier(multiplierOrPerDiem)
                .durationValue(durationDays != null ? BigDecimal.valueOf(durationDays) : null)
                .durationUnit("Days")
                .calculatedAmount(total)
                .confidenceLevel("MEDIUM")
                .notes(notes)
                .displayOrder(elementRepository.getMaxDisplayOrder(caseId, orgId) + 1)
                .build();

        PIDamageElement saved = elementRepository.save(element);
        return mapElementToDTO(saved);
    }

    // Helper methods

    private BigDecimal calculateElementAmount(PIDamageElement element) {
        if (element.getBaseAmount() == null) return BigDecimal.ZERO;

        BigDecimal base = element.getBaseAmount();

        if (element.getMultiplier() != null && element.getMultiplier().compareTo(BigDecimal.ZERO) > 0) {
            return base.multiply(element.getMultiplier());
        }

        if (element.getDurationValue() != null && element.getDurationValue().compareTo(BigDecimal.ZERO) > 0) {
            return base.multiply(element.getDurationValue());
        }

        return base;
    }

    private PIDamageElementDTO mapElementToDTO(PIDamageElement entity) {
        return PIDamageElementDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .elementType(entity.getElementType())
                .elementName(entity.getElementName())
                .calculationMethod(entity.getCalculationMethod())
                .baseAmount(entity.getBaseAmount())
                .multiplier(entity.getMultiplier())
                .durationValue(entity.getDurationValue())
                .durationUnit(entity.getDurationUnit())
                .calculatedAmount(entity.getCalculatedAmount())
                .confidenceLevel(entity.getConfidenceLevel())
                .confidenceNotes(entity.getConfidenceNotes())
                .supportingDocuments(entity.getSupportingDocuments())
                .sourceProvider(entity.getSourceProvider())
                .sourceEmployer(entity.getSourceEmployer())
                .sourceDate(entity.getSourceDate())
                .notes(entity.getNotes())
                .legalAuthority(entity.getLegalAuthority())
                .displayOrder(entity.getDisplayOrder())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }

    private PIDamageElement mapDTOToElement(PIDamageElementDTO dto) {
        return PIDamageElement.builder()
                .elementType(dto.getElementType())
                .elementName(dto.getElementName())
                .calculationMethod(dto.getCalculationMethod())
                .baseAmount(dto.getBaseAmount())
                .multiplier(dto.getMultiplier())
                .durationValue(dto.getDurationValue())
                .durationUnit(dto.getDurationUnit())
                .calculatedAmount(dto.getCalculatedAmount())
                .confidenceLevel(dto.getConfidenceLevel())
                .confidenceNotes(dto.getConfidenceNotes())
                .supportingDocuments(dto.getSupportingDocuments())
                .sourceProvider(dto.getSourceProvider())
                .sourceEmployer(dto.getSourceEmployer())
                .sourceDate(dto.getSourceDate())
                .notes(dto.getNotes())
                .legalAuthority(dto.getLegalAuthority())
                .displayOrder(dto.getDisplayOrder())
                .createdBy(dto.getCreatedBy())
                .build();
    }

    private void updateElementFromDTO(PIDamageElement entity, PIDamageElementDTO dto) {
        if (dto.getElementType() != null) entity.setElementType(dto.getElementType());
        if (dto.getElementName() != null) entity.setElementName(dto.getElementName());
        if (dto.getCalculationMethod() != null) entity.setCalculationMethod(dto.getCalculationMethod());
        if (dto.getBaseAmount() != null) entity.setBaseAmount(dto.getBaseAmount());
        if (dto.getMultiplier() != null) entity.setMultiplier(dto.getMultiplier());
        if (dto.getDurationValue() != null) entity.setDurationValue(dto.getDurationValue());
        if (dto.getDurationUnit() != null) entity.setDurationUnit(dto.getDurationUnit());
        if (dto.getCalculatedAmount() != null) entity.setCalculatedAmount(dto.getCalculatedAmount());
        if (dto.getConfidenceLevel() != null) entity.setConfidenceLevel(dto.getConfidenceLevel());
        if (dto.getConfidenceNotes() != null) entity.setConfidenceNotes(dto.getConfidenceNotes());
        if (dto.getSupportingDocuments() != null) entity.setSupportingDocuments(dto.getSupportingDocuments());
        if (dto.getSourceProvider() != null) entity.setSourceProvider(dto.getSourceProvider());
        if (dto.getSourceEmployer() != null) entity.setSourceEmployer(dto.getSourceEmployer());
        if (dto.getSourceDate() != null) entity.setSourceDate(dto.getSourceDate());
        if (dto.getNotes() != null) entity.setNotes(dto.getNotes());
        if (dto.getLegalAuthority() != null) entity.setLegalAuthority(dto.getLegalAuthority());
        if (dto.getDisplayOrder() != null) entity.setDisplayOrder(dto.getDisplayOrder());
    }

    private PIDamageCalculationDTO mapCalculationToDTO(PIDamageCalculation entity) {
        return PIDamageCalculationDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .pastMedicalTotal(entity.getPastMedicalTotal())
                .futureMedicalTotal(entity.getFutureMedicalTotal())
                .lostWagesTotal(entity.getLostWagesTotal())
                .earningCapacityTotal(entity.getEarningCapacityTotal())
                .householdServicesTotal(entity.getHouseholdServicesTotal())
                .painSufferingTotal(entity.getPainSufferingTotal())
                .mileageTotal(entity.getMileageTotal())
                .otherDamagesTotal(entity.getOtherDamagesTotal())
                .economicDamagesTotal(entity.getEconomicDamagesTotal())
                .nonEconomicDamagesTotal(entity.getNonEconomicDamagesTotal())
                .grossDamagesTotal(entity.getGrossDamagesTotal())
                .comparativeNegligencePercent(entity.getComparativeNegligencePercent())
                .adjustedDamagesTotal(entity.getAdjustedDamagesTotal())
                .lowValue(entity.getLowValue())
                .midValue(entity.getMidValue())
                .highValue(entity.getHighValue())
                .comparableAnalysis(entity.getComparableAnalysis())
                .settlementAnalysis(entity.getSettlementAnalysis())
                .calculatedAt(entity.getCalculatedAt())
                .calculationNotes(entity.getCalculationNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
