package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.service.InvoiceService;
import com.bostoneo.bostoneosolutions.dto.InvoiceAnalyticsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
public class AnalyticsResource {

    private final InvoiceService invoiceService;

    @GetMapping("/total-earnings")
    public double getTotalEarnings() {
        return invoiceService.calculateTotalEarnings();
    }

    @GetMapping("/paid-vs-unpaid")
    public InvoiceAnalyticsDTO getPaidVsUnpaid() {
        return invoiceService.countPaidVsUnpaidInvoices();
    }

    @GetMapping("/overdue")
    public long getOverdueInvoices() {
        return invoiceService.countOverdueInvoices();
    }
}
