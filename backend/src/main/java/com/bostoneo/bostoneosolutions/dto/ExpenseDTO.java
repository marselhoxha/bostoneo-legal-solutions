package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class ExpenseDTO {
    private Long id;
    
    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    private BigDecimal amount;
    
    @NotNull(message = "Currency is required")
    private String currency;
    
    @NotNull(message = "Date is required")
    private LocalDateTime date;
    
    private String description;
    private BigDecimal tax;
    
    private Long customerId;
    private String customerName;
    
    private Long invoiceId;
    private String invoiceNumber;
    
    private Long legalCaseId;
    private String legalCaseNumber;
    
    private Long categoryId;
    private String categoryName;
    private String categoryColor;
    
    private Long vendorId;
    private String vendorName;
    
    private Long receiptId;
    private String receiptFileName;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 