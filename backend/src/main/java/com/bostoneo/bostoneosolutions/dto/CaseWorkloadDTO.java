package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseWorkloadDTO {
    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    private String caseType;
    private String priority;
    private BigDecimal workloadPoints;
    private String roleType;
    private Integer activeTasks;
    private Integer overdueTasks;
}