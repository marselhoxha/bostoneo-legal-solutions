package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ExpenseCategoryDTO;
import com.bostoneo.bostoneosolutions.model.ExpenseCategory;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.ExpenseCategoryRepository;
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
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    public List<ExpenseCategoryDTO> getAllCategories() {
        Long orgId = getRequiredOrganizationId();
        return expenseCategoryRepository.findByOrganizationId(orgId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public ExpenseCategoryDTO getCategoryById(Long id) {
        Long orgId = getRequiredOrganizationId();
        return expenseCategoryRepository.findByIdAndOrganizationId(id, orgId)
                .map(this::convertToDTO)
                .orElseThrow(() -> new EntityNotFoundException("Category not found with id: " + id));
    }

    @Transactional
    public ExpenseCategoryDTO createCategory(ExpenseCategoryDTO categoryDTO) {
        Long orgId = getRequiredOrganizationId();
        ExpenseCategory category = convertToEntity(categoryDTO);
        category.setOrganizationId(orgId);
        return convertToDTO(expenseCategoryRepository.save(category));
    }

    @Transactional
    public ExpenseCategoryDTO updateCategory(Long id, ExpenseCategoryDTO categoryDTO) {
        Long orgId = getRequiredOrganizationId();
        ExpenseCategory existingCategory = expenseCategoryRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Category not found with id: " + id));

        existingCategory.setName(categoryDTO.getName());
        existingCategory.setColor(categoryDTO.getColor());
        
        // Handle parent category changes
        if (categoryDTO.getParentId() != null) {
            // First validate to avoid circular references
            if (categoryDTO.getParentId().equals(id)) {
                throw new IllegalArgumentException("Category cannot be its own parent");
            }
            
            // SECURITY: Use tenant-filtered query for parent category
            ExpenseCategory parent = expenseCategoryRepository.findByIdAndOrganizationId(categoryDTO.getParentId(), orgId)
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
        Long orgId = getRequiredOrganizationId();
        if (!expenseCategoryRepository.existsByIdAndOrganizationId(id, orgId)) {
            throw new EntityNotFoundException("Category not found with id: " + id);
        }
        if (hasChildCategories(id)) {
            throw new IllegalStateException("Cannot delete category with child categories");
        }
        expenseCategoryRepository.deleteById(id);
    }

    public boolean hasChildCategories(Long parentId) {
        Long orgId = getRequiredOrganizationId();
        return expenseCategoryRepository.existsByParentIdAndOrganizationId(parentId, orgId);
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
        Long orgId = getRequiredOrganizationId();
        ExpenseCategory category = new ExpenseCategory();
        category.setName(categoryDTO.getName());
        category.setColor(categoryDTO.getColor());
        if (categoryDTO.getParentId() != null) {
            // SECURITY: Use tenant-filtered query for parent category
            ExpenseCategory parent = expenseCategoryRepository.findByIdAndOrganizationId(categoryDTO.getParentId(), orgId)
                    .orElseThrow(() -> new EntityNotFoundException("Parent category not found with id: " + categoryDTO.getParentId()));
            category.setParent(parent);
        }
        return category;
    }
} 