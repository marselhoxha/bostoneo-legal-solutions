package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowTemplateType;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseWorkflowTemplateRepository extends JpaRepository<CaseWorkflowTemplate, Long> {

    List<CaseWorkflowTemplate> findByIsSystemTrue();

    List<CaseWorkflowTemplate> findByCreatedById(Long userId);

    Optional<CaseWorkflowTemplate> findByTemplateType(WorkflowTemplateType templateType);

    List<CaseWorkflowTemplate> findByIsSystemTrueOrCreatedById(Long userId);
}
