package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIPDFFormField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIPDFFormFieldRepository extends JpaRepository<AIPDFFormField, Long> {
    
    List<AIPDFFormField> findByTemplateIdOrderByDisplayOrder(Long templateId);
    
    List<AIPDFFormField> findByTemplateIdAndIsRequiredTrueOrderByDisplayOrder(Long templateId);
    
    @Query("SELECT f FROM AIPDFFormField f WHERE f.templateId = :templateId AND f.fieldType = :fieldType ORDER BY f.displayOrder")
    List<AIPDFFormField> findByTemplateIdAndFieldType(@Param("templateId") Long templateId, @Param("fieldType") String fieldType);
    
    void deleteByTemplateId(Long templateId);
}