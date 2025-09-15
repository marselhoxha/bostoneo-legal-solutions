package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.UserWorkload.WorkloadStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserWorkloadDTO {
    private Long userId;
    private String userName;
    private String userEmail;
    private LocalDate calculationDate;
    private Integer activeCasesCount;
    private BigDecimal totalWorkloadPoints;
    private BigDecimal capacityPercentage;
    private BigDecimal maxCapacityPoints;
    private WorkloadStatus workloadStatus;
    private Integer overdueTasksCount;
    private Integer upcomingDeadlinesCount;
    private BigDecimal billableHoursWeek;
    private BigDecimal nonBillableHoursWeek;
    private BigDecimal averageResponseTimeHours;
    private LocalDateTime lastCalculatedAt;
    private List<CaseWorkloadDTO> caseBreakdown;
}