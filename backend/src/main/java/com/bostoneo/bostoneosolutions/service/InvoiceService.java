package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.InvoiceAnalyticsDTO;
import com.bostoneo.bostoneosolutions.dto.AgingReportDTO;
import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

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
    
    // Generate aging report
    public AgingReportDTO generateAgingReport() {
        List<Invoice> unpaidInvoices = invoiceRepository.findAll().stream()
                .filter(invoice -> invoice.getStatus() != InvoiceStatus.PAID && 
                                  invoice.getStatus() != InvoiceStatus.CANCELLED)
                .toList();
        
        AgingReportDTO report = new AgingReportDTO();
        report.setCurrent(BigDecimal.ZERO);
        report.setDays1To30(BigDecimal.ZERO);
        report.setDays31To60(BigDecimal.ZERO);
        report.setDays61To90(BigDecimal.ZERO);
        report.setOver90Days(BigDecimal.ZERO);
        report.setTotal(BigDecimal.ZERO);
        
        Map<String, List<Invoice>> invoicesByAging = new HashMap<>();
        invoicesByAging.put("current", new java.util.ArrayList<>());
        invoicesByAging.put("1-30", new java.util.ArrayList<>());
        invoicesByAging.put("31-60", new java.util.ArrayList<>());
        invoicesByAging.put("61-90", new java.util.ArrayList<>());
        invoicesByAging.put("90+", new java.util.ArrayList<>());
        
        LocalDate today = LocalDate.now();
        
        for (Invoice invoice : unpaidInvoices) {
            long daysPastDue = ChronoUnit.DAYS.between(invoice.getDueDate(), today);
            BigDecimal balanceDue = invoice.getBalanceDue() != null ? 
                invoice.getBalanceDue() : invoice.getTotalAmount();
            
            if (daysPastDue <= 0) {
                report.setCurrent(report.getCurrent().add(balanceDue));
                invoicesByAging.get("current").add(invoice);
            } else if (daysPastDue <= 30) {
                report.setDays1To30(report.getDays1To30().add(balanceDue));
                invoicesByAging.get("1-30").add(invoice);
            } else if (daysPastDue <= 60) {
                report.setDays31To60(report.getDays31To60().add(balanceDue));
                invoicesByAging.get("31-60").add(invoice);
            } else if (daysPastDue <= 90) {
                report.setDays61To90(report.getDays61To90().add(balanceDue));
                invoicesByAging.get("61-90").add(invoice);
            } else {
                report.setOver90Days(report.getOver90Days().add(balanceDue));
                invoicesByAging.get("90+").add(invoice);
            }
            
            report.setTotal(report.getTotal().add(balanceDue));
        }
        
        report.setInvoicesByAging(invoicesByAging);
        report.setGeneratedDate(LocalDate.now());
        
        return report;
    }
    
    // Collection efficiency metrics
    public Map<String, Object> getCollectionEfficiencyMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        List<Invoice> allInvoices = invoiceRepository.findAll();
        List<Invoice> paidInvoices = allInvoices.stream()
                .filter(inv -> inv.getStatus() == InvoiceStatus.PAID)
                .toList();
        
        // Collection rate
        double totalBilled = allInvoices.stream()
                .mapToDouble(inv -> inv.getTotalAmount().doubleValue())
                .sum();
        double totalCollected = paidInvoices.stream()
                .mapToDouble(inv -> inv.getTotalPaid() != null ? 
                    inv.getTotalPaid().doubleValue() : 0)
                .sum();
        
        double collectionRate = totalBilled > 0 ? 
            (totalCollected / totalBilled) * 100 : 0;
        
        // Average days to payment
        double avgDaysToPayment = paidInvoices.stream()
                .filter(inv -> inv.getIssueDate() != null)
                .mapToLong(inv -> {
                    LocalDate paidDate = inv.getUpdatedAt().toLocalDate();
                    return ChronoUnit.DAYS.between(inv.getIssueDate(), paidDate);
                })
                .average()
                .orElse(0);
        
        // Write-off rate
        long cancelledCount = invoiceRepository.countByStatus(InvoiceStatus.CANCELLED);
        double writeOffRate = allInvoices.size() > 0 ? 
            ((double) cancelledCount / allInvoices.size()) * 100 : 0;
        
        metrics.put("collectionRate", collectionRate);
        metrics.put("averageDaysToPayment", avgDaysToPayment);
        metrics.put("writeOffRate", writeOffRate);
        metrics.put("totalOutstanding", totalBilled - totalCollected);
        
        return metrics;
    }
}

