package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.ExpenseDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Expense;
import com.***REMOVED***.***REMOVED***solutions.model.Receipt;
import com.***REMOVED***.***REMOVED***solutions.repository.ExpenseRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.ReceiptRepository;
import com.***REMOVED***.***REMOVED***solutions.util.CustomHttpResponse;
import com.***REMOVED***.***REMOVED***solutions.mapper.ExpenseMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ReceiptRepository receiptRepository;
    private final ExpenseMapper expenseMapper;

    public CustomHttpResponse<Page<Expense>> getAllExpenses(int page, int size) {
        Page<Expense> expenses = expenseRepository.findAllWithRelationships(PageRequest.of(page, size));
        return new CustomHttpResponse<>(200, "Expenses retrieved successfully", expenses);
    }

    public CustomHttpResponse<Expense> getExpenseById(Long id) {
        // Use the new repository method that fetches all relationships eagerly
        Expense expense = expenseRepository.findByIdWithRelationships(id)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + id));
        
        // Ensure receipt data is initialized if it exists
        if (expense.getReceipt() != null) {
            // Access a property to force initialization
            expense.getReceipt().getFileName();
        }
        
        return new CustomHttpResponse<>(200, "Expense retrieved successfully", expense);
    }

    public CustomHttpResponse<Expense> createExpense(ExpenseDTO expenseDTO) {
        Expense expense = expenseMapper.toEntity(expenseDTO);
        Expense savedExpense = expenseRepository.save(expense);
        return new CustomHttpResponse<>(201, "Expense created successfully", savedExpense);
    }

    public CustomHttpResponse<Expense> updateExpense(Long id, ExpenseDTO expenseDTO) {
        Expense existingExpense = expenseRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + id));
        
        Expense updatedExpense = expenseMapper.toEntity(expenseDTO);
        updatedExpense.setId(existingExpense.getId());
        
        Expense savedExpense = expenseRepository.save(updatedExpense);
        return new CustomHttpResponse<>(200, "Expense updated successfully", savedExpense);
    }

    public CustomHttpResponse<Void> deleteExpense(Long id) {
        if (!expenseRepository.existsById(id)) {
            throw new EntityNotFoundException("Expense not found with id: " + id);
        }
        expenseRepository.deleteById(id);
        return new CustomHttpResponse<>(200, "Expense deleted successfully", null);
    }

    /**
     * Attaches a receipt to an existing expense
     * 
     * @param expenseId The ID of the expense to attach the receipt to
     * @param receiptId The ID of the receipt to attach
     * @return A response containing the updated expense
     */
    public CustomHttpResponse<Expense> attachReceiptToExpense(Long expenseId, Long receiptId) {
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found with id: " + expenseId));
        
        Receipt receipt = receiptRepository.findById(receiptId)
                .orElseThrow(() -> new EntityNotFoundException("Receipt not found with id: " + receiptId));
        
        expense.setReceipt(receipt);
        Expense savedExpense = expenseRepository.save(expense);
        
        return new CustomHttpResponse<>(200, "Receipt attached successfully", savedExpense);
    }
} 