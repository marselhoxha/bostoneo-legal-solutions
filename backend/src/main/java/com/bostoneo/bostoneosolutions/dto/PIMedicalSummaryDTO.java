package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DTO for PI Medical Summary
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIMedicalSummaryDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    // Summary Content
    private String treatmentChronology;
    private List<Map<String, Object>> providerSummary;
    private List<Map<String, Object>> diagnosisList;
    private List<Map<String, Object>> redFlags;
    private List<Map<String, Object>> missingRecords;
    private String keyHighlights;
    private String prognosisAssessment;

    // Metrics
    private Integer totalProviders;
    private Integer totalVisits;
    private BigDecimal totalBilled;
    private Integer treatmentDurationDays;
    private Integer treatmentGapDays;

    // Completeness Score
    private Integer completenessScore;
    private String completenessNotes;

    // Generation Info
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime generatedAt;

    private String generatedByModel;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate lastRecordDate;

    private Boolean isStale;

    // Related info
    private String caseNumber;
    private String clientName;
    private String injuryType;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
