package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class InvoiceAnalyticsDTO {
    private long paidInvoices;
    private long unpaidInvoices;
}
