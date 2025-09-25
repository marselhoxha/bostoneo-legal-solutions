package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AITemplateVariableRepository extends JpaRepository<AITemplateVariable, Long> {
    
    List<AITemplateVariable> findByTemplateIdOrderByDisplayOrder(Long templateId);
    
    List<AITemplateVariable> findByTemplateId(Long templateId);
    
    List<AITemplateVariable> findByVariableName(String variableName);
    
    List<AITemplateVariable> findByVariableType(String variableType);
    
    List<AITemplateVariable> findByIsRequiredTrue();
}
