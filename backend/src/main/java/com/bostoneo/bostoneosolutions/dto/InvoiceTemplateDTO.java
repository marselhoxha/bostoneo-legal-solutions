package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceTemplateDTO {
    private Long id;
    private String name;
    private String description;
    private Boolean isActive;
    private Boolean isDefault;
    
    // Template settings
    private BigDecimal taxRate;
    private Integer paymentTerms;
    private String currencyCode;
    
    // Template content
    private String headerText;
    private String footerText;
    private String notesTemplate;
    private String termsAndConditions;
    
    // Styling options
    private String logoPosition;
    private String primaryColor;
    private String secondaryColor;
    private String fontFamily;
    
    // Related data
    private List<InvoiceTemplateItemDTO> templateItems = new ArrayList<>();
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}