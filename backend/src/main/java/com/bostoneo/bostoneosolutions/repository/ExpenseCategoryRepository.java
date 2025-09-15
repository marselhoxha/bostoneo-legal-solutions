package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, Long> {
    boolean existsByParentId(Long parentId);
} 