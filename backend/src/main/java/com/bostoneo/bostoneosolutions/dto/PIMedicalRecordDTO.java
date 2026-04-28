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
 * DTO for PI Medical Records
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIMedicalRecordDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    // Provider Information
    private String providerName;
    private String providerNpi;
    private String providerType;
    private String providerAddress;
    private String providerPhone;
    private String providerFax;

    // Treating clinician (the actual person who signed/co-signed) — distinct from provider_name (facility)
    private String treatingClinician;
    private String treatingRole;

    // Records Department Contact
    private String recordsEmail;
    private String recordsPhone;
    private String recordsFax;

    // Billing Department Contact
    private String billingEmail;
    private String billingPhone;

    // Record Type & Dates
    private String recordType;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate treatmentDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate treatmentEndDate;

    // Clinical Information
    private List<Map<String, Object>> diagnoses;
    private List<Map<String, Object>> procedures;

    // Tier 2 clinical detail
    private Map<String, Object> vitals;
    private Map<String, Object> rangeOfMotion;
    private List<Map<String, Object>> specialTests;
    private List<Map<String, Object>> medicationsAdministered;
    private List<Map<String, Object>> medicationsPrescribed;

    // Billing Information
    private BigDecimal billedAmount;
    private BigDecimal adjustedAmount;
    private BigDecimal paidAmount;
    private String lienHolder;
    private BigDecimal lienAmount;

    // Clinical Notes
    private String keyFindings;
    private String treatmentProvided;
    private String prognosisNotes;
    private String workRestrictions;
    private String followUpRecommendations;

    // Causation (Tier 2): verbatim MVA causation quote with attribution
    private String causationStatement;
    private String causationSource;

    // Completeness Tracking
    private Boolean isComplete;
    private List<String> missingElements;

    // Document Reference
    private Long documentId;
    private String documentName;

    // Citation Metadata - stores page numbers, excerpts for each extracted field
    private Map<String, Object> citationMetadata;

    // Related info
    private String caseNumber;
    private String clientName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    private Long createdBy;
    private String createdByName;
}
