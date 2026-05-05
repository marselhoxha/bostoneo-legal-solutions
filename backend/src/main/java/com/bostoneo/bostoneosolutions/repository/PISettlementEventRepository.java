package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PISettlementEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PI Settlement Events
 */
@Repository
public interface PISettlementEventRepository extends JpaRepository<PISettlementEvent, Long> {

    /**
     * Find all settlement events for a case ordered by event date descending (newest first)
     */
    List<PISettlementEvent> findByCaseIdAndOrganizationIdOrderByEventDateDesc(Long caseId, Long organizationId);

    /**
     * Find all settlement events for a case ordered by event date ascending (oldest first)
     */
    List<PISettlementEvent> findByCaseIdAndOrganizationIdOrderByEventDateAsc(Long caseId, Long organizationId);

    /**
     * Find a specific event by ID with organization filtering
     */
    Optional<PISettlementEvent> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Delete all settlement events for a case
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Count settlement events for a case
     */
    long countByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Count events for this case that record a carrier response. CaseStageService
     * treats >0 as NEGOTIATION rather than just DEMAND_SENT. Returning long avoids
     * the boolean-projection JPQL portability footgun.
     */
    @Query("SELECT COUNT(e) FROM PISettlementEvent e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId " +
           "AND (e.offerAmount IS NOT NULL OR e.counterAmount IS NOT NULL)")
    long countCarrierResponses(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);
}
