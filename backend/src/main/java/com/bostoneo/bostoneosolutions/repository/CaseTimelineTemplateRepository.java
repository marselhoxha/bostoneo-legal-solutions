package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseTimelineTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * WARNING: Entity CaseTimelineTemplate lacks organization_id.
 * This may be intentional if templates are shared globally, but verify with security requirements.
 */
@Repository
public interface CaseTimelineTemplateRepository extends JpaRepository<CaseTimelineTemplate, Long> {

    // ==================== METHODS REQUIRING REVIEW ====================
    // NOTE: CaseTimelineTemplate may be a shared/system resource.
    // Verify if organization isolation is required.

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    List<CaseTimelineTemplate> findByCaseTypeOrderByPhaseOrderAsc(String caseType);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    @Query("SELECT DISTINCT t.caseType FROM CaseTimelineTemplate t ORDER BY t.caseType")
    List<String> findDistinctCaseTypes();

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    boolean existsByCaseType(String caseType);
}
