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
 * P10.c — DTO for liens & subrogation claims.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PILienDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    private String holder;
    private String type;

    private BigDecimal originalAmount;
    private BigDecimal negotiatedAmount;
    private String status;
    private String notes;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate assertedDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate resolvedDate;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;

    private Long createdBy;
}
