package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class InvoicePaymentDTO {
    private Long id;
    
    @NotNull(message = "Invoice ID is required")
    private Long invoiceId;
    
    @NotNull(message = "Payment date is required")
    private LocalDate paymentDate;
    
    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    private BigDecimal amount;
    
    @NotNull(message = "Payment method is required")
    private String paymentMethod;
    
    private String referenceNumber;
    private String notes;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Invoice info for display
    private String invoiceNumber;
    private String clientName;
}