package com.***REMOVED***.***REMOVED***solutions.resource;

import com.***REMOVED***.***REMOVED***solutions.dto.CrmDashboardDTO;
import com.***REMOVED***.***REMOVED***solutions.service.IntakeSubmissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/crm")
@RequiredArgsConstructor
@Slf4j
public class CrmDashboardResource {

    private final IntakeSubmissionService intakeSubmissionService;

    @GetMapping("/dashboard")
    public ResponseEntity<CrmDashboardDTO> getDashboardData() {
        log.info("Fetching CRM dashboard data");
        
        try {
            // Get submission counts by status
            Map<String, Long> submissionCounts = intakeSubmissionService.getSubmissionCountsByStatus();
            
            // Get practice area counts
            Map<String, Long> practiceAreaCounts = intakeSubmissionService.getSubmissionCountsByPracticeArea();
            
            // Get priority range counts
            Map<String, Long> priorityRanges = intakeSubmissionService.getSubmissionsByPriorityRange();
            
            // Calculate conversion stats
            long totalSubmissions = submissionCounts.values().stream().mapToLong(Long::longValue).sum();
            long convertedToLeads = submissionCounts.getOrDefault("CONVERTED_TO_LEAD", 0L);
            double conversionRate = totalSubmissions > 0 ? (convertedToLeads * 100.0) / totalSubmissions : 0.0;
            
            CrmDashboardDTO dashboard = new CrmDashboardDTO();
            dashboard.setSubmissionCounts(submissionCounts);
            dashboard.setPracticeAreaCounts(practiceAreaCounts);
            dashboard.setPriorityRanges(priorityRanges);
            
            Map<String, Object> conversionStats = new HashMap<>();
            conversionStats.put("totalSubmissions", totalSubmissions);
            conversionStats.put("convertedToLeads", convertedToLeads);
            conversionStats.put("conversionRate", Math.round(conversionRate * 100.0) / 100.0);
            dashboard.setConversionStats(conversionStats);
            
            return ResponseEntity.ok(dashboard);
            
        } catch (Exception e) {
            log.error("Error fetching dashboard data", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}