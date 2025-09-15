package com.bostoneo.bostoneosolutions.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentTransactionDTO {
    private Long id;
    private Long invoiceId;
    private String transactionType;
    private String transactionStatus;
    private BigDecimal amount;
    private String routingNumber;
    private String accountNumberLast4;
    private String wireReference;
    private String bankName;
    private LocalDate processingDate;
    private LocalDate completionDate;
    private String referenceNumber;
    private String notes;
    private Long createdBy;
}