package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.enumeration.TimeEntryStatus;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.TimeEntry;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.repository.TimeEntryRepository;
import com.bostoneo.bostoneosolutions.validation.InvoiceValidator;
import com.bostoneo.bostoneosolutions.exception.InvoiceValidationException;
import com.bostoneo.bostoneosolutions.service.InvoiceWorkflowService;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.IInvoiceService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.InvoiceLineItem;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// iText imports
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.properties.VerticalAlignment;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InvoiceServiceImpl implements IInvoiceService {
    
    private final InvoiceRepository invoiceRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final InvoiceValidator invoiceValidator;
    private final InvoiceWorkflowService workflowService;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final ClientRepository clientRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @AuditLog(action = "CREATE", entityType = "INVOICE", description = "Created new invoice", includeResult = true)
    public Invoice createInvoice(Invoice invoice) {
        log.info("Creating new invoice for client ID: {}", invoice.getClientId());

        // Ensure organization ID is set for tenant isolation
        if (invoice.getOrganizationId() == null) {
            invoice.setOrganizationId(getRequiredOrganizationId());
        }

        // Validate invoice
        invoiceValidator.validateForCreate(invoice);
        
        // Set default status if not provided
        if (invoice.getStatus() == null) {
            invoice.setStatus(InvoiceStatus.DRAFT);
        }
        
        // Generate invoice number if not provided
        if (invoice.getInvoiceNumber() == null || invoice.getInvoiceNumber().isEmpty()) {
            invoice.setInvoiceNumber(generateInvoiceNumber());
        }
        
        // Process line items
        if (invoice.getLineItems() != null && !invoice.getLineItems().isEmpty()) {
            for (int i = 0; i < invoice.getLineItems().size(); i++) {
                var lineItem = invoice.getLineItems().get(i);
                lineItem.setInvoice(invoice);
                lineItem.setOrganizationId(invoice.getOrganizationId());
                lineItem.setLineOrder(i);
                if (lineItem.getAmount() == null && lineItem.getUnitPrice() != null && lineItem.getQuantity() != null) {
                    lineItem.setAmount(lineItem.getUnitPrice().multiply(lineItem.getQuantity()));
                }
            }
            
            // Calculate totals from line items
            BigDecimal subtotal = invoice.getLineItems().stream()
                .map(item -> item.getAmount() != null ? item.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            invoice.setSubtotal(subtotal);
            
            BigDecimal taxAmount = subtotal.multiply(invoice.getTaxRate() != null ? invoice.getTaxRate() : BigDecimal.ZERO)
                .divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
            invoice.setTaxAmount(taxAmount);
            invoice.setTotalAmount(subtotal.add(taxAmount));
        }
        
        Invoice savedInvoice = invoiceRepository.save(invoice);
        
        // Flush to ensure the invoice is immediately committed to the database
        invoiceRepository.flush();
        
        log.info("Invoice created successfully with ID: {} and number: {}", 
                savedInvoice.getId(), savedInvoice.getInvoiceNumber());
        
        // Send invoice creation notifications
        try {
            String title = "New Invoice Created";
            String message = String.format("Invoice %s has been created with total amount $%.2f", 
                savedInvoice.getInvoiceNumber(), savedInvoice.getTotalAmount());
            
            Set<Long> notificationUserIds = new HashSet<>();
            
            // SECURITY: Get users assigned to the case if this invoice is related to a case (with org filter)
            if (savedInvoice.getLegalCaseId() != null && savedInvoice.getOrganizationId() != null) {
                List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(savedInvoice.getLegalCaseId(), savedInvoice.getOrganizationId());
                for (CaseAssignment assignment : caseAssignments) {
                    if (assignment.getAssignedTo() != null) {
                        notificationUserIds.add(assignment.getAssignedTo().getId());
                    }
                }
            }
            
            // Notify the client user if they have a linked user account
            // SECURITY: Use tenant-filtered query
            if (savedInvoice.getClientId() != null && savedInvoice.getOrganizationId() != null) {
                clientRepository.findByIdAndOrganizationId(savedInvoice.getClientId(), savedInvoice.getOrganizationId()).ifPresent(client -> {
                    if (client.getUserId() != null) {
                        String clientTitle = "New Invoice Available";
                        String clientMessage = String.format("A new invoice %s for $%.2f is ready for your review",
                            savedInvoice.getInvoiceNumber(), savedInvoice.getTotalAmount());
                        notificationService.sendCrmNotification(clientTitle, clientMessage, client.getUserId(),
                            "INVOICE_CREATED", Map.of("invoiceId", savedInvoice.getId(),
                                                     "invoiceNumber", savedInvoice.getInvoiceNumber()));
                        log.info("Invoice notification sent to client user {}", client.getUserId());
                    }
                });
            }

            // Notify case assignees (attorneys, paralegals, etc.)
            for (Long userId : notificationUserIds) {
                notificationService.sendCrmNotification(title, message, userId, 
                    "INVOICE_CREATED", Map.of("invoiceId", savedInvoice.getId(), 
                                             "invoiceNumber", savedInvoice.getInvoiceNumber(),
                                             "caseId", savedInvoice.getLegalCaseId() != null ? savedInvoice.getLegalCaseId() : 0));
            }
            
            log.info("Invoice creation notifications sent to {} users", notificationUserIds.size());
        } catch (Exception e) {
            log.error("Failed to send invoice creation notifications: {}", e.getMessage());
        }
        
        // Trigger workflows for invoice creation (non-transactional)
        triggerWorkflowsAsync(savedInvoice, 
                com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule.TriggerEvent.CREATED, null);
        
        return savedInvoice;
    }
    
    
    @AuditLog(action = "CREATE", entityType = "INVOICE", description = "Created invoice from time entries", includeResult = true)
    public Invoice createInvoiceFromTimeEntries(Invoice invoice, List<Long> timeEntryIds) {
        log.info("Creating invoice from {} time entries for client ID: {}", timeEntryIds.size(), invoice.getClientId());
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Set organization ID for tenant isolation
        invoice.setOrganizationId(orgId);

        // Validate invoice
        invoiceValidator.validateForCreateFromTimeEntries(invoice);

        // Fetch time entries
        List<TimeEntry> timeEntries = new ArrayList<>();
        List<Long> failedTimeEntryIds = new ArrayList<>();

        for (Long timeEntryId : timeEntryIds) {
            try {
                // SECURITY: Use tenant-filtered query
                TimeEntry timeEntry = timeEntryRepository.findByIdAndOrganizationId(timeEntryId, orgId)
                    .orElseThrow(() -> new RuntimeException("Time entry not found or access denied: " + timeEntryId));
                
                // Validate time entry can be invoiced
                if (timeEntry.getInvoiceId() != null) {
                    log.warn("Time entry {} is already invoiced", timeEntryId);
                    failedTimeEntryIds.add(timeEntryId);
                    continue;
                }
                
                if (timeEntry.getBillable() == null || !timeEntry.getBillable()) {
                    log.warn("Time entry {} is not billable", timeEntryId);
                    failedTimeEntryIds.add(timeEntryId);
                    continue;
                }
                
                timeEntries.add(timeEntry);
            } catch (Exception e) {
                log.error("Failed to fetch time entry {}: {}", timeEntryId, e.getMessage());
                failedTimeEntryIds.add(timeEntryId);
            }
        }
        
        if (timeEntries.isEmpty()) {
            throw new RuntimeException("No valid time entries found to create invoice");
        }
        
        // Set default status if not provided
        if (invoice.getStatus() == null) {
            invoice.setStatus(InvoiceStatus.DRAFT);
        }
        
        // Generate invoice number if not provided
        if (invoice.getInvoiceNumber() == null || invoice.getInvoiceNumber().isEmpty()) {
            invoice.setInvoiceNumber(generateInvoiceNumber());
        }
        
        // Convert time entries to invoice line items
        List<InvoiceLineItem> lineItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        
        log.info("Converting {} time entries to line items", timeEntries.size());
        
        for (int i = 0; i < timeEntries.size(); i++) {
            TimeEntry timeEntry = timeEntries.get(i);
            
            InvoiceLineItem lineItem = new InvoiceLineItem();
            lineItem.setOrganizationId(orgId);
            lineItem.setDescription(timeEntry.getDescription());
            lineItem.setQuantity(timeEntry.getHours());
            lineItem.setUnitPrice(timeEntry.getRate());
            lineItem.setAmount(timeEntry.getHours().multiply(timeEntry.getRate()));
            lineItem.setLineOrder(i);
            lineItem.setServiceDate(timeEntry.getDate());
            lineItem.setCategory("Legal Services");
            
            lineItems.add(lineItem);
            subtotal = subtotal.add(lineItem.getAmount());
            
            log.debug("Created line item {} for time entry {}: {} - {} hours @ ${}/hr = ${}", 
                     i, timeEntry.getId(), timeEntry.getDescription(), 
                     timeEntry.getHours(), timeEntry.getRate(), lineItem.getAmount());
        }
        
        invoice.setLineItems(lineItems);
        invoice.setSubtotal(subtotal);
        
        log.info("Created {} line items with total subtotal: ${}", lineItems.size(), subtotal);
        
        // Calculate tax
        BigDecimal taxAmount = subtotal.multiply(invoice.getTaxRate() != null ? invoice.getTaxRate() : BigDecimal.ZERO)
            .divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
        invoice.setTaxAmount(taxAmount);
        invoice.setTotalAmount(subtotal.add(taxAmount));
        
        // Save the invoice with line items
        // Important: Set the bidirectional relationship before saving
        for (InvoiceLineItem lineItem : invoice.getLineItems()) {
            lineItem.setInvoice(invoice);
        }
        
        Invoice savedInvoice = invoiceRepository.save(invoice);
        invoiceRepository.flush();
        
        // Verify line items were saved
        // SECURITY: Use tenant-filtered query
        Invoice verifyInvoice = invoiceRepository.findByIdWithLineItemsAndOrganizationId(savedInvoice.getId(), orgId)
            .orElseThrow(() -> new RuntimeException("Failed to verify saved invoice"));
        
        log.info("Invoice created successfully with ID: {} and number: {} from {} time entries", 
                savedInvoice.getId(), savedInvoice.getInvoiceNumber(), timeEntries.size());
        log.info("Verified saved invoice has {} line items", verifyInvoice.getLineItems().size());
        
        // Update time entries to mark them as invoiced
        List<Long> updatedTimeEntryIds = new ArrayList<>();
        for (TimeEntry timeEntry : timeEntries) {
            try {
                timeEntry.setInvoiceId(savedInvoice.getId());
                timeEntry.setStatus(TimeEntryStatus.INVOICED);
                timeEntry.setBilledAmount(timeEntry.getHours().multiply(timeEntry.getRate()));
                timeEntryRepository.save(timeEntry);
                updatedTimeEntryIds.add(timeEntry.getId());
            } catch (Exception e) {
                log.error("Failed to update time entry {} with invoice ID {}: {}", 
                         timeEntry.getId(), savedInvoice.getId(), e.getMessage());
                failedTimeEntryIds.add(timeEntry.getId());
            }
        }
        
        log.info("Updated {} time entries with invoice ID {}. Failed to update {} time entries.", 
                updatedTimeEntryIds.size(), savedInvoice.getId(), failedTimeEntryIds.size());
        
        // If some time entries failed to update, log a warning but don't fail the invoice creation
        if (!failedTimeEntryIds.isEmpty()) {
            log.warn("Invoice created successfully, but failed to update time entries: {}", failedTimeEntryIds);
        }
        
        // Trigger workflows for invoice creation (non-transactional)
        triggerWorkflowsAsync(savedInvoice, 
                com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule.TriggerEvent.CREATED, null);
        
        return savedInvoice;
    }

    private String generateInvoiceNumber() {
        // Get the current year
        int year = LocalDate.now().getYear();
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Find the last invoice number for this year WITHIN THE ORGANIZATION
        List<Invoice> recentInvoices = invoiceRepository.findTop1ByOrganizationIdAndInvoiceNumberStartingWithOrderByIdDesc(orgId, "INV-" + year);

        long nextNumber = 1;
        if (!recentInvoices.isEmpty()) {
            String lastNumber = recentInvoices.get(0).getInvoiceNumber();
            // Extract the sequential number from format INV-YYYY-NNNN
            String[] parts = lastNumber.split("-");
            if (parts.length == 3) {
                try {
                    nextNumber = Long.parseLong(parts[2]) + 1;
                } catch (NumberFormatException e) {
                    log.warn("Could not parse invoice number: {}", lastNumber);
                }
            }
        }

        return String.format("INV-%d-%04d", year, nextNumber);
    }
    
    public Invoice getInvoiceById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return invoiceRepository.findByIdWithLineItemsAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Invoice not found or access denied: " + id));
    }

    public Invoice getInvoiceByNumber(String invoiceNumber) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return invoiceRepository.findByInvoiceNumberAndOrganizationId(invoiceNumber, orgId)
            .orElseThrow(() -> new RuntimeException("Invoice not found or access denied: " + invoiceNumber));
    }

    private Invoice getInvoiceWithLineItems(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return invoiceRepository.findByIdWithLineItemsAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Invoice not found or access denied: " + id));
    }
    
    public Page<Invoice> getInvoices(int page, int size, String sortBy, String sortDirection) {
        Sort sort = sortDirection.equalsIgnoreCase("ASC") ?
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> invoiceRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    public Page<Invoice> getInvoicesByClient(Long clientId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> invoiceRepository.findByOrganizationIdAndClientId(orgId, clientId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    public Page<Invoice> getInvoicesByCase(Long caseId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> invoiceRepository.findByOrganizationIdAndLegalCaseId(orgId, caseId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    public Page<Invoice> getInvoicesByStatus(InvoiceStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> invoiceRepository.findByOrganizationIdAndStatus(orgId, status, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }
    
    public Page<Invoice> getInvoicesByFilters(Long clientId, Long caseId, InvoiceStatus status,
            LocalDate startDate, LocalDate endDate, Double minAmount, Double maxAmount, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        log.info("Getting invoices with filters - clientId: {}, caseId: {}, status: {}, startDate: {}, endDate: {}, minAmount: {}, maxAmount: {}",
                clientId, caseId, status, startDate, endDate, minAmount, maxAmount);

        // Use tenant-filtered query - throw exception if no organization context
        Long orgId = tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));

        return invoiceRepository.findByOrganizationIdAndFilters(
                orgId,
                clientId,
                caseId,
                status,
                startDate,
                endDate,
                minAmount,
                maxAmount,
                pageable);
    }
    
    @AuditLog(action = "UPDATE", entityType = "INVOICE", description = "Updated invoice", includeResult = true)
    public Invoice updateInvoice(Long id, Invoice invoiceDetails) {
        log.info("Updating invoice with ID: {}", id);
        
        Invoice existingInvoice = getInvoiceById(id);
        
        // Validate the update
        invoiceValidator.validateForUpdate(existingInvoice, invoiceDetails);
        
        // Update fields
        existingInvoice.setClientId(invoiceDetails.getClientId());
        existingInvoice.setClientName(invoiceDetails.getClientName());
        existingInvoice.setLegalCaseId(invoiceDetails.getLegalCaseId());
        existingInvoice.setCaseName(invoiceDetails.getCaseName());
        existingInvoice.setIssueDate(invoiceDetails.getIssueDate());
        existingInvoice.setDueDate(invoiceDetails.getDueDate());
        existingInvoice.setSubtotal(invoiceDetails.getSubtotal());
        existingInvoice.setTaxRate(invoiceDetails.getTaxRate());
        existingInvoice.setTaxAmount(invoiceDetails.getTaxAmount());
        existingInvoice.setTotalAmount(invoiceDetails.getTotalAmount());
        existingInvoice.setNotes(invoiceDetails.getNotes());
        
        // Only update status if provided and different
        InvoiceStatus oldStatus = existingInvoice.getStatus();
        if (invoiceDetails.getStatus() != null && 
            !existingInvoice.getStatus().equals(invoiceDetails.getStatus())) {
            invoiceValidator.validateStatusChange(existingInvoice, invoiceDetails.getStatus());
            existingInvoice.setStatus(invoiceDetails.getStatus());
        }
        
        Invoice updatedInvoice = invoiceRepository.save(existingInvoice);
        log.info("Invoice updated successfully: {}", updatedInvoice.getInvoiceNumber());
        
        // Trigger workflows if status changed (non-transactional)
        if (!oldStatus.equals(updatedInvoice.getStatus())) {
            triggerWorkflowsAsync(updatedInvoice, 
                    com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule.TriggerEvent.STATUS_CHANGED, 
                    oldStatus.toString());
        }
        
        return updatedInvoice;
    }
    
    @AuditLog(action = "UPDATE_STATUS", entityType = "INVOICE", description = "Changed invoice status", includeResult = true)
    public Invoice changeInvoiceStatus(Long id, InvoiceStatus newStatus) {
        log.info("Changing status of invoice {} to {}", id, newStatus);
        
        Invoice invoice = getInvoiceById(id);
        
        // Validate status change
        invoiceValidator.validateStatusChange(invoice, newStatus);
        
        InvoiceStatus oldStatus = invoice.getStatus();
        invoice.setStatus(newStatus);
        
        // Check for overdue invoices when changing to ISSUED/PENDING
        if ((newStatus == InvoiceStatus.ISSUED || newStatus == InvoiceStatus.PENDING) && 
            invoiceValidator.isOverdue(invoice)) {
            invoice.setStatus(InvoiceStatus.OVERDUE);
            log.warn("Invoice {} is overdue, setting status to OVERDUE", invoice.getInvoiceNumber());
        }
        
        Invoice updatedInvoice = invoiceRepository.save(invoice);
        log.info("Invoice {} status changed from {} to {}", 
                invoice.getInvoiceNumber(), oldStatus, updatedInvoice.getStatus());
        
        // Trigger workflows for status change (non-transactional)
        triggerWorkflowsAsync(updatedInvoice, 
                com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule.TriggerEvent.STATUS_CHANGED, 
                oldStatus.toString());
        
        return updatedInvoice;
    }
    
    @AuditLog(action = "DELETE", entityType = "INVOICE", description = "Deleted invoice")
    public void deleteInvoice(Long id) {
        log.info("Deleting invoice with ID: {}", id);
        
        Invoice invoice = getInvoiceById(id);
        
        // Only allow deletion of DRAFT or CANCELLED invoices
        if (invoice.getStatus() != InvoiceStatus.DRAFT && 
            invoice.getStatus() != InvoiceStatus.CANCELLED) {
            throw new InvoiceValidationException(
                "Cannot delete invoice with status: " + invoice.getStatus() + 
                ". Only DRAFT or CANCELLED invoices can be deleted.");
        }
        
        // Remove associations with time entries
        if (invoice.getTimeEntries() != null && !invoice.getTimeEntries().isEmpty()) {
            for (TimeEntry timeEntry : invoice.getTimeEntries()) {
                timeEntry.setInvoiceId(null);
                timeEntry.setStatus(TimeEntryStatus.APPROVED);
                timeEntryRepository.save(timeEntry);
            }
        }
        
        invoiceRepository.deleteById(id);
        log.info("Invoice {} deleted successfully", invoice.getInvoiceNumber());
    }
    
    public List<TimeEntry> getUnbilledTimeEntries(Long clientId, Long caseId) {
        Long orgId = getRequiredOrganizationId();

        if (caseId != null) {
            // SECURITY: Use tenant-filtered queries
            List<TimeEntry> approvedEntries = timeEntryRepository.findByOrganizationIdAndLegalCaseIdAndStatusAndInvoiceIdIsNull(
                    orgId, caseId, TimeEntryStatus.APPROVED);
            List<TimeEntry> billingApprovedEntries = timeEntryRepository.findByOrganizationIdAndLegalCaseIdAndStatusAndInvoiceIdIsNull(
                    orgId, caseId, TimeEntryStatus.BILLING_APPROVED);

            // Combine both lists
            List<TimeEntry> allUnbilledEntries = new ArrayList<>();
            allUnbilledEntries.addAll(approvedEntries);
            allUnbilledEntries.addAll(billingApprovedEntries);

            log.info("Found {} unbilled entries for case {}: {} APPROVED, {} BILLING_APPROVED",
                    allUnbilledEntries.size(), caseId, approvedEntries.size(), billingApprovedEntries.size());

            return allUnbilledEntries;
        }

        // If no specific case ID, get entries for all cases of the client (within org)
        if (clientId != null) {
            log.info("Getting unbilled entries for all cases of client: {}", clientId);

            // SECURITY: Use tenant-filtered query to get all unbilled entries for client
            List<TimeEntry> approvedEntries = timeEntryRepository.findUnbilledByOrganizationIdAndClientId(
                    orgId, clientId, TimeEntryStatus.APPROVED);
            List<TimeEntry> billingApprovedEntries = timeEntryRepository.findUnbilledByOrganizationIdAndClientId(
                    orgId, clientId, TimeEntryStatus.BILLING_APPROVED);

            List<TimeEntry> allUnbilledEntries = new ArrayList<>();
            allUnbilledEntries.addAll(approvedEntries);
            allUnbilledEntries.addAll(billingApprovedEntries);

            log.info("Found {} total unbilled entries for client {} in org {}",
                    allUnbilledEntries.size(), clientId, orgId);

            return allUnbilledEntries;
        }

        log.warn("Both clientId and caseId are null - cannot retrieve unbilled entries");
        return List.of();
    }
    
    public Resource generateInvoicePdf(Long id) {
        Invoice invoice = getInvoiceById(id);
        if (invoice == null) {
            throw new RuntimeException("Invoice not found");
        }
        
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);
            
            // Set up fonts
            PdfFont regularFont = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont boldFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont titleFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            
            // Colors
            DeviceRgb primaryColor = new DeviceRgb(13, 110, 253); // Bootstrap primary blue
            DeviceRgb darkGray = new DeviceRgb(73, 80, 87);
            DeviceRgb lightGray = new DeviceRgb(248, 249, 250);
            
            // Company Header
            Table headerTable = new Table(UnitValue.createPercentArray(new float[]{60f, 40f})).useAllAvailableWidth();
            
            // Left side - Company Info
            Cell companyCell = new Cell();
            companyCell.setBorder(Border.NO_BORDER);
            companyCell.add(new Paragraph("BOSTONEO SOLUTIONS")
                    .setFont(titleFont)
                    .setFontSize(24)
                    .setFontColor(primaryColor)
                    .setMarginBottom(10));
            companyCell.add(new Paragraph("Bostoneo Solutions LLC").setFont(regularFont).setFontSize(10));
            companyCell.add(new Paragraph("68 Harrison Ave, Boston MA").setFont(regularFont).setFontSize(10));
            companyCell.add(new Paragraph("Phone: (123) 456-7890").setFont(regularFont).setFontSize(10));
            companyCell.add(new Paragraph("Email: info@bostoneo.com").setFont(regularFont).setFontSize(10));
            headerTable.addCell(companyCell);
            
            // Right side - Invoice Info
            Cell invoiceInfoCell = new Cell();
            invoiceInfoCell.setBorder(Border.NO_BORDER);
            invoiceInfoCell.setTextAlignment(TextAlignment.RIGHT);
            invoiceInfoCell.add(new Paragraph("INVOICE")
                    .setFont(titleFont)
                    .setFontSize(28)
                    .setFontColor(primaryColor)
                    .setMarginBottom(15));
            invoiceInfoCell.add(new Paragraph("Invoice #: " + invoice.getInvoiceNumber())
                    .setFont(boldFont).setFontSize(11));
            invoiceInfoCell.add(new Paragraph("Issue Date: " + invoice.getIssueDate())
                    .setFont(regularFont).setFontSize(10));
            invoiceInfoCell.add(new Paragraph("Due Date: " + invoice.getDueDate())
                    .setFont(regularFont).setFontSize(10));
            invoiceInfoCell.add(new Paragraph("Status: " + invoice.getStatus())
                    .setFont(boldFont).setFontSize(10)
                    .setFontColor(getStatusColor(invoice.getStatus())));
            headerTable.addCell(invoiceInfoCell);
            
            document.add(headerTable);
            document.add(new Paragraph("\n"));
            
            // Bill To Section
            Table billToTable = new Table(UnitValue.createPercentArray(new float[]{50f, 50f})).useAllAvailableWidth();
            
            Cell billToCell = new Cell();
            billToCell.setBorder(Border.NO_BORDER);
            billToCell.add(new Paragraph("BILL TO:")
                    .setFont(boldFont)
                    .setFontSize(12)
                    .setFontColor(darkGray)
                    .setMarginBottom(5));
            billToCell.add(new Paragraph(invoice.getClientName() != null ? invoice.getClientName() : "N/A")
                    .setFont(boldFont).setFontSize(14));
            billToTable.addCell(billToCell);
            
            Cell caseCell = new Cell();
            caseCell.setBorder(Border.NO_BORDER);
            caseCell.add(new Paragraph("CASE DETAILS:")
                    .setFont(boldFont)
                    .setFontSize(12)
                    .setFontColor(darkGray)
                    .setMarginBottom(5));
            if (invoice.getCaseName() != null && !invoice.getCaseName().isEmpty()) {
                caseCell.add(new Paragraph("Case: " + invoice.getCaseName()).setFont(regularFont).setFontSize(10));
            } else {
                caseCell.add(new Paragraph("No case assigned").setFont(regularFont).setFontSize(10));
            }
            billToTable.addCell(caseCell);
            
            document.add(billToTable);
            document.add(new Paragraph("\n"));
            
            // Items Table
            Table itemsTable = new Table(UnitValue.createPercentArray(new float[]{50f, 15f, 17.5f, 17.5f})).useAllAvailableWidth();
            
            // Header
            itemsTable.addHeaderCell(new Cell().add(new Paragraph("Description").setFont(boldFont).setFontSize(11))
                    .setBackgroundColor(lightGray).setPadding(10));
            itemsTable.addHeaderCell(new Cell().add(new Paragraph("Qty").setFont(boldFont).setFontSize(11))
                    .setBackgroundColor(lightGray).setPadding(10).setTextAlignment(TextAlignment.RIGHT));
            itemsTable.addHeaderCell(new Cell().add(new Paragraph("Rate").setFont(boldFont).setFontSize(11))
                    .setBackgroundColor(lightGray).setPadding(10).setTextAlignment(TextAlignment.RIGHT));
            itemsTable.addHeaderCell(new Cell().add(new Paragraph("Amount").setFont(boldFont).setFontSize(11))
                    .setBackgroundColor(lightGray).setPadding(10).setTextAlignment(TextAlignment.RIGHT));
            
            // Add line items or default item
            log.info("Generating PDF for invoice {}: Found {} line items", invoice.getId(), 
                    invoice.getLineItems() != null ? invoice.getLineItems().size() : 0);
            if (invoice.getLineItems() != null && !invoice.getLineItems().isEmpty()) {
                log.info("Adding {} line items to PDF", invoice.getLineItems().size());
                for (InvoiceLineItem item : invoice.getLineItems()) {
                    log.info("Adding line item: {}", item.getDescription());
                    itemsTable.addCell(new Cell().add(new Paragraph(item.getDescription()).setFont(regularFont).setFontSize(10)).setPadding(10));
                    itemsTable.addCell(new Cell().add(new Paragraph(String.format("%.2f", item.getQuantity())).setFont(regularFont).setFontSize(10))
                            .setPadding(10).setTextAlignment(TextAlignment.RIGHT));
                    itemsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", item.getUnitPrice())).setFont(regularFont).setFontSize(10))
                            .setPadding(10).setTextAlignment(TextAlignment.RIGHT));
                    itemsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", item.getAmount())).setFont(regularFont).setFontSize(10))
                            .setPadding(10).setTextAlignment(TextAlignment.RIGHT));
                }
            } else {
                log.warn("No line items found for invoice {}, using default 'Legal Services' entry", invoice.getId());
                String description = "Legal Services";
                if (invoice.getNotes() != null && !invoice.getNotes().isEmpty()) {
                    description += " - " + invoice.getNotes();
                }
                itemsTable.addCell(new Cell().add(new Paragraph(description).setFont(regularFont).setFontSize(10)).setPadding(10));
                itemsTable.addCell(new Cell().add(new Paragraph("1").setFont(regularFont).setFontSize(10))
                        .setPadding(10).setTextAlignment(TextAlignment.RIGHT));
                itemsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", invoice.getSubtotal())).setFont(regularFont).setFontSize(10))
                        .setPadding(10).setTextAlignment(TextAlignment.RIGHT));
                itemsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", invoice.getSubtotal())).setFont(regularFont).setFontSize(10))
                        .setPadding(10).setTextAlignment(TextAlignment.RIGHT));
            }
            
            document.add(itemsTable);
            document.add(new Paragraph("\n"));
            
            // Totals Section
            Table totalsSection = new Table(UnitValue.createPercentArray(new float[]{60f, 40f})).useAllAvailableWidth();
            
            // Left side - Notes
            Cell notesCell = new Cell();
            notesCell.setBorder(Border.NO_BORDER);
            if (invoice.getNotes() != null && !invoice.getNotes().isEmpty()) {
                notesCell.add(new Paragraph("NOTES:")
                        .setFont(boldFont)
                        .setFontSize(12)
                        .setFontColor(darkGray)
                        .setMarginBottom(5));
                notesCell.add(new Paragraph(invoice.getNotes())
                        .setFont(regularFont)
                        .setFontSize(10)
                        .setBackgroundColor(lightGray)
                        .setPadding(10));
            }
            totalsSection.addCell(notesCell);
            
            // Right side - Totals
            Cell totalsCell = new Cell();
            totalsCell.setBorder(Border.NO_BORDER);
            
            Table totalsTable = new Table(UnitValue.createPercentArray(new float[]{60f, 40f})).useAllAvailableWidth();
            totalsTable.addCell(new Cell().add(new Paragraph("Subtotal:").setFont(boldFont).setFontSize(10))
                    .setBorder(Border.NO_BORDER).setPadding(5));
            totalsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", invoice.getSubtotal())).setFont(regularFont).setFontSize(10))
                    .setBorder(Border.NO_BORDER).setPadding(5).setTextAlignment(TextAlignment.RIGHT));
            
            if (invoice.getTaxRate() != null && invoice.getTaxRate().compareTo(BigDecimal.ZERO) > 0) {
                totalsTable.addCell(new Cell().add(new Paragraph("Tax (" + String.format("%.2f", invoice.getTaxRate()) + "%):").setFont(boldFont).setFontSize(10))
                        .setBorder(Border.NO_BORDER).setPadding(5));
                totalsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", invoice.getTaxAmount())).setFont(regularFont).setFontSize(10))
                        .setBorder(Border.NO_BORDER).setPadding(5).setTextAlignment(TextAlignment.RIGHT));
            }
            
            totalsTable.addCell(new Cell().add(new Paragraph("Total Due:").setFont(boldFont).setFontSize(14).setFontColor(primaryColor))
                    .setBorder(Border.NO_BORDER).setPadding(5).setPaddingTop(10));
            totalsTable.addCell(new Cell().add(new Paragraph("$" + String.format("%.2f", invoice.getTotalAmount())).setFont(boldFont).setFontSize(14).setFontColor(primaryColor))
                    .setBorder(Border.NO_BORDER).setPadding(5).setPaddingTop(10).setTextAlignment(TextAlignment.RIGHT));
            
            totalsCell.add(totalsTable);
            totalsSection.addCell(totalsCell);
            
            document.add(totalsSection);
            document.add(new Paragraph("\n\n"));
            
            // Payment Instructions
            document.add(new Paragraph("PAYMENT INSTRUCTIONS:")
                    .setFont(boldFont)
                    .setFontSize(12)
                    .setFontColor(darkGray));
            document.add(new Paragraph("Please make payment via wire transfer or check to:")
                    .setFont(regularFont).setFontSize(10));
            document.add(new Paragraph("Bank: First National Bank")
                    .setFont(regularFont).setFontSize(10));
            document.add(new Paragraph("Account Name: Bostoneo Solutions LLC")
                    .setFont(regularFont).setFontSize(10));
            document.add(new Paragraph("Account Number: XXXX-XXXX-1234")
                    .setFont(regularFont).setFontSize(10));
            document.add(new Paragraph("Routing Number: 123456789")
                    .setFont(regularFont).setFontSize(10));
            
            document.add(new Paragraph("\n\n"));
            
            // Footer
            document.add(new Paragraph("Thank you for your business!")
                    .setFont(regularFont)
                    .setFontSize(12)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setFontColor(darkGray));
            
            document.close();
            
            byte[] pdfBytes = baos.toByteArray();
            return new ByteArrayResource(pdfBytes) {
                @Override
                public String getFilename() {
                    return "Invoice-" + invoice.getInvoiceNumber() + ".pdf";
                }
            };
            
        } catch (Exception e) {
            log.error("Error generating PDF for invoice {}: {}", invoice.getInvoiceNumber(), e.getMessage());
            throw new RuntimeException("Failed to generate PDF: " + e.getMessage(), e);
        }
    }
    
    private DeviceRgb getStatusColor(InvoiceStatus status) {
        return switch (status) {
            case PAID -> new DeviceRgb(15, 81, 50); // Green
            case PENDING, ISSUED -> new DeviceRgb(102, 77, 3); // Yellow
            case OVERDUE, CANCELLED -> new DeviceRgb(114, 28, 36); // Red
            default -> new DeviceRgb(5, 81, 96); // Blue for DRAFT
        };
    }
    
    public void sendInvoiceByEmail(Long id, String recipientEmail, String subject, String message) {
        log.info("Sending invoice {} to {}", id, recipientEmail);
        
        Invoice invoice = getInvoiceById(id);
        if (invoice == null) {
            throw new RuntimeException("Invoice not found");
        }
        
        // Prepare professional email content
        String emailSubject = subject != null && !subject.isEmpty() ? 
            subject : "Invoice " + invoice.getInvoiceNumber() + " from Bostoneo Solutions";
        
        String emailBody = createProfessionalEmailTemplate(invoice, message);
        
        try {
            // Generate PDF attachment
            Resource pdfAttachment = generateInvoicePdf(id);
            String attachmentName = "Invoice-" + invoice.getInvoiceNumber() + ".pdf";
            
            // Use the EmailService to send the email with attachment
            if (emailService != null) {
                boolean sent = emailService.sendEmailWithAttachment(
                    recipientEmail, 
                    emailSubject, 
                    emailBody, 
                    pdfAttachment, 
                    attachmentName
                );
                if (sent) {
                    log.info("Invoice {} with PDF attachment sent successfully to {}", 
                            invoice.getInvoiceNumber(), recipientEmail);
                } else {
                    log.error("Failed to send invoice {} to {}", invoice.getInvoiceNumber(), recipientEmail);
                    throw new RuntimeException("Failed to send email");
                }
            } else {
                log.warn("EmailService not available, simulating email send for invoice {} to {}", 
                        invoice.getInvoiceNumber(), recipientEmail);
            }
        } catch (Exception e) {
            log.error("Error sending invoice email: {}", e.getMessage());
            throw new RuntimeException("Failed to send invoice email: " + e.getMessage());
        }
    }
    
    private String createProfessionalEmailTemplate(Invoice invoice, String customMessage) {
        StringBuilder emailContent = new StringBuilder();
        
        // HTML Email Template
        emailContent.append("<!DOCTYPE html>")
                   .append("<html lang='en'>")
                   .append("<head>")
                   .append("<meta charset='UTF-8'>")
                   .append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>")
                   .append("<title>Invoice ").append(invoice.getInvoiceNumber()).append("</title>")
                   .append("<style>")
                   .append("body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }")
                   .append(".email-container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }")
                   .append(".header { background: linear-gradient(135deg, #0d6efd, #0056b3); color: white; padding: 30px; text-align: center; }")
                   .append(".header h1 { margin: 0; font-size: 28px; }")
                   .append(".header p { margin: 10px 0 0 0; opacity: 0.9; }")
                   .append(".content { padding: 30px; }")
                   .append(".greeting { font-size: 18px; margin-bottom: 20px; }")
                   .append(".invoice-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }")
                   .append(".invoice-details h3 { color: #0d6efd; margin-top: 0; }")
                   .append(".detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #dee2e6; }")
                   .append(".detail-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; color: #0d6efd; }")
                   .append(".message-section { background: #e7f3ff; border-left: 4px solid #0d6efd; padding: 15px; margin: 20px 0; }")
                   .append(".cta-button { text-align: center; margin: 30px 0; }")
                   .append(".cta-button a { background: #0d6efd; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; }")
                   .append(".payment-info { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }")
                   .append(".payment-info h4 { color: #856404; margin-top: 0; }")
                   .append(".footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }")
                   .append(".footer p { margin: 5px 0; }")
                   .append("</style>")
                   .append("</head>")
                   .append("<body>");
        
        // Email Container
        emailContent.append("<div class='email-container'>");
        
        // Header
        emailContent.append("<div class='header'>")
                   .append("<h1>BOSTONEO SOLUTIONS</h1>")
                   .append("<p>Professional Legal Services</p>")
                   .append("</div>");
        
        // Content
        emailContent.append("<div class='content'>");
        
        // Greeting
        emailContent.append("<div class='greeting'>")
                   .append("Dear ").append(invoice.getClientName() != null ? invoice.getClientName() : "Valued Client").append(",")
                   .append("</div>");
        
        // Custom message or default
        if (customMessage != null && !customMessage.isEmpty()) {
            emailContent.append("<div class='message-section'>")
                       .append("<p>").append(customMessage).append("</p>")
                       .append("</div>");
        } else {
            emailContent.append("<p>We hope this email finds you well. Please find attached your invoice for the professional services rendered.</p>");
        }
        
        // PDF Attachment Notice
        emailContent.append("<div style='background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 15px; margin: 20px 0;'>")
                   .append("<p style='margin: 0; color: #0066cc;'>")
                   .append("<i class='fas fa-paperclip' style='margin-right: 8px;'></i>")
                   .append("<strong>📎 PDF Invoice Attached</strong><br>")
                   .append("Your detailed invoice (Invoice-").append(invoice.getInvoiceNumber()).append(".pdf) is attached to this email for your records.")
                   .append("</p>")
                   .append("</div>");
        
        // Invoice Details
        emailContent.append("<div class='invoice-details'>")
                   .append("<h3>Invoice Summary</h3>")
                   .append("<div class='detail-row'>")
                   .append("<span>Invoice Number:</span>")
                   .append("<span>").append(invoice.getInvoiceNumber()).append("</span>")
                   .append("</div>")
                   .append("<div class='detail-row'>")
                   .append("<span>Issue Date:</span>")
                   .append("<span>").append(invoice.getIssueDate()).append("</span>")
                   .append("</div>")
                   .append("<div class='detail-row'>")
                   .append("<span>Due Date:</span>")
                   .append("<span>").append(invoice.getDueDate()).append("</span>")
                   .append("</div>");
        
        if (invoice.getCaseName() != null && !invoice.getCaseName().isEmpty()) {
            emailContent.append("<div class='detail-row'>")
                       .append("<span>Legal Case:</span>")
                       .append("<span>").append(invoice.getCaseName()).append("</span>")
                       .append("</div>");
        }
        
        emailContent.append("<div class='detail-row'>")
                   .append("<span>Total Amount Due:</span>")
                   .append("<span>$").append(String.format("%.2f", invoice.getTotalAmount())).append("</span>")
                   .append("</div>")
                   .append("</div>");
        
        // Payment Instructions
        emailContent.append("<div class='payment-info'>")
                   .append("<h4>Payment Instructions</h4>")
                   .append("<p>Please remit payment by the due date using one of the following methods:</p>")
                   .append("<ul>")
                   .append("<li><strong>Wire Transfer:</strong> First National Bank</li>")
                   .append("<li><strong>Account Name:</strong> Bostoneo Solutions LLC</li>")
                   .append("<li><strong>Account Number:</strong> XXXX-XXXX-1234</li>")
                   .append("<li><strong>Routing Number:</strong> 123456789</li>")
                   .append("</ul>")
                   .append("<p>Please include the invoice number (").append(invoice.getInvoiceNumber()).append(") as a reference in your payment.</p>")
                   .append("</div>");
        
        // Notes section
        if (invoice.getNotes() != null && !invoice.getNotes().isEmpty()) {
            emailContent.append("<div class='message-section'>")
                       .append("<h4>Additional Notes:</h4>")
                       .append("<p>").append(invoice.getNotes()).append("</p>")
                       .append("</div>");
        }
        
        // Call to Action
        emailContent.append("<div class='cta-button'>")
                   .append("<p>Need to discuss this invoice or have questions about your account?</p>")
                   .append("<a href='mailto:info@bostoneo.com'>Contact Us</a>")
                   .append("</div>");
        
        // Closing
        emailContent.append("<p>Thank you for choosing Bostoneo Solutions for your legal needs. We appreciate your business and look forward to continuing our professional relationship.</p>");
        
        emailContent.append("<p>Best regards,<br>")
                   .append("<strong>The Bostoneo Solutions Team</strong></p>");
        
        emailContent.append("</div>"); // Close content
        
        // Footer
        emailContent.append("<div class='footer'>")
                   .append("<p><strong>Bostoneo Solutions LLC</strong></p>")
                   .append("<p>68 Harrison Ave, Boston MA | Phone: (123) 456-7890</p>")
                   .append("<p>Email: info@bostoneo.com | Website: www.bostoneo.com</p>")
                   .append("<p style='font-size: 12px; margin-top: 15px;'>")
                   .append("This is an automated message. Please do not reply directly to this email.")
                   .append("</p>")
                   .append("</div>");
        
        emailContent.append("</div>") // Close email-container
                   .append("</body></html>");
        
        return emailContent.toString();
    }
    
    public Map<String, Object> getInvoiceStatistics() {
        Long orgId = tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));

        Map<String, Object> stats = new HashMap<>();
        // SECURITY: Use tenant-filtered queries
        stats.put("totalInvoices", invoiceRepository.countByOrganizationId(orgId));
        stats.put("paidInvoices", invoiceRepository.countByOrganizationIdAndStatus(orgId, InvoiceStatus.PAID));
        stats.put("pendingInvoices", invoiceRepository.countByOrganizationIdAndStatus(orgId, InvoiceStatus.PENDING));
        stats.put("overdueInvoices", invoiceRepository.countByOrganizationIdAndStatus(orgId, InvoiceStatus.OVERDUE));
        return stats;
    }
    
    /**
     * Trigger workflows asynchronously to avoid affecting the main transaction
     */
    private void triggerWorkflowsAsync(Invoice invoice, 
                                      com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule.TriggerEvent event, 
                                      String oldStatus) {
        try {
            workflowService.triggerWorkflows(invoice, event, oldStatus);
        } catch (Exception e) {
            log.error("Error triggering workflows for invoice {} with event {}: {}", 
                     invoice.getInvoiceNumber(), event, e.getMessage());
        }
    }
}