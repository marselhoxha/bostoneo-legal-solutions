package com.bostoneo.bostoneosolutions.mapper;

import com.bostoneo.bostoneosolutions.dto.ExpenseDTO;
import com.bostoneo.bostoneosolutions.model.Expense;
import com.bostoneo.bostoneosolutions.model.ExpenseCategory;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.Vendor;
import com.bostoneo.bostoneosolutions.model.Receipt;
import com.bostoneo.bostoneosolutions.repository.ExpenseCategoryRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.VendorRepository;
import com.bostoneo.bostoneosolutions.repository.ReceiptRepository;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

@Component
@Slf4j
public class ExpenseMapper {
    private final ExpenseCategoryRepository categoryRepository;
    private final ClientRepository clientRepository;
    private final VendorRepository vendorRepository;
    private final InvoiceRepository invoiceRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ReceiptRepository receiptRepository;
    private final TenantService tenantService;

    public ExpenseMapper(
            ExpenseCategoryRepository categoryRepository,
            ClientRepository clientRepository,
            VendorRepository vendorRepository,
            InvoiceRepository invoiceRepository,
            LegalCaseRepository legalCaseRepository,
            ReceiptRepository receiptRepository,
            TenantService tenantService) {
        this.categoryRepository = categoryRepository;
        this.clientRepository = clientRepository;
        this.vendorRepository = vendorRepository;
        this.invoiceRepository = invoiceRepository;
        this.legalCaseRepository = legalCaseRepository;
        this.receiptRepository = receiptRepository;
        this.tenantService = tenantService;
    }

    /**
     * Get the current organization ID from tenant context.
     * Throws RuntimeException if no organization context is available.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required for expense mapping"));
    }

    @Transactional(readOnly = true)
    public ExpenseDTO toDTO(Expense expense) {
        if (expense == null) {
            return null;
        }

        ExpenseDTO dto = new ExpenseDTO();
        dto.setId(expense.getId());
        dto.setOrganizationId(expense.getOrganizationId());
        dto.setAmount(expense.getAmount());
        dto.setCurrency(expense.getCurrency());
        dto.setDate(convertToLocalDateTime(expense.getDate()));
        dto.setDescription(expense.getDescription());
        dto.setTax(expense.getTax());
        
        // Handle category
        if (expense.getCategory() != null) {
            dto.setCategoryId(expense.getCategory().getId());
            dto.setCategoryName(expense.getCategory().getName());
        }
        
        // Handle vendor
        if (expense.getVendor() != null) {
            dto.setVendorId(expense.getVendor().getId());
        }
        
        // Handle client
        if (expense.getClient() != null) {
            dto.setClientId(expense.getClient().getId());
            dto.setClientName(expense.getClient().getName());
        }
        
        // Handle invoice
        if (expense.getInvoice() != null) {
            dto.setInvoiceId(expense.getInvoice().getId());
            dto.setInvoiceNumber(expense.getInvoice().getInvoiceNumber());
        }
        
        // Handle legal case
        if (expense.getLegalCase() != null) {
            dto.setLegalCaseId(expense.getLegalCase().getId());
            dto.setLegalCaseNumber(expense.getLegalCase().getCaseNumber());
        }
        
        // Handle receipt
        if (expense.getReceipt() != null) {
            dto.setReceiptId(expense.getReceipt().getId());
            dto.setReceiptFileName(expense.getReceipt().getFileName());
        }
        
        dto.setCreatedAt(convertToLocalDateTime(expense.getCreatedAt()));
        dto.setUpdatedAt(convertToLocalDateTime(expense.getUpdatedAt()));
        
        return dto;
    }

    @Transactional
    public Expense toEntity(ExpenseDTO dto) {
        if (dto == null) {
            return null;
        }

        // SECURITY: Get current organization ID for tenant isolation
        Long orgId = getRequiredOrganizationId();

        Expense expense = new Expense();
        expense.setId(dto.getId());
        expense.setOrganizationId(orgId);  // SECURITY: Always use current org context
        expense.setAmount(dto.getAmount());
        expense.setCurrency(dto.getCurrency());
        expense.setDate(convertToDate(dto.getDate()));
        expense.setDescription(dto.getDescription());
        expense.setTax(dto.getTax());

        // SECURITY: Set relationships using tenant-filtered queries to prevent cross-tenant data access
        if (dto.getCategoryId() != null) {
            categoryRepository.findByIdAndOrganizationId(dto.getCategoryId(), orgId)
                .ifPresentOrElse(
                    expense::setCategory,
                    () -> log.warn("SECURITY: Category {} not found in organization {}", dto.getCategoryId(), orgId)
                );
        }
        if (dto.getVendorId() != null) {
            vendorRepository.findByIdAndOrganizationId(dto.getVendorId(), orgId)
                .ifPresentOrElse(
                    expense::setVendor,
                    () -> log.warn("SECURITY: Vendor {} not found in organization {}", dto.getVendorId(), orgId)
                );
        }
        if (dto.getClientId() != null) {
            clientRepository.findByIdAndOrganizationId(dto.getClientId(), orgId)
                .ifPresentOrElse(
                    expense::setClient,
                    () -> log.warn("SECURITY: Client {} not found in organization {}", dto.getClientId(), orgId)
                );
        }
        if (dto.getInvoiceId() != null) {
            invoiceRepository.findByIdAndOrganizationId(dto.getInvoiceId(), orgId)
                .ifPresentOrElse(
                    expense::setInvoice,
                    () -> log.warn("SECURITY: Invoice {} not found in organization {}", dto.getInvoiceId(), orgId)
                );
        }
        if (dto.getLegalCaseId() != null) {
            legalCaseRepository.findByIdAndOrganizationId(dto.getLegalCaseId(), orgId)
                .ifPresentOrElse(
                    expense::setLegalCase,
                    () -> log.warn("SECURITY: LegalCase {} not found in organization {}", dto.getLegalCaseId(), orgId)
                );
        }
        // SECURITY: Set receipt relationship with tenant filtering
        if (dto.getReceiptId() != null) {
            receiptRepository.findByIdAndOrganizationId(dto.getReceiptId(), orgId)
                .ifPresentOrElse(
                    expense::setReceipt,
                    () -> log.warn("SECURITY: Receipt {} not found in organization {}", dto.getReceiptId(), orgId)
                );
        }

        expense.setCreatedAt(convertToDate(dto.getCreatedAt()));
        expense.setUpdatedAt(convertToDate(dto.getUpdatedAt()));

        return expense;
    }

    private LocalDateTime convertToLocalDateTime(Date date) {
        if (date == null) {
            return null;
        }
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
    }

    private Date convertToDate(LocalDateTime localDateTime) {
        if (localDateTime == null) {
            return null;
        }
        return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
    }
} 