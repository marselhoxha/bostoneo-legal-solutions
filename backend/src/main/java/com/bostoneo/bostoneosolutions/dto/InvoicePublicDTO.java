package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoicePublicDTO {
    private Long id;
    private String invoiceNumber;
    private Date date;
    private Double total;
    private String status;
} 