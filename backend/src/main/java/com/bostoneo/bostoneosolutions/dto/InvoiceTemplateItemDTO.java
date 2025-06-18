package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceTemplateItemDTO {
    private Long id;
    private String description;
    private BigDecimal defaultQuantity;
    private BigDecimal defaultUnitPrice;
    private String category;
    private Boolean isOptional;
    private Integer sortOrder;
}