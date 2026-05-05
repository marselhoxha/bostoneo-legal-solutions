package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PICommunication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * P9e — Repository for PI Communications Log.
 *
 * All finder methods include organizationId for tenant isolation, mirroring
 * the PISettlementEventRepository pattern.
 */
@Repository
public interface PICommunicationRepository extends JpaRepository<PICommunication, Long> {

    /** Per-case timeline ordered newest-first. */
    List<PICommunication> findByCaseIdAndOrganizationIdOrderByEventDateDesc(Long caseId, Long organizationId);

    /** Tenant-scoped fetch by id (used for update/delete authorization). */
    Optional<PICommunication> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Cascade-delete when a case is removed. */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /** Counter for KPI strip / dashboard widgets. */
    long countByCaseIdAndOrganizationId(Long caseId, Long organizationId);
}
