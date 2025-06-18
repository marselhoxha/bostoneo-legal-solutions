package com.***REMOVED***.***REMOVED***solutions.validation;

import com.***REMOVED***.***REMOVED***solutions.enumeration.InvoiceStatus;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.exception.InvoiceValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
public class InvoiceValidator {
    
    /**
     * Validate invoice for creation
     */
    public void validateForCreate(Invoice invoice) {
        List<String> errors = new ArrayList<>();
        
        // Required fields
        if (invoice.getClientId() == null || invoice.getClientId() <= 0) {
            errors.add("Client ID is required");
        }
        
        if (invoice.getIssueDate() == null) {
            errors.add("Issue date is required");
        }
        
        if (invoice.getDueDate() == null) {
            errors.add("Due date is required");
        }
        
        // Date validation
        if (invoice.getIssueDate() != null && invoice.getDueDate() != null) {
            if (invoice.getDueDate().isBefore(invoice.getIssueDate())) {
                errors.add("Due date cannot be before issue date");
            }
        }
        
        // Amount validation
        if (invoice.getSubtotal() == null || invoice.getSubtotal().compareTo(BigDecimal.ZERO) < 0) {
            errors.add("Subtotal must be greater than or equal to zero");
        }
        
        if (invoice.getTaxRate() != null && 
            (invoice.getTaxRate().compareTo(BigDecimal.ZERO) < 0 || 
             invoice.getTaxRate().compareTo(new BigDecimal("100")) > 0)) {
            errors.add("Tax rate must be between 0 and 100");
        }
        
        // Status validation
        if (invoice.getStatus() == null) {
            invoice.setStatus(InvoiceStatus.DRAFT);
        }
        
        if (!errors.isEmpty()) {
            throw new InvoiceValidationException("Invoice validation failed", errors);
        }
        
        // Calculate amounts if not provided
        calculateInvoiceAmounts(invoice);
    }
    
    /**
     * Validate invoice for update
     */
    public void validateForUpdate(Invoice existingInvoice, Invoice updatedInvoice) {
        List<String> errors = new ArrayList<>();
        
        // Cannot update certain fields based on status
        if (existingInvoice.getStatus() == InvoiceStatus.PAID) {
            errors.add("Cannot update a paid invoice");
        }
        
        if (existingInvoice.getStatus() == InvoiceStatus.CANCELLED) {
            errors.add("Cannot update a cancelled invoice");
        }
        
        // Validate dates
        if (updatedInvoice.getIssueDate() != null && updatedInvoice.getDueDate() != null) {
            if (updatedInvoice.getDueDate().isBefore(updatedInvoice.getIssueDate())) {
                errors.add("Due date cannot be before issue date");
            }
        }
        
        // Validate amounts
        if (updatedInvoice.getSubtotal() != null && 
            updatedInvoice.getSubtotal().compareTo(BigDecimal.ZERO) < 0) {
            errors.add("Subtotal must be greater than or equal to zero");
        }
        
        if (updatedInvoice.getTaxRate() != null && 
            (updatedInvoice.getTaxRate().compareTo(BigDecimal.ZERO) < 0 || 
             updatedInvoice.getTaxRate().compareTo(new BigDecimal("100")) > 0)) {
            errors.add("Tax rate must be between 0 and 100");
        }
        
        if (!errors.isEmpty()) {
            throw new InvoiceValidationException("Invoice update validation failed", errors);
        }
        
        // Recalculate amounts
        calculateInvoiceAmounts(updatedInvoice);
    }
    
    /**
     * Validate status change
     */
    public void validateStatusChange(Invoice invoice, InvoiceStatus newStatus) {
        List<String> errors = new ArrayList<>();
        InvoiceStatus currentStatus = invoice.getStatus();
        
        // Define valid status transitions
        switch (currentStatus) {
            case DRAFT:
                if (newStatus != InvoiceStatus.ISSUED && 
                    newStatus != InvoiceStatus.CANCELLED) {
                    errors.add("Draft invoice can only be issued or cancelled");
                }
                break;
                
            case ISSUED:
            case PENDING:
                if (newStatus != InvoiceStatus.PAID && 
                    newStatus != InvoiceStatus.OVERDUE && 
                    newStatus != InvoiceStatus.CANCELLED) {
                    errors.add("Issued invoice can only be marked as paid, overdue, or cancelled");
                }
                break;
                
            case PAID:
                errors.add("Cannot change status of a paid invoice");
                break;
                
            case CANCELLED:
                errors.add("Cannot change status of a cancelled invoice");
                break;
                
            case OVERDUE:
                if (newStatus != InvoiceStatus.PAID && 
                    newStatus != InvoiceStatus.CANCELLED) {
                    errors.add("Overdue invoice can only be marked as paid or cancelled");
                }
                break;
        }
        
        // Additional validation for ISSUED status
        if (newStatus == InvoiceStatus.ISSUED) {
            if (invoice.getTimeEntries() == null || invoice.getTimeEntries().isEmpty()) {
                log.warn("Issuing invoice {} without any time entries", invoice.getInvoiceNumber());
            }
            
            if (invoice.getTotalAmount() == null || 
                invoice.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
                errors.add("Cannot issue invoice with zero or negative amount");
            }
        }
        
        if (!errors.isEmpty()) {
            throw new InvoiceValidationException("Invalid status change", errors);
        }
    }
    
    /**
     * Calculate invoice amounts based on subtotal and tax rate
     */
    private void calculateInvoiceAmounts(Invoice invoice) {
        BigDecimal subtotal = invoice.getSubtotal() != null ? invoice.getSubtotal() : BigDecimal.ZERO;
        BigDecimal taxRate = invoice.getTaxRate() != null ? invoice.getTaxRate() : BigDecimal.ZERO;
        
        // Calculate tax amount
        BigDecimal taxAmount = subtotal.multiply(taxRate).divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
        invoice.setTaxAmount(taxAmount);
        
        // Calculate total
        BigDecimal totalAmount = subtotal.add(taxAmount);
        invoice.setTotalAmount(totalAmount);
        
        log.debug("Calculated invoice amounts - Subtotal: {}, Tax: {}, Total: {}", 
                  subtotal, taxAmount, totalAmount);
    }
    
    /**
     * Check if invoice is overdue
     */
    public boolean isOverdue(Invoice invoice) {
        if (invoice.getStatus() == InvoiceStatus.PAID || 
            invoice.getStatus() == InvoiceStatus.CANCELLED) {
            return false;
        }
        
        return invoice.getDueDate() != null && 
               invoice.getDueDate().isBefore(LocalDate.now());
    }
}