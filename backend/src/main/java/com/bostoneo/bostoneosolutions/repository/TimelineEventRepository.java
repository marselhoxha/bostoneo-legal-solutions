package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Long> {
    List<TimelineEvent> findByAnalysisIdOrderByEventDateAsc(Long analysisId);
    List<TimelineEvent> findByAnalysisIdAndEventTypeOrderByEventDateAsc(Long analysisId, String eventType);
    List<TimelineEvent> findByAnalysisIdInOrderByEventDateAsc(List<Long> analysisIds);
    /**
     * @deprecated Use deleteByOrganizationIdAndAnalysisId instead for tenant isolation
     */
    @Deprecated
    void deleteByAnalysisId(Long analysisId);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * TENANT-FILTERED: Delete timeline events by analysis ID within organization
     */
    void deleteByOrganizationIdAndAnalysisId(Long organizationId, Long analysisId);

    /**
     * Find timeline event by ID and organization (SECURITY: tenant isolation)
     */
    Optional<TimelineEvent> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find timeline events by analysis ID within an organization (SECURITY: tenant isolation)
     */
    List<TimelineEvent> findByOrganizationIdAndAnalysisIdOrderByEventDateAsc(Long organizationId, Long analysisId);

    /**
     * Find all timeline events for an organization (SECURITY: tenant isolation)
     */
    List<TimelineEvent> findByOrganizationIdOrderByEventDateAsc(Long organizationId);
}
