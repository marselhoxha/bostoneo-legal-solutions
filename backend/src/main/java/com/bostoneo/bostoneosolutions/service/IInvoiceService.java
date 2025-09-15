package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.TimeEntry;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface IInvoiceService {
    
    // CRUD Operations
    Invoice createInvoice(Invoice invoice);
    Invoice createInvoiceFromTimeEntries(Invoice invoice, List<Long> timeEntryIds);
    Invoice getInvoiceById(Long id);
    Invoice getInvoiceByNumber(String invoiceNumber);
    Invoice updateInvoice(Long id, Invoice invoiceDetails);
    void deleteInvoice(Long id);
    
    // Status Management
    Invoice changeInvoiceStatus(Long id, InvoiceStatus newStatus);
    
    // Query Operations
    Page<Invoice> getInvoices(int page, int size, String sortBy, String sortDirection);
    Page<Invoice> getInvoicesByClient(Long clientId, int page, int size);
    Page<Invoice> getInvoicesByCase(Long caseId, int page, int size);
    Page<Invoice> getInvoicesByStatus(InvoiceStatus status, int page, int size);
    Page<Invoice> getInvoicesByFilters(Long clientId, Long caseId, InvoiceStatus status,
            LocalDate startDate, LocalDate endDate, Double minAmount, Double maxAmount, int page, int size);
    
    // Time Entry Integration
    List<TimeEntry> getUnbilledTimeEntries(Long clientId, Long caseId);
    
    // PDF Generation
    Resource generateInvoicePdf(Long id);
    
    // Email Operations
    void sendInvoiceByEmail(Long id, String recipientEmail, String subject, String message);
    
    // Statistics and Analytics
    Map<String, Object> getInvoiceStatistics();
} 