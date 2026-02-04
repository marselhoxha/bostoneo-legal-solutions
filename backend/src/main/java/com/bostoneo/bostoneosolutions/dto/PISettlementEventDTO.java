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

/**
 * DTO for PI Settlement Events
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PISettlementEventDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime eventDate;

    private BigDecimal demandAmount;
    private BigDecimal offerAmount;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate offerDate;

    private BigDecimal counterAmount;
    private String notes;

    // Related info
    private String caseNumber;
    private String clientName;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    private Long createdBy;
    private String createdByName;
}
