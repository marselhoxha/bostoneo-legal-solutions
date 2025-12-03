package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientPortalInvoiceDTO {
    private Long id;
    private String invoiceNumber;
    private Long caseId;
    private String caseNumber;
    private String caseName;
    private BigDecimal amount;
    private BigDecimal amountPaid;
    private BigDecimal balanceDue;
    private String status; // DRAFT, SENT, PAID, OVERDUE, CANCELLED
    private LocalDate invoiceDate;
    private LocalDate dueDate;
    private String description;
    private boolean canPayOnline;
    private String paymentUrl;
}
