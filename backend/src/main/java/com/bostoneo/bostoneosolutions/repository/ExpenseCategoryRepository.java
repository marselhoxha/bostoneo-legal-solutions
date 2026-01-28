package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, Long> {
    boolean existsByParentId(Long parentId);

    // ==================== TENANT-FILTERED METHODS ====================

    java.util.List<ExpenseCategory> findByOrganizationId(Long organizationId);

    java.util.Optional<ExpenseCategory> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByParentIdAndOrganizationId(Long parentId, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
} 