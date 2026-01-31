package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO for PI Document Checklist
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIDocumentChecklistDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    // Document Information
    private String documentType;
    private String documentSubtype;
    private String providerName;

    // Status Tracking
    private Boolean required;
    private Boolean received;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate receivedDate;

    private String status;

    // Request Tracking
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate requestedDate;

    private String requestSentTo;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate followUpDate;

    private Integer followUpCount;

    // Document Reference
    private Long documentId;
    private String documentName;

    // Notes
    private String notes;

    // Related info
    private String caseNumber;
    private String clientName;

    // Computed fields
    private Integer daysSinceRequested;
    private Boolean isOverdue;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    private Long createdBy;
    private String createdByName;
}
