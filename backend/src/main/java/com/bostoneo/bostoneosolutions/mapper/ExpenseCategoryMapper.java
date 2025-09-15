package com.bostoneo.bostoneosolutions.mapper;

import com.bostoneo.bostoneosolutions.dto.ExpenseCategoryDTO;
import com.bostoneo.bostoneosolutions.model.ExpenseCategory;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring")
public interface ExpenseCategoryMapper {
    
    @Mapping(target = "parentId", source = "parent.id")
    @Mapping(target = "parentName", source = "parent.name")
    ExpenseCategoryDTO toDTO(ExpenseCategory category);
    
    @Mapping(target = "parent", ignore = true)
    @Mapping(target = "children", ignore = true)
    ExpenseCategory toEntity(ExpenseCategoryDTO dto);
    
    @Named("toReference")
    default ExpenseCategory toReference(Long id) {
        if (id == null) return null;
        return ExpenseCategory.builder().id(id).build();
    }
} 