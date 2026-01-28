package com.bostoneo.bostoneosolutions.validation;

import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.exception.InvoiceValidationException;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class InvoiceValidator {

    private final ClientRepository clientRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final TenantService tenantService;
    
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

        // SECURITY: Validate client belongs to current organization
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (orgId != null && invoice.getClientId() != null) {
            boolean clientExists = clientRepository.existsByIdAndOrganizationId(invoice.getClientId(), orgId);
            if (!clientExists) {
                log.error("SECURITY: Attempt to create invoice with client {} not belonging to org {}",
                        invoice.getClientId(), orgId);
                errors.add("Client not found or access denied");
            }
        }

        // SECURITY: Validate legal case belongs to current organization (if provided)
        if (orgId != null && invoice.getLegalCaseId() != null) {
            boolean caseExists = legalCaseRepository.existsByIdAndOrganizationId(invoice.getLegalCaseId(), orgId);
            if (!caseExists) {
                log.error("SECURITY: Attempt to create invoice with case {} not belonging to org {}",
                        invoice.getLegalCaseId(), orgId);
                errors.add("Legal case not found or access denied");
            }
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
     * Validate invoice for creation from time entries
     * This validation skips subtotal validation since it will be calculated from time entries
     */
    public void validateForCreateFromTimeEntries(Invoice invoice) {
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

        // SECURITY: Validate client belongs to current organization
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (orgId != null && invoice.getClientId() != null) {
            boolean clientExists = clientRepository.existsByIdAndOrganizationId(invoice.getClientId(), orgId);
            if (!clientExists) {
                log.error("SECURITY: Attempt to create invoice with client {} not belonging to org {}",
                        invoice.getClientId(), orgId);
                errors.add("Client not found or access denied");
            }
        }

        // SECURITY: Validate legal case belongs to current organization (if provided)
        if (orgId != null && invoice.getLegalCaseId() != null) {
            boolean caseExists = legalCaseRepository.existsByIdAndOrganizationId(invoice.getLegalCaseId(), orgId);
            if (!caseExists) {
                log.error("SECURITY: Attempt to create invoice with case {} not belonging to org {}",
                        invoice.getLegalCaseId(), orgId);
                errors.add("Legal case not found or access denied");
            }
        }

        // Date validation
        if (invoice.getIssueDate() != null && invoice.getDueDate() != null) {
            if (invoice.getDueDate().isBefore(invoice.getIssueDate())) {
                errors.add("Due date cannot be before issue date");
            }
        }

        // Tax rate validation (but skip subtotal validation)
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

        log.debug("Invoice validation passed for time entry creation - subtotal will be calculated from time entries");
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