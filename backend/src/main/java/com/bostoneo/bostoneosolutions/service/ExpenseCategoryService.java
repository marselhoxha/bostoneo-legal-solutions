package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.ExpenseCategoryDTO;
import com.***REMOVED***.***REMOVED***solutions.model.ExpenseCategory;
import com.***REMOVED***.***REMOVED***solutions.repository.ExpenseCategoryRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExpenseCategoryService {
    private final ExpenseCategoryRepository expenseCategoryRepository;

    public List<ExpenseCategoryDTO> getAllCategories() {
        return expenseCategoryRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public ExpenseCategoryDTO getCategoryById(Long id) {
        return expenseCategoryRepository.findById(id)
                .map(this::convertToDTO)
                .orElseThrow(() -> new EntityNotFoundException("Category not found with id: " + id));
    }

    @Transactional
    public ExpenseCategoryDTO createCategory(ExpenseCategoryDTO categoryDTO) {
        ExpenseCategory category = convertToEntity(categoryDTO);
        return convertToDTO(expenseCategoryRepository.save(category));
    }

    @Transactional
    public ExpenseCategoryDTO updateCategory(Long id, ExpenseCategoryDTO categoryDTO) {
        ExpenseCategory existingCategory = expenseCategoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Category not found with id: " + id));

        existingCategory.setName(categoryDTO.getName());
        existingCategory.setColor(categoryDTO.getColor());
        
        // Handle parent category changes
        if (categoryDTO.getParentId() != null) {
            // First validate to avoid circular references
            if (categoryDTO.getParentId().equals(id)) {
                throw new IllegalArgumentException("Category cannot be its own parent");
            }
            
            ExpenseCategory parent = expenseCategoryRepository.findById(categoryDTO.getParentId())
                    .orElseThrow(() -> new EntityNotFoundException("Parent category not found with id: " + categoryDTO.getParentId()));
            existingCategory.setParent(parent);
        } else {
            // When setting parent to null, ensure children references are updated
            existingCategory.setParent(null);
        }

        // Force flush to ensure relationships are updated in database before returning
        ExpenseCategory savedCategory = expenseCategoryRepository.saveAndFlush(existingCategory);
        
        return convertToDTO(savedCategory);
    }

    @Transactional
    public void deleteCategory(Long id) {
        if (hasChildCategories(id)) {
            throw new IllegalStateException("Cannot delete category with child categories");
        }
        expenseCategoryRepository.deleteById(id);
    }

    public boolean hasChildCategories(Long parentId) {
        return expenseCategoryRepository.existsByParentId(parentId);
    }

    private ExpenseCategoryDTO convertToDTO(ExpenseCategory category) {
        return ExpenseCategoryDTO.builder()
                .id(category.getId())
                .name(category.getName())
                .color(category.getColor())
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .parentName(category.getParent() != null ? category.getParent().getName() : null)
                .createdAt(category.getCreatedAt())
                .updatedAt(category.getUpdatedAt())
                .build();
    }

    private ExpenseCategory convertToEntity(ExpenseCategoryDTO categoryDTO) {
        ExpenseCategory category = new ExpenseCategory();
        category.setName(categoryDTO.getName());
        category.setColor(categoryDTO.getColor());
        if (categoryDTO.getParentId() != null) {
            ExpenseCategory parent = expenseCategoryRepository.findById(categoryDTO.getParentId())
                    .orElseThrow(() -> new EntityNotFoundException("Parent category not found with id: " + categoryDTO.getParentId()));
            category.setParent(parent);
        }
        return category;
    }
} 