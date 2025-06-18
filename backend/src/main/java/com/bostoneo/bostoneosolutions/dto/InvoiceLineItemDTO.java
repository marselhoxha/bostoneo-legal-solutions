package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceLineItemDTO {
    private Long id;
    private String description;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
    private BigDecimal amount;
    private Integer lineOrder;
    private String category;
    private LocalDate serviceDate;
}