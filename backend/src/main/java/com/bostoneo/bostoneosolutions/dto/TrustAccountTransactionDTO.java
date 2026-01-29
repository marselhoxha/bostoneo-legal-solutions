package com.bostoneo.bostoneosolutions.dto;

import lombok.Data;
import lombok.Builder;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class TrustAccountTransactionDTO {
    private Long id;
    private Long organizationId;  // SECURITY: Include organization ID for tenant isolation
    private Long trustAccountId;
    private Long clientId;
    private Long legalCaseId;
    private String transactionType;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private LocalDate transactionDate;
    private String referenceNumber;
    private String description;
    private Long relatedInvoiceId;
    private String checkNumber;
    private String payeeName;
    private Boolean isCleared;
    private LocalDate clearedDate;
    private Long reconciliationId;
    private String notes;
    private Long createdBy;
}