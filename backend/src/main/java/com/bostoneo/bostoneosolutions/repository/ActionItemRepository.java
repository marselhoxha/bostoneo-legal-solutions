package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActionItemRepository extends JpaRepository<ActionItem, Long> {
    /**
     * @deprecated Use findByOrganizationIdAndAnalysisIdOrderByDeadlineAsc instead for tenant isolation
     */
    @Deprecated
    List<ActionItem> findByAnalysisIdOrderByDeadlineAsc(Long analysisId);

    /**
     * @deprecated Use findByOrganizationIdAndAnalysisIdAndStatusOrderByDeadlineAsc instead for tenant isolation
     */
    @Deprecated
    List<ActionItem> findByAnalysisIdAndStatusOrderByDeadlineAsc(Long analysisId, String status);

    /**
     * @deprecated Use findByOrganizationIdAndAnalysisIdInOrderByDeadlineAsc instead for tenant isolation
     */
    @Deprecated
    List<ActionItem> findByAnalysisIdInOrderByDeadlineAsc(List<Long> analysisIds);

    /**
     * @deprecated Use deleteByOrganizationIdAndAnalysisId instead for tenant isolation
     */
    @Deprecated
    void deleteByAnalysisId(Long analysisId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find action item by ID and organization (SECURITY: tenant isolation)
     */
    Optional<ActionItem> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find action items by analysis ID within an organization (SECURITY: tenant isolation)
     */
    List<ActionItem> findByOrganizationIdAndAnalysisIdOrderByDeadlineAsc(Long organizationId, Long analysisId);

    /**
     * Find all action items for an organization (SECURITY: tenant isolation)
     */
    List<ActionItem> findByOrganizationIdOrderByDeadlineAsc(Long organizationId);

    /**
     * SECURITY: Find all action items for an organization (simple list)
     */
    List<ActionItem> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find action items by analysis ID and status within an organization
     */
    List<ActionItem> findByOrganizationIdAndAnalysisIdAndStatusOrderByDeadlineAsc(Long organizationId, Long analysisId, String status);

    /**
     * SECURITY: Find action items by multiple analysis IDs within an organization
     */
    List<ActionItem> findByOrganizationIdAndAnalysisIdInOrderByDeadlineAsc(Long organizationId, List<Long> analysisIds);

    /**
     * SECURITY: Delete action items by analysis ID within an organization
     */
    void deleteByOrganizationIdAndAnalysisId(Long organizationId, Long analysisId);
}
