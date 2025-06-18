package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.InvoiceAnalyticsDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.InvoiceStatus;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
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
        return invoiceRepository.findAll().stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.PAID)
                .mapToDouble(invoice -> invoice.getTotalAmount().doubleValue())
                .sum();
    }

    // Count paid vs unpaid invoices
    public InvoiceAnalyticsDTO countPaidVsUnpaidInvoices() {
        long paidCount = invoiceRepository.countByStatus(InvoiceStatus.PAID);

        // Count "PENDING" and "OVERDUE" statuses separately and sum them
        long pendingCount = invoiceRepository.countByStatus(InvoiceStatus.PENDING);
        long overdueCount = invoiceRepository.countByStatus(InvoiceStatus.OVERDUE);

        // Unpaid invoices are those that are either "PENDING" or "OVERDUE"
        long unpaidCount = pendingCount + overdueCount;

        return new InvoiceAnalyticsDTO(paidCount, unpaidCount);
    }


    // Count overdue invoices
    public long countOverdueInvoices() {
        return invoiceRepository.countByStatus(InvoiceStatus.OVERDUE);
    }
}

