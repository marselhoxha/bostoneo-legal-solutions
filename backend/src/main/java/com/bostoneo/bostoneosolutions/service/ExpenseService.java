package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ExpenseDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.Expense;
import com.bostoneo.bostoneosolutions.model.Receipt;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.ExpenseRepository;
import com.bostoneo.bostoneosolutions.repository.ReceiptRepository;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import com.bostoneo.bostoneosolutions.mapper.ExpenseMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ReceiptRepository receiptRepository;
    private final ExpenseMapper expenseMapper;
    private final TenantService tenantService;
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private static final Logger log = LoggerFactory.getLogger(ExpenseService.class);

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    public CustomHttpResponse<Page<Expense>> getAllExpenses(int page, int size) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Page<Expense> expenses = expenseRepository.findAllWithRelationshipsByOrganization(orgId, PageRequest.of(page, size));
        return new CustomHttpResponse<>(200, "Expenses retrieved successfully", expenses);
    }

    public CustomHttpResponse<Expense> getExpenseById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query with relationships
        Expense expense = expenseRepository.findByIdAndOrganizationIdWithRelationships(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + id));

        // Ensure receipt data is initialized if it exists
        if (expense.getReceipt() != null) {
            // Access a property to force initialization
            expense.getReceipt().getFileName();
        }

        return new CustomHttpResponse<>(200, "Expense retrieved successfully", expense);
    }

    public CustomHttpResponse<Expense> createExpense(ExpenseDTO expenseDTO) {
        Long orgId = getRequiredOrganizationId();
        Expense expense = expenseMapper.toEntity(expenseDTO);
        expense.setOrganizationId(orgId);  // SECURITY: Set organization context
        Expense savedExpense = expenseRepository.save(expense);

        // Send notification to case assignees
        sendExpenseNotification(savedExpense, expenseDTO.getLegalCaseId(), orgId);

        return new CustomHttpResponse<>(201, "Expense created successfully", savedExpense);
    }

    public CustomHttpResponse<Expense> updateExpense(Long id, ExpenseDTO expenseDTO) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify expense belongs to current organization
        Expense existingExpense = expenseRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + id));
        
        Expense updatedExpense = expenseMapper.toEntity(expenseDTO);
        updatedExpense.setId(existingExpense.getId());
        
        Expense savedExpense = expenseRepository.save(updatedExpense);
        return new CustomHttpResponse<>(200, "Expense updated successfully", savedExpense);
    }

    @Transactional
    @AuditLog(action = "DELETE", entityType = "EXPENSE", description = "Deleted expense record with proper cleanup")
    public CustomHttpResponse<Void> deleteExpense(Long id) {
        log.info("Attempting to delete expense with ID: {}", id);
        Long orgId = getRequiredOrganizationId();

        try {
            // SECURITY: Verify expense belongs to current organization
            Expense expense = expenseRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + id));
            
            // Log the expense details before deletion for audit purposes
            log.info("Deleting expense: amount={}, description={}, invoice_id={}, case_id={}", 
                    expense.getAmount(), 
                    expense.getDescription(), 
                    expense.getInvoice() != null ? expense.getInvoice().getId() : null,
                    expense.getLegalCase() != null ? expense.getLegalCase().getId() : null);
            
            // Clean up any relationships before deletion
            if (expense.getInvoice() != null) {
                Invoice invoice = expense.getInvoice();
                if (invoice.getExpenses() != null) {
                    invoice.getExpenses().remove(expense);
                }
                expense.setInvoice(null);
            }
            
            if (expense.getLegalCase() != null) {
                expense.setLegalCase(null);
            }
            
            // Delete the expense
            expenseRepository.deleteById(id);
            log.info("Successfully deleted expense with ID: {}", id);
            
            return new CustomHttpResponse<>(200, "Expense deleted successfully", null);
            
        } catch (EntityNotFoundException e) {
            log.error("Expense not found with ID: {}", id);
            throw e;
        } catch (Exception e) {
            log.error("Error deleting expense with ID: {}", id, e);
            throw new RuntimeException("Failed to delete expense: " + e.getMessage(), e);
        }
    }

    /**
     * Attaches a receipt to an existing expense
     * 
     * @param expenseId The ID of the expense to attach the receipt to
     * @param receiptId The ID of the receipt to attach
     * @return A response containing the updated expense
     */
    public CustomHttpResponse<Expense> attachReceiptToExpense(Long expenseId, Long receiptId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify expense belongs to current organization
        Expense expense = expenseRepository.findByIdAndOrganizationId(expenseId, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + expenseId));
        
        // SECURITY: Use tenant-filtered query for receipt
        Receipt receipt = receiptRepository.findByIdAndOrganizationId(receiptId, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Receipt not found with id: " + receiptId));
        
        expense.setReceipt(receipt);
        Expense savedExpense = expenseRepository.save(expense);
        
        return new CustomHttpResponse<>(200, "Receipt attached successfully", savedExpense);
    }

    private void sendExpenseNotification(Expense expense, Long legalCaseId, Long orgId) {
        try {
            Long currentUserId = getCurrentUserId();
            String submitterName = getCurrentUserName();

            String title = "New Expense Submitted";
            String message = String.format("New expense submitted: $%s - %s",
                expense.getAmount(), expense.getDescription() != null ? expense.getDescription() : "No description");

            Set<Long> notificationUserIds = new HashSet<>();

            // If expense is linked to a case, notify case assignees
            if (legalCaseId != null) {
                try {
                    List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(legalCaseId, orgId);
                    for (CaseAssignment assignment : assignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to get case assignments for expense notification: {}", e.getMessage());
                }
            }

            // Exclude submitter
            if (currentUserId != null) {
                notificationUserIds.remove(currentUserId);
            }

            Map<String, Object> data = new HashMap<>();
            data.put("expenseId", expense.getId());
            if (legalCaseId != null) {
                data.put("caseId", legalCaseId);
            }

            for (Long userId : notificationUserIds) {
                notificationService.sendCrmNotification(title, message, userId, "EXPENSE_SUBMITTED", data);
            }

            log.info("Expense notification sent to {} users for expense ID: {}", notificationUserIds.size(), expense.getId());
        } catch (Exception e) {
            log.error("Failed to send expense notification for expense ID: {}", expense.getId(), e);
        }
    }

    private Long getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                Object principal = authentication.getPrincipal();
                if (principal instanceof UserDTO) {
                    return ((UserDTO) principal).getId();
                }
            }
        } catch (Exception e) {
            log.warn("Could not get current user ID: {}", e.getMessage());
        }
        return null;
    }

    private String getCurrentUserName() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                Object principal = authentication.getPrincipal();
                if (principal instanceof UserDTO) {
                    UserDTO user = (UserDTO) principal;
                    return user.getFirstName() + " " + user.getLastName();
                }
            }
        } catch (Exception e) {
            log.warn("Could not get current user name: {}", e.getMessage());
        }
        return "Someone";
    }
}