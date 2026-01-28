package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.ExpenseDTO;
import com.bostoneo.bostoneosolutions.model.Expense;
import com.bostoneo.bostoneosolutions.service.ExpenseService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/expenses")
@Slf4j
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('EXPENSE:VIEW') or hasRole('ROLE_ADMIN') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<Page<Expense>>> getAllExpenses(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(expenseService.getAllExpenses(page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('EXPENSE:VIEW') or hasRole('ROLE_ADMIN') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<Expense>> getExpenseById(@PathVariable Long id) {
        return ResponseEntity.ok(expenseService.getExpenseById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('EXPENSE:CREATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "CREATE", entityType = "EXPENSE", description = "Created new expense record")
    public ResponseEntity<CustomHttpResponse<Expense>> createExpense(@Valid @RequestBody ExpenseDTO expenseDTO) {
        try {
            log.debug("Received expense DTO: {}", expenseDTO);

            if (expenseDTO.getAmount() == null) {
                throw new IllegalArgumentException("Amount is required");
            }
            if (expenseDTO.getCurrency() == null) {
                throw new IllegalArgumentException("Currency is required");
            }
            if (expenseDTO.getDate() == null) {
                throw new IllegalArgumentException("Date is required");
            }
            if (expenseDTO.getCategoryId() == null) {
                throw new IllegalArgumentException("Category ID is required");
            }
            if (expenseDTO.getVendorId() == null) {
                throw new IllegalArgumentException("Vendor ID is required");
            }
            if (expenseDTO.getClientId() == null) {
                throw new IllegalArgumentException("Client ID is required");
            }

            return ResponseEntity.ok(expenseService.createExpense(expenseDTO));
        } catch (Exception e) {
            log.error("Error creating expense: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(400, e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('EXPENSE:UPDATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "UPDATE", entityType = "EXPENSE", description = "Updated expense information")
    public ResponseEntity<CustomHttpResponse<Expense>> updateExpense(
            @PathVariable Long id,
            @Valid @RequestBody ExpenseDTO expenseDTO) {
        return ResponseEntity.ok(expenseService.updateExpense(id, expenseDTO));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('EXPENSE:DELETE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "DELETE", entityType = "EXPENSE", description = "Deleted expense record")
    public ResponseEntity<CustomHttpResponse<Void>> deleteExpense(@PathVariable Long id) {
        return ResponseEntity.ok(expenseService.deleteExpense(id));
    }

    @PostMapping("/{expenseId}/attachReceipt/{receiptId}")
    @PreAuthorize("hasAuthority('EXPENSE:UPDATE') or hasRole('ROLE_ADMIN')")
    @AuditLog(action = "UPDATE", entityType = "EXPENSE", description = "Attached receipt to expense")
    public ResponseEntity<CustomHttpResponse<Expense>> attachReceiptToExpense(
            @PathVariable Long expenseId,
            @PathVariable Long receiptId) {
        return ResponseEntity.ok(expenseService.attachReceiptToExpense(expenseId, receiptId));
    }
} 