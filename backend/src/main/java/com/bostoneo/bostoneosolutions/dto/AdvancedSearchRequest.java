package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.CourtLevel;
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
public class AdvancedSearchRequest {

    private String query;
    private String searchType;
    private String jurisdiction;
    private Long userId;
    private String sessionId;

    // Date range filtering
    private LocalDate startDate;
    private LocalDate endDate;

    // Court level filtering
    private List<CourtLevel> courtLevels;

    // Practice area filtering
    private List<String> practiceAreas;

    // Document type filtering
    private List<String> documentTypes;

    // Additional filters
    private Boolean includeHistorical;
    private Boolean includeAmendments;
    private Integer maxResults;
    private String sortBy;
    private String sortOrder;

    // Boolean search options
    private Boolean enableBooleanSearch;
    private Boolean caseSensitive;

    // Relevance scoring options
    private Boolean enableRelevanceScoring;
    private Double minRelevanceScore;

    // External API filters
    private Boolean includeCourtListener;
    private Boolean includeFederalRegister;
}