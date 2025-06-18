package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.CustomHttpResponse;
import com.***REMOVED***.***REMOVED***solutions.enumeration.InvoiceStatus;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.TimeEntry;
import com.***REMOVED***.***REMOVED***solutions.service.implementation.InvoiceServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
@Slf4j
public class InvoiceController {

    private final InvoiceServiceImpl invoiceService;

    @PostMapping
    public ResponseEntity<CustomHttpResponse<Invoice>> createInvoice(@RequestBody Invoice invoice) {
        log.info("Creating new invoice for client ID: {}", invoice.getClientId());
        Invoice createdInvoice = invoiceService.createInvoice(invoice);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice created successfully", createdInvoice));
    }

    @GetMapping
    public ResponseEntity<CustomHttpResponse<Page<Invoice>>> getInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        
        log.info("Fetching all invoices with pagination - page: {}, size: {}", page, size);
        Page<Invoice> invoices = invoiceService.getInvoices(page, size, sortBy, sortDirection);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoices fetched successfully", invoices));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Invoice>> getInvoiceById(@PathVariable Long id) {
        log.info("Fetching invoice with ID: {}", id);
        Invoice invoice = invoiceService.getInvoiceById(id);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice fetched successfully", invoice));
    }

    @GetMapping("/number/{invoiceNumber}")
    public ResponseEntity<CustomHttpResponse<Invoice>> getInvoiceByNumber(@PathVariable String invoiceNumber) {
        log.info("Fetching invoice with number: {}", invoiceNumber);
        Invoice invoice = invoiceService.getInvoiceByNumber(invoiceNumber);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice fetched successfully", invoice));
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<CustomHttpResponse<Page<Invoice>>> getInvoicesByClient(
            @PathVariable Long clientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        log.info("Fetching invoices for client ID: {}", clientId);
        Page<Invoice> invoices = invoiceService.getInvoicesByClient(clientId, page, size);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoices fetched successfully", invoices));
    }

    @GetMapping("/case/{legalCaseId}")
    public ResponseEntity<CustomHttpResponse<Page<Invoice>>> getInvoicesByCase(
            @PathVariable Long legalCaseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        log.info("Fetching invoices for case ID: {}", legalCaseId);
        Page<Invoice> invoices = invoiceService.getInvoicesByCase(legalCaseId, page, size);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoices fetched successfully", invoices));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<CustomHttpResponse<Page<Invoice>>> getInvoicesByStatus(
            @PathVariable InvoiceStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        log.info("Fetching invoices with status: {}", status);
        Page<Invoice> invoices = invoiceService.getInvoicesByStatus(status, page, size);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoices fetched successfully", invoices));
    }

    @GetMapping("/filter")
    public ResponseEntity<CustomHttpResponse<Page<Invoice>>> getInvoicesByFilters(
            @RequestParam Long clientId,
            @RequestParam(required = false) Long legalCaseId,
            @RequestParam(required = false) InvoiceStatus status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Double minAmount,
            @RequestParam(required = false) Double maxAmount,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        log.info("Fetching invoices with filters - clientId: {}, caseId: {}, status: {}", 
                clientId, legalCaseId, status);
        
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        
        Page<Invoice> invoices = invoiceService.getInvoicesByFilters(
                clientId, legalCaseId, status, start, end, minAmount, maxAmount, page, size);
        
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoices fetched successfully", invoices));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Invoice>> updateInvoice(
            @PathVariable Long id, 
            @RequestBody Invoice invoiceDetails) {
        
        log.info("Updating invoice with ID: {}", id);
        Invoice updatedInvoice = invoiceService.updateInvoice(id, invoiceDetails);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice updated successfully", updatedInvoice));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<CustomHttpResponse<Invoice>> changeInvoiceStatus(
            @PathVariable Long id, 
            @RequestBody Map<String, String> statusUpdate) {
        
        String statusStr = statusUpdate.get("status");
        if (statusStr == null || statusStr.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    new CustomHttpResponse<>(400, "Status is required", null));
        }
        
        try {
            InvoiceStatus status = InvoiceStatus.valueOf(statusStr.toUpperCase());
            log.info("Changing status of invoice ID: {} to {}", id, status);
            Invoice updatedInvoice = invoiceService.changeInvoiceStatus(id, status);
            return ResponseEntity.ok(new CustomHttpResponse<>("Invoice status updated successfully", updatedInvoice));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(
                    new CustomHttpResponse<>(400, "Invalid status value", null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Void>> deleteInvoice(@PathVariable Long id) {
        log.info("Deleting invoice with ID: {}", id);
        invoiceService.deleteInvoice(id);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice deleted successfully", null));
    }

    @GetMapping("/unbilled-entries")
    public ResponseEntity<CustomHttpResponse<List<TimeEntry>>> getUnbilledTimeEntries(
            @RequestParam Long clientId,
            @RequestParam(required = false) Long legalCaseId) {
        
        log.info("Fetching unbilled time entries for client ID: {}, case ID: {}", clientId, legalCaseId);
        List<TimeEntry> entries = invoiceService.getUnbilledTimeEntries(clientId, legalCaseId);
        return ResponseEntity.ok(new CustomHttpResponse<>("Unbilled time entries fetched successfully", entries));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> generateInvoicePdf(@PathVariable Long id) {
        log.info("Generating PDF for invoice ID: {}", id);
        
        Invoice invoice = invoiceService.getInvoiceById(id);
        Resource pdfResource = invoiceService.generateInvoicePdf(id);
        
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                        "attachment; filename=\"Invoice-" + invoice.getInvoiceNumber() + ".pdf\"")
                .body(pdfResource);
    }

    @PostMapping("/{id}/send")
    public ResponseEntity<CustomHttpResponse<Void>> sendInvoiceByEmail(
            @PathVariable Long id,
            @RequestBody Map<String, String> emailDetails) {
        
        String to = emailDetails.get("to");
        if (to == null || to.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    new CustomHttpResponse<>(400, "Recipient email is required", null));
        }
        
        log.info("Sending invoice ID: {} by email to: {}", id, to);
        String subject = emailDetails.get("subject");
        String message = emailDetails.get("message");
        
        invoiceService.sendInvoiceByEmail(id, to, subject, message);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice sent successfully", null));
    }

    @GetMapping("/statistics")
    public ResponseEntity<CustomHttpResponse<Map<String, Object>>> getInvoiceStatistics() {
        log.info("Generating invoice statistics");
        Map<String, Object> statistics = invoiceService.getInvoiceStatistics();
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice statistics generated successfully", statistics));
    }
} 