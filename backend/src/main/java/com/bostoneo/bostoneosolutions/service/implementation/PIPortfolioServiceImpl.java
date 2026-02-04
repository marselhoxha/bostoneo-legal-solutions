package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIPortfolioStatsDTO;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.PIDamageCalculation;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.PIDamageCalculationRepository;
import com.bostoneo.bostoneosolutions.service.PIPortfolioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of PI Portfolio Service
 * Provides aggregate statistics and case list operations for PI cases
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Slf4j
public class PIPortfolioServiceImpl implements PIPortfolioService {

    private final LegalCaseRepository caseRepository;
    private final PIDamageCalculationRepository damageCalculationRepository;
    private final TenantService tenantService;

    // Practice area identifier for Personal Injury cases
    private static final String PI_PRACTICE_AREA = "Personal Injury";

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public PIPortfolioStatsDTO getPortfolioStats(Long organizationId) {
        Long orgId = organizationId != null ? organizationId : getRequiredOrganizationId();
        log.info("Getting PI portfolio stats for organization: {}", orgId);

        // Get all PI cases for this organization
        List<LegalCase> piCases = getPICasesInternal(orgId);

        if (piCases.isEmpty()) {
            return PIPortfolioStatsDTO.builder()
                    .totalCases(0L)
                    .activeCases(0L)
                    .pendingCases(0L)
                    .settledCases(0L)
                    .closedCases(0L)
                    .totalPortfolioValue(BigDecimal.ZERO)
                    .avgCaseValue(BigDecimal.ZERO)
                    .totalMedicalExpenses(BigDecimal.ZERO)
                    .totalSettlementOffers(BigDecimal.ZERO)
                    .casesInSettlement(0L)
                    .casesWithDemandPending(0L)
                    .avgSettlementGap(BigDecimal.ZERO)
                    .casesByStatus(new HashMap<>())
                    .valueByStatus(new HashMap<>())
                    .build();
        }

        // Calculate case counts by status
        Map<String, Long> casesByStatus = piCases.stream()
                .collect(Collectors.groupingBy(
                        c -> c.getStatus() != null ? c.getStatus().name() : "UNKNOWN",
                        Collectors.counting()
                ));

        long activeCases = casesByStatus.getOrDefault("ACTIVE", 0L) +
                           casesByStatus.getOrDefault("OPEN", 0L) +
                           casesByStatus.getOrDefault("IN_PROGRESS", 0L);
        long pendingCases = casesByStatus.getOrDefault("PENDING", 0L);
        long closedCases = casesByStatus.getOrDefault("CLOSED", 0L) +
                           casesByStatus.getOrDefault("ARCHIVED", 0L);

        // Calculate settled cases (cases with final settlement amount)
        long settledCases = piCases.stream()
                .filter(c -> c.getSettlementFinalAmount() != null && c.getSettlementFinalAmount() > 0)
                .count();

        // Get damage calculations for portfolio value
        List<Long> caseIds = piCases.stream()
                .map(LegalCase::getId)
                .collect(Collectors.toList());

        BigDecimal totalPortfolioValue = BigDecimal.ZERO;
        BigDecimal totalMedicalExpenses = BigDecimal.ZERO;

        for (LegalCase piCase : piCases) {
            // Try to get damage calculation value first
            Optional<PIDamageCalculation> damageCalc = damageCalculationRepository
                    .findByCaseIdAndOrganizationId(piCase.getId(), orgId);

            if (damageCalc.isPresent() && damageCalc.get().getMidValue() != null) {
                totalPortfolioValue = totalPortfolioValue.add(damageCalc.get().getMidValue());
            } else if (piCase.getSettlementDemandAmount() != null) {
                totalPortfolioValue = totalPortfolioValue.add(BigDecimal.valueOf(piCase.getSettlementDemandAmount()));
            }

            // Sum medical expenses
            if (piCase.getMedicalExpensesTotal() != null) {
                totalMedicalExpenses = totalMedicalExpenses.add(BigDecimal.valueOf(piCase.getMedicalExpensesTotal()));
            }
        }

        // Calculate average case value
        BigDecimal avgCaseValue = !piCases.isEmpty()
                ? totalPortfolioValue.divide(BigDecimal.valueOf(piCases.size()), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Calculate settlement stats
        BigDecimal totalSettlementOffers = piCases.stream()
                .filter(c -> c.getSettlementOfferAmount() != null)
                .map(c -> BigDecimal.valueOf(c.getSettlementOfferAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long casesInSettlement = piCases.stream()
                .filter(c -> c.getSettlementOfferAmount() != null && c.getSettlementOfferAmount() > 0
                          && (c.getSettlementFinalAmount() == null || c.getSettlementFinalAmount() == 0))
                .count();

        long casesWithDemandPending = piCases.stream()
                .filter(c -> c.getSettlementDemandAmount() != null && c.getSettlementDemandAmount() > 0
                          && (c.getSettlementOfferAmount() == null || c.getSettlementOfferAmount() == 0))
                .count();

        // Calculate average settlement gap (demand - offer)
        List<Double> settlementGaps = piCases.stream()
                .filter(c -> c.getSettlementDemandAmount() != null && c.getSettlementOfferAmount() != null)
                .map(c -> c.getSettlementDemandAmount() - c.getSettlementOfferAmount())
                .filter(gap -> gap > 0)
                .collect(Collectors.toList());

        BigDecimal avgSettlementGap = !settlementGaps.isEmpty()
                ? BigDecimal.valueOf(settlementGaps.stream().mapToDouble(Double::doubleValue).average().orElse(0))
                : BigDecimal.ZERO;

        // Calculate value by status
        Map<String, BigDecimal> valueByStatus = new HashMap<>();
        for (String status : casesByStatus.keySet()) {
            BigDecimal statusValue = piCases.stream()
                    .filter(c -> c.getStatus() != null && c.getStatus().name().equals(status))
                    .map(c -> {
                        Optional<PIDamageCalculation> calc = damageCalculationRepository
                                .findByCaseIdAndOrganizationId(c.getId(), orgId);
                        if (calc.isPresent() && calc.get().getMidValue() != null) {
                            return calc.get().getMidValue();
                        } else if (c.getSettlementDemandAmount() != null) {
                            return BigDecimal.valueOf(c.getSettlementDemandAmount());
                        }
                        return BigDecimal.ZERO;
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            valueByStatus.put(status, statusValue);
        }

        return PIPortfolioStatsDTO.builder()
                .totalCases((long) piCases.size())
                .activeCases(activeCases)
                .pendingCases(pendingCases)
                .settledCases(settledCases)
                .closedCases(closedCases)
                .totalPortfolioValue(totalPortfolioValue)
                .avgCaseValue(avgCaseValue)
                .totalMedicalExpenses(totalMedicalExpenses)
                .totalSettlementOffers(totalSettlementOffers)
                .casesInSettlement(casesInSettlement)
                .casesWithDemandPending(casesWithDemandPending)
                .avgSettlementGap(avgSettlementGap)
                .casesByStatus(casesByStatus)
                .valueByStatus(valueByStatus)
                .build();
    }

    @Override
    public Page<LegalCase> getPICases(Long organizationId, Pageable pageable) {
        Long orgId = organizationId != null ? organizationId : getRequiredOrganizationId();
        log.info("Getting PI cases for organization: {}, page: {}", orgId, pageable.getPageNumber());

        List<LegalCase> allPICases = getPICasesInternal(orgId);

        // Manual pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), allPICases.size());

        List<LegalCase> pageContent = start < allPICases.size()
                ? allPICases.subList(start, end)
                : Collections.emptyList();

        return new PageImpl<>(pageContent, pageable, allPICases.size());
    }

    @Override
    public Page<LegalCase> searchPICases(Long organizationId, String searchTerm, Pageable pageable) {
        Long orgId = organizationId != null ? organizationId : getRequiredOrganizationId();
        log.info("Searching PI cases for organization: {}, term: {}", orgId, searchTerm);

        List<LegalCase> allPICases = getPICasesInternal(orgId);

        String lowerSearch = searchTerm.toLowerCase();
        List<LegalCase> filtered = allPICases.stream()
                .filter(c ->
                    (c.getCaseNumber() != null && c.getCaseNumber().toLowerCase().contains(lowerSearch)) ||
                    (c.getTitle() != null && c.getTitle().toLowerCase().contains(lowerSearch)) ||
                    (c.getClientName() != null && c.getClientName().toLowerCase().contains(lowerSearch))
                )
                .collect(Collectors.toList());

        // Manual pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());

        List<LegalCase> pageContent = start < filtered.size()
                ? filtered.subList(start, end)
                : Collections.emptyList();

        return new PageImpl<>(pageContent, pageable, filtered.size());
    }

    @Override
    public Page<LegalCase> getPICasesByStatus(Long organizationId, String status, Pageable pageable) {
        Long orgId = organizationId != null ? organizationId : getRequiredOrganizationId();
        log.info("Getting PI cases by status: {} for organization: {}", status, orgId);

        List<LegalCase> allPICases = getPICasesInternal(orgId);

        List<LegalCase> filtered = allPICases.stream()
                .filter(c -> c.getStatus() != null && c.getStatus().name().equalsIgnoreCase(status))
                .collect(Collectors.toList());

        // Manual pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());

        List<LegalCase> pageContent = start < filtered.size()
                ? filtered.subList(start, end)
                : Collections.emptyList();

        return new PageImpl<>(pageContent, pageable, filtered.size());
    }

    /**
     * Internal method to get all PI cases for an organization
     * Filters by practice area or type containing "personal injury" keywords
     */
    private List<LegalCase> getPICasesInternal(Long orgId) {
        List<LegalCase> allCases = caseRepository.findByOrganizationId(orgId);

        return allCases.stream()
                .filter(c -> isPICase(c))
                .sorted((a, b) -> {
                    // Sort by most recent first
                    if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
                    if (a.getCreatedAt() == null) return 1;
                    if (b.getCreatedAt() == null) return -1;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .collect(Collectors.toList());
    }

    /**
     * Check if a case is a Personal Injury case based on practice area or type
     */
    private boolean isPICase(LegalCase c) {
        // Check practice area field
        if (c.getPracticeArea() != null) {
            String pa = c.getPracticeArea().toLowerCase();
            if (pa.contains("personal injury") || pa.equals("pi")) {
                return true;
            }
        }

        // Check type field as fallback
        if (c.getType() != null) {
            String type = c.getType().toLowerCase();
            return type.contains("personal injury") ||
                   type.contains("pi") ||
                   type.contains("injury") ||
                   type.contains("accident") ||
                   type.contains("negligence") ||
                   type.contains("premises liability") ||
                   type.contains("medical malpractice") ||
                   type.contains("slip and fall") ||
                   type.contains("motor vehicle");
        }

        return false;
    }
}
