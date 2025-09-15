package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkloadAnalyticsDTO {
    private Integer totalAttorneys;
    private Integer overloadedAttorneys;
    private Integer availableAttorneys;
    private BigDecimal averageWorkload;
    private BigDecimal medianWorkload;
    private Map<String, Integer> workloadDistribution;
    private List<UserWorkloadDTO> topWorkloads;
    private BigDecimal autoAssignmentRate;
    private BigDecimal averageResponseTime;
    private Integer pendingTransfers;
    private Map<String, BigDecimal> expertiseUtilization;
}