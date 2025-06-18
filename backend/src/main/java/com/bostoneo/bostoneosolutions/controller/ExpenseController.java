package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.annotation.AuditLog;
import com.***REMOVED***.***REMOVED***solutions.dto.ExpenseDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Expense;
import com.***REMOVED***.***REMOVED***solutions.service.ExpenseService;
import com.***REMOVED***.***REMOVED***solutions.util.CustomHttpResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    public ResponseEntity<CustomHttpResponse<Page<Expense>>> getAllExpenses(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(expenseService.getAllExpenses(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Expense>> getExpenseById(@PathVariable Long id) {
        return ResponseEntity.ok(expenseService.getExpenseById(id));
    }

    @PostMapping
    @AuditLog(action = "CREATE", entityType = "EXPENSE", description = "Created new expense record")
    public ResponseEntity<CustomHttpResponse<Expense>> createExpense(@Valid @RequestBody ExpenseDTO expenseDTO) {
        try {
            System.out.println("Received expense DTO: " + expenseDTO);
            System.out.println("Amount: " + expenseDTO.getAmount());
            System.out.println("Currency: " + expenseDTO.getCurrency());
            System.out.println("Date: " + expenseDTO.getDate());
            System.out.println("Category ID: " + expenseDTO.getCategoryId());
            System.out.println("Vendor ID: " + expenseDTO.getVendorId());
            System.out.println("Client ID: " + expenseDTO.getClientId());
            
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
            System.err.println("Error creating expense: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest()
                .body(new CustomHttpResponse<>(400, e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    @AuditLog(action = "UPDATE", entityType = "EXPENSE", description = "Updated expense information")
    public ResponseEntity<CustomHttpResponse<Expense>> updateExpense(
            @PathVariable Long id,
            @Valid @RequestBody ExpenseDTO expenseDTO) {
        return ResponseEntity.ok(expenseService.updateExpense(id, expenseDTO));
    }

    @DeleteMapping("/{id}")
    @AuditLog(action = "DELETE", entityType = "EXPENSE", description = "Deleted expense record")
    public ResponseEntity<CustomHttpResponse<Void>> deleteExpense(@PathVariable Long id) {
        return ResponseEntity.ok(expenseService.deleteExpense(id));
    }

    @PostMapping("/{expenseId}/attachReceipt/{receiptId}")
    @AuditLog(action = "UPDATE", entityType = "EXPENSE", description = "Attached receipt to expense")
    public ResponseEntity<CustomHttpResponse<Expense>> attachReceiptToExpense(
            @PathVariable Long expenseId,
            @PathVariable Long receiptId) {
        return ResponseEntity.ok(expenseService.attachReceiptToExpense(expenseId, receiptId));
    }
} 