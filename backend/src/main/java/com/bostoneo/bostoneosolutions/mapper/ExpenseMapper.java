package com.***REMOVED***.***REMOVED***solutions.mapper;

import com.***REMOVED***.***REMOVED***solutions.dto.ExpenseDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Expense;
import com.***REMOVED***.***REMOVED***solutions.model.ExpenseCategory;
import com.***REMOVED***.***REMOVED***solutions.model.Client;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import com.***REMOVED***.***REMOVED***solutions.model.Vendor;
import com.***REMOVED***.***REMOVED***solutions.model.Receipt;
import com.***REMOVED***.***REMOVED***solutions.repository.ExpenseCategoryRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.ClientRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.LegalCaseRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.VendorRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.ReceiptRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

@Component
public class ExpenseMapper {
    private final ExpenseCategoryRepository categoryRepository;
    private final ClientRepository clientRepository;
    private final VendorRepository vendorRepository;
    private final InvoiceRepository invoiceRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ReceiptRepository receiptRepository;

    public ExpenseMapper(
            ExpenseCategoryRepository categoryRepository,
            ClientRepository clientRepository,
            VendorRepository vendorRepository,
            InvoiceRepository invoiceRepository,
            LegalCaseRepository legalCaseRepository,
            ReceiptRepository receiptRepository) {
        this.categoryRepository = categoryRepository;
        this.clientRepository = clientRepository;
        this.vendorRepository = vendorRepository;
        this.invoiceRepository = invoiceRepository;
        this.legalCaseRepository = legalCaseRepository;
        this.receiptRepository = receiptRepository;
    }

    @Transactional(readOnly = true)
    public ExpenseDTO toDTO(Expense expense) {
        if (expense == null) {
            return null;
        }

        ExpenseDTO dto = new ExpenseDTO();
        dto.setId(expense.getId());
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

        Expense expense = new Expense();
        expense.setId(dto.getId());
        expense.setAmount(dto.getAmount());
        expense.setCurrency(dto.getCurrency());
        expense.setDate(convertToDate(dto.getDate()));
        expense.setDescription(dto.getDescription());
        expense.setTax(dto.getTax());
        
        // Set the relationships using actual entities from repositories
        if (dto.getCategoryId() != null) {
            categoryRepository.findById(dto.getCategoryId())
                .ifPresent(expense::setCategory);
        }
        if (dto.getVendorId() != null) {
            vendorRepository.findById(dto.getVendorId())
                .ifPresent(expense::setVendor);
        }
        if (dto.getClientId() != null) {
            clientRepository.findById(dto.getClientId())
                .ifPresent(expense::setClient);
        }
        if (dto.getInvoiceId() != null) {
            invoiceRepository.findById(dto.getInvoiceId())
                .ifPresent(expense::setInvoice);
        }
        if (dto.getLegalCaseId() != null) {
            legalCaseRepository.findById(dto.getLegalCaseId())
                .ifPresent(expense::setLegalCase);
        }
        // Set receipt relationship
        if (dto.getReceiptId() != null) {
            receiptRepository.findById(dto.getReceiptId())
                .ifPresent(expense::setReceipt);
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