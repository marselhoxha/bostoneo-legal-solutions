package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

/**
 * DTO for PI Portfolio Statistics
 * Aggregates data across all PI cases for an organization
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_NULL)
public class PIPortfolioStatsDTO {

    // Case Counts
    private Long totalCases;
    private Long activeCases;
    private Long pendingCases;
    private Long settledCases;
    private Long closedCases;

    // Portfolio Value
    private BigDecimal totalPortfolioValue;
    private BigDecimal avgCaseValue;
    private BigDecimal totalMedicalExpenses;
    private BigDecimal totalSettlementOffers;

    // Settlement Stats
    private Long casesInSettlement;
    private Long casesWithDemandPending;
    private BigDecimal avgSettlementGap;

    // Pipeline Breakdown (by status)
    private Map<String, Long> casesByStatus;

    // Value Breakdown
    private Map<String, BigDecimal> valueByStatus;
}
