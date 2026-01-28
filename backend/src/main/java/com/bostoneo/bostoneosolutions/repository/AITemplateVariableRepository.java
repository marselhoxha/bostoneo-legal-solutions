package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * WARNING: Entity AITemplateVariable lacks organization_id.
 * Tenant isolation is enforced through parent AILegalTemplate which has organization_id.
 * Verify template ownership before calling these methods.
 */
@Repository
public interface AITemplateVariableRepository extends JpaRepository<AITemplateVariable, Long> {

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Verify parent template ownership through AILegalTemplate.organizationId

    /** @deprecated Verify template ownership through AILegalTemplate.organizationId before calling */
    @Deprecated
    List<AITemplateVariable> findByTemplateIdOrderByDisplayOrder(Long templateId);

    /** @deprecated Verify template ownership through AILegalTemplate.organizationId before calling */
    @Deprecated
    List<AITemplateVariable> findByTemplateId(Long templateId);

    /** @deprecated Entity lacks organization_id - may return data from all organizations */
    @Deprecated
    List<AITemplateVariable> findByVariableName(String variableName);

    /** @deprecated Entity lacks organization_id - may return data from all organizations */
    @Deprecated
    List<AITemplateVariable> findByVariableType(String variableType);

    /** @deprecated Entity lacks organization_id - may return data from all organizations */
    @Deprecated
    List<AITemplateVariable> findByIsRequiredTrue();
}
