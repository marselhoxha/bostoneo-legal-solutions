package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowTemplateType;
import com.bostoneo.bostoneosolutions.model.CaseWorkflowTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseWorkflowTemplateRepository extends JpaRepository<CaseWorkflowTemplate, Long> {

    List<CaseWorkflowTemplate> findByIsSystemTrue();

    List<CaseWorkflowTemplate> findByCreatedById(Long userId);

    Optional<CaseWorkflowTemplate> findByTemplateType(WorkflowTemplateType templateType);

    List<CaseWorkflowTemplate> findByIsSystemTrueOrCreatedById(Long userId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find template by ID and organization (SECURITY: tenant isolation)
     * System templates (isSystem=true) can be accessed by any org
     */
    Optional<CaseWorkflowTemplate> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find all templates accessible by an organization (system + org-specific)
     */
    List<CaseWorkflowTemplate> findByIsSystemTrueOrOrganizationId(Long organizationId);

    /**
     * Find templates created within an organization
     */
    List<CaseWorkflowTemplate> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find template by ID that is accessible to the organization
     * (either a system template OR belongs to the organization)
     */
    @Query("SELECT t FROM CaseWorkflowTemplate t WHERE t.id = :id AND (t.isSystem = true OR t.organizationId = :organizationId)")
    Optional<CaseWorkflowTemplate> findByIdAndAccessibleByOrganization(@Param("id") Long id, @Param("organizationId") Long organizationId);
}
