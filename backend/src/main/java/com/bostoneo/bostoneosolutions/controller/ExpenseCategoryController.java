package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.ExpenseCategoryDTO;
import com.***REMOVED***.***REMOVED***solutions.service.ExpenseCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expense-categories")
@RequiredArgsConstructor
public class ExpenseCategoryController {
    private final ExpenseCategoryService expenseCategoryService;

    @GetMapping
    public ResponseEntity<List<ExpenseCategoryDTO>> getAllCategories() {
        return ResponseEntity.ok(expenseCategoryService.getAllCategories());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ExpenseCategoryDTO> getCategoryById(@PathVariable Long id) {
        return ResponseEntity.ok(expenseCategoryService.getCategoryById(id));
    }

    @PostMapping
    public ResponseEntity<ExpenseCategoryDTO> createCategory(@Valid @RequestBody ExpenseCategoryDTO categoryDTO) {
        return new ResponseEntity<>(expenseCategoryService.createCategory(categoryDTO), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExpenseCategoryDTO> updateCategory(@PathVariable Long id, @Valid @RequestBody ExpenseCategoryDTO categoryDTO) {
        return ResponseEntity.ok(expenseCategoryService.updateCategory(id, categoryDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        expenseCategoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/has-children/{parentId}")
    public ResponseEntity<Boolean> hasChildCategories(@PathVariable Long parentId) {
        return ResponseEntity.ok(expenseCategoryService.hasChildCategories(parentId));
    }
} 