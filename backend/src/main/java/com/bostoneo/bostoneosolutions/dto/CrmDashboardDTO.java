package com.bostoneo.bostoneosolutions.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CrmDashboardDTO {
    
    private Map<String, Long> submissionCounts;
    
    private Map<String, Long> practiceAreaCounts;
    
    private Map<String, Long> priorityRanges;
    
    private Map<String, Object> conversionStats;
}