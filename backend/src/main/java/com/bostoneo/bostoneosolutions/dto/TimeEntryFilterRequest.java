package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.TimeEntryStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimeEntryFilterRequest {
    private Long userId;
    private Long legalCaseId;
    private Long customerId;
    private LocalDate startDate;
    private LocalDate endDate;
    private List<TimeEntryStatus> statuses;
    private Boolean billable;
    private String description; // for text search
    
    // Pagination parameters
    private int page = 0;
    private int size = 10;
    
    // Sorting parameters
    private String sortBy = "date";
    private String sortDirection = "desc";
} 
 
 
 
 
 
 