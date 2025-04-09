package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.InvoiceAnalyticsDTO;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;

    // Total earnings from paid invoices
    public double calculateTotalEarnings() {
        List<Invoice> paidInvoices = invoiceRepository.findByStatus("PAID");
        return paidInvoices.stream().mapToDouble(Invoice::getTotal).sum();
    }

    // Count paid vs unpaid invoices
    public InvoiceAnalyticsDTO countPaidVsUnpaidInvoices() {
        long paidCount = invoiceRepository.countByStatus("PAID");

        // Count "PENDING" and "OVERDUE" statuses separately and sum them
        long pendingCount = invoiceRepository.countByStatus("PENDING");
        long overdueCount = invoiceRepository.countByStatus("OVERDUE");

        // Unpaid invoices are those that are either "PENDING" or "OVERDUE"
        long unpaidCount = pendingCount + overdueCount;

        return new InvoiceAnalyticsDTO(paidCount, unpaidCount);
    }


    // Count overdue invoices
    public long countOverdueInvoices() {
        Date today = new Date();
        return invoiceRepository.countByStatusAndDateBefore("OVERDUE", today);
    }
}

